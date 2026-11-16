"""
Generation with every knob FASHN's sampler has — including the two the public
Space doesn't expose (time_shift_mu, skip_cfg_last_n_steps) — and an optional
LoRA adapter.
"""

import os
from types import SimpleNamespace
from typing import List, Optional

import numpy as np
import torch
from fashn_vton import TryOnPipeline
from fashn_vton.tryon_mmdit import TryOnModel
from PIL import Image

from .data import crop_output, preprocess, to_tensors
from .lora import inject_lora, load_lora


def low_memory_attention(heads_per_chunk: int = 2):
    """
    Attention a few heads at a time. With 6,912 tokens one full attention matrix is
    10 heads × 6912² × 2 bytes × 2 (guidance batch) ≈ 1.9 GB — more than an 8 GB Mac
    can spare next to the weights. Same result, less peak memory.
    """
    import fashn_vton.tryon_mmdit as mmdit

    sdpa = torch.nn.functional.scaled_dot_product_attention

    def chunked(q, k, v):
        return torch.cat([sdpa(q[:, i : i + heads_per_chunk], k[:, i : i + heads_per_chunk], v[:, i : i + heads_per_chunk]) for i in range(0, q.shape[1], heads_per_chunk)], dim=1)

    mmdit._attn_processor = chunked


def load_tryon_model(weights_dir: str, device, dtype) -> TryOnModel:
    """
    TryOnModel straight from the bf16 file: built on the "meta" device (no random init,
    no memory) and filled with the saved tensors. FASHN's loader builds a float32 model
    first (3.9 GB) — on an 8 GB Mac that alone took 16 minutes of swapping.
    """
    from fashn_vton.utils import load_checkpoint

    with torch.device("meta"):
        model = TryOnModel()
    model.load_state_dict(load_checkpoint(os.path.join(weights_dir, "model.safetensors")), assign=True)
    return model.to(device=device, dtype=dtype).eval()


def mps_compat():
    """FASHN's rotary embedding computes in float64, which Apple GPUs lack. float32 is
    exact enough here: positions go up to 72 and the frequencies to 1/10000."""
    import fashn_vton.tryon_mmdit as mmdit
    from einops import rearrange

    def rope(pos, dim, theta):
        scale = torch.arange(0, dim, 2, dtype=torch.float32, device=pos.device) / dim
        omega = 1.0 / (theta**scale)
        out = torch.einsum("...n,d->...nd", pos.float(), omega)
        out = torch.stack([torch.cos(out), -torch.sin(out), torch.sin(out), torch.cos(out)], dim=-1)
        return rearrange(out, "b n d (i j) -> b n d i j", i=2, j=2).float()

    mmdit.rope = rope


class _Pipeline(TryOnPipeline):
    """FASHN's pipeline with the fast loader, and bf16 on Apple GPUs (FASHN enables it only on CUDA)."""

    def _setup_tryon_model(self):
        if self.device.type == "mps":
            self.inference_dtype = torch.bfloat16
        self.tryon_model = load_tryon_model(self.weights_dir, self.device, self.inference_dtype)


def load_pipeline(weights_dir: str, device: Optional[str] = None) -> TryOnPipeline:
    """FASHN's pipeline on CUDA, an Apple GPU (MPS) or the CPU. Pose and parser run on the CPU unless CUDA."""
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
    if device == "mps":
        mps_compat()
        low_memory_attention()
    return _Pipeline(weights_dir=weights_dir, device=device)


def attach_lora(pipe: TryOnPipeline, path: str, rank: int, alpha: float, targets: str):
    inject_lora(pipe.tryon_model, rank=rank, alpha=alpha, targets=targets)
    load_lora(pipe.tryon_model, path)
    pipe.tryon_model.to(pipe.device).eval()


@torch.inference_mode()
def generate(
    pipe: TryOnPipeline,
    person: Image.Image,
    garment: Image.Image,
    category: str,
    photo_type: str = "flat-lay",
    *,
    steps: int = 30,
    guidance: float = 1.5,
    time_shift_mu: float = 1.5,
    skip_cfg_last_n_steps: int = 1,
    seed: int = 42,
    segmentation_free: bool = True,
    num_samples: int = 1,
    model=None,
) -> List[Image.Image]:
    """Same result as pipe(...) for the same settings; `model` swaps in another TryOnModel."""
    torch.manual_seed(seed)
    if pipe.device.type == "cuda":
        torch.cuda.manual_seed_all(seed)
    np.random.seed(seed)

    prep = preprocess(pipe, person, garment, category, photo_type, segmentation_free)
    t = to_tensors(prep, device=pipe.device, dtype=pipe.inference_dtype)
    rep = lambda x: x.repeat(num_samples, *([1] * (x.dim() - 1)))  # noqa: E731
    # FASHN's own sampler (Euler + classifier-free guidance), called with our model.
    owner = SimpleNamespace(tryon_model=model or pipe.tryon_model)
    images = TryOnPipeline._sample(
        owner,
        ca_images=rep(t["ca"]),
        garment_images=rep(t["garment"]),
        person_poses=rep(t["person_pose"]),
        garment_poses=rep(t["garment_pose"]),
        garment_categories=rep(t["category"]),
        num_timesteps=steps,
        time_shift_mu=time_shift_mu,
        guidance_scale=guidance,
        skip_cfg_last_n_steps=skip_cfg_last_n_steps,
        use_tqdm=False,
    )
    return [crop_output(im, prep.padding) for im in images]
