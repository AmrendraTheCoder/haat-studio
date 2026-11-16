"""
LoRA (Low-Rank Adaptation, Hu et al. 2021) for FASHN VTON 1.5.

Instead of changing a frozen weight W (out × in), we learn a small update
ΔW = (alpha / rank) · B · A, with A: rank × in and B: out × rank. B starts at
zero, so before training the adapted model is exactly the original model.

Why LoRA and not full fine-tuning:
  - a few hundred Indian-garment pairs would make a 972M-parameter model forget
    what it learned from 18M pairs; LoRA changes ~1–3% of the weights;
  - the adapter is tens of MB instead of 2 GB, and can be switched off;
  - it fits on one 16–24 GB GPU (college server, Kaggle T4) with checkpointing.
"""

import math
import re
from typing import Dict, Iterable

import torch
from safetensors.torch import load_file, save_file
from torch import nn

# Linear layers of the transformer blocks (tryon_mmdit.py), by module name.
#   double_blocks.N.{img,txt}_attn.qkv / .proj   attention, person and garment streams
#   double_blocks.N.{img,txt}_mlp.0 / .2         feed-forward
#   single_blocks.N.linear1 / linear2            fused qkv+mlp-in / proj+mlp-out
#   x_patch_mixer.N.linear1 / linear2            the 4 blocks that mix person-side patches first
# Modulation layers (timestep/category → scale, shift, gate) are left frozen.
TARGETS = {
    "attn": r"(double_blocks\.\d+\.(img|txt)_attn\.(qkv|proj)|single_blocks\.\d+\.linear[12])$",
    "attn+mlp": r"(double_blocks\.\d+\.((img|txt)_attn\.(qkv|proj)|(img|txt)_mlp\.[02])|single_blocks\.\d+\.linear[12])$",
    "all": r"((double_blocks\.\d+\.((img|txt)_attn\.(qkv|proj)|(img|txt)_mlp\.[02]))|(single_blocks|x_patch_mixer)\.\d+\.linear[12])$",
}


class LoRALinear(nn.Module):
    def __init__(self, base: nn.Linear, rank: int, alpha: float, dropout: float = 0.0):
        super().__init__()
        self.base = base
        self.base.requires_grad_(False)
        self.rank = rank
        self.scale = alpha / rank
        # Adapter weights are kept in float32 even when the base is bf16: tiny updates
        # vanish in bf16's 8-bit mantissa.
        self.down = nn.Linear(base.in_features, rank, bias=False, device=base.weight.device, dtype=torch.float32)
        self.up = nn.Linear(rank, base.out_features, bias=False, device=base.weight.device, dtype=torch.float32)
        nn.init.kaiming_uniform_(self.down.weight, a=math.sqrt(5))
        nn.init.zeros_(self.up.weight)
        self.dropout = nn.Dropout(dropout) if dropout > 0 else nn.Identity()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        delta = self.up(self.down(self.dropout(x.to(self.down.weight.dtype)))) * self.scale
        return self.base(x) + delta.to(x.dtype)

    @torch.no_grad()
    def merged(self) -> nn.Linear:
        """The base layer with the update folded in — no adapter cost at inference."""
        w = self.base.weight.float() + self.scale * (self.up.weight @ self.down.weight)
        self.base.weight.copy_(w.to(self.base.weight.dtype))
        return self.base


def _set(model: nn.Module, name: str, module: nn.Module):
    parent, _, child = name.rpartition(".")
    setattr(model.get_submodule(parent) if parent else model, child, module)


def inject_lora(model: nn.Module, rank: int = 16, alpha: float = 16.0, targets: str = "attn+mlp", dropout: float = 0.0) -> list[str]:
    """Freeze the model and wrap every matching Linear in a LoRALinear. Returns the wrapped names."""
    pattern = re.compile(TARGETS.get(targets, targets))
    model.requires_grad_(False)
    names = [n for n, m in model.named_modules() if isinstance(m, nn.Linear) and pattern.search(n)]
    if not names:
        raise ValueError(f"No Linear layer matches {targets!r}")
    for n in names:
        _set(model, n, LoRALinear(model.get_submodule(n), rank, alpha, dropout))
    return names


def lora_parameters(model: nn.Module) -> Iterable[nn.Parameter]:
    return (p for p in model.parameters() if p.requires_grad)


def lora_state_dict(model: nn.Module) -> Dict[str, torch.Tensor]:
    """Only what training changed: adapter weights, plus any embedding rows unfrozen for new categories."""
    return {k: v.detach().cpu().contiguous() for k, v in model.state_dict().items() if ".down." in k or ".up." in k or k.startswith("y_embedder.")}


def save_lora(model: nn.Module, path: str, meta: Dict[str, str]):
    save_file(lora_state_dict(model), path, metadata={k: str(v) for k, v in meta.items()})


def load_lora(model: nn.Module, path: str):
    """Load an adapter saved by save_lora into a model already prepared with inject_lora (same settings)."""
    state = load_file(path)
    if "y_embedder.weight" in state and state["y_embedder.weight"].shape != model.y_embedder.weight.shape:
        extend_categories(model, state["y_embedder.weight"].shape[0] - model.y_embedder.weight.shape[0])
    missing = [k for k in state if k not in model.state_dict()]
    if missing:
        raise KeyError(f"Adapter does not match this model (e.g. {missing[0]}); inject with the same rank/targets first")
    model.load_state_dict(state, strict=False)


def merge_lora(model: nn.Module) -> nn.Module:
    for n, m in list(model.named_modules()):
        if isinstance(m, LoRALinear):
            _set(model, n, m.merged())
    return model


def extend_categories(model: nn.Module, extra: int = 1, init_from: int = 3) -> int:
    """
    Add garment categories (e.g. "saree") to the category embedding.

    The model has 4 rows: 0 = "no condition" (used by classifier-free guidance),
    1 tops, 2 bottoms, 3 one-pieces. New rows start as a copy of `init_from`
    (one-pieces: closest to a saree or lehenga) and are trained. Returns the first new id.
    """
    old = model.y_embedder
    new = nn.Embedding(old.num_embeddings + extra, old.embedding_dim, device=old.weight.device, dtype=old.weight.dtype)
    with torch.no_grad():
        new.weight[: old.num_embeddings] = old.weight
        new.weight[old.num_embeddings :] = old.weight[init_from]
    new.weight.requires_grad_(True)
    model.y_embedder = new
    return old.num_embeddings
