"""
Fine-tune FASHN VTON 1.5 with LoRA.

    python scripts/train_lora.py --data data/prepared --weights-dir weights --out runs/indian-v1 \
        --steps 2000 --rank 16 [--new-categories 1]

Writes runs/<name>/config.json, log.csv (train/val loss), lora-best.safetensors
and lora-step<N>.safetensors. Needs a CUDA GPU with ~16 GB+ (or an Apple GPU, slowly).
"""

import _common  # noqa: F401
import argparse
from dataclasses import fields

import torch

from haat_ft.data import PreparedDataset
from haat_ft.infer import load_tryon_model, low_memory_attention, mps_compat
from haat_ft.train import TrainConfig, train

ap = argparse.ArgumentParser()
ap.add_argument("--data", required=True)
ap.add_argument("--weights-dir", default="weights")
ap.add_argument("--out", required=True)
ap.add_argument("--device")
for f in fields(TrainConfig):
    kind = (lambda s: s.lower() in ("1", "true", "yes")) if f.type in (bool, "bool") else (type(f.default))
    ap.add_argument("--" + f.name.replace("_", "-"), type=kind, default=f.default)
a = ap.parse_args()
cfg = TrainConfig(**{f.name: getattr(a, f.name) for f in fields(TrainConfig)})

device = torch.device(a.device or ("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"))
# bf16 base weights where the hardware supports it, else fp32 (fp16 can overflow).
bf16 = (device.type == "cuda" and torch.cuda.is_bf16_supported()) or device.type == "mps"
if device.type == "mps":
    mps_compat()
    low_memory_attention()
model = load_tryon_model(a.weights_dir, device, torch.bfloat16 if bf16 else torch.float32)

best = train(model, PreparedDataset(a.data, "train"), PreparedDataset(a.data, "val"), a.out, cfg, device)
print(f"best val loss {best:.4f} → {a.out}/lora-best.safetensors")
