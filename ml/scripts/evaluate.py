"""
Compare the base model and a LoRA adapter on the held-out (val) samples.

Two measurements per val sample, each for the base model and for base + LoRA:

  denoise_loss  the model's error in predicting the velocity towards the REAL photo,
                averaged over t = 0.1 … 0.9 with fixed noise (same noise for both
                models). Cheap, so it is computed for every val sample. Lower is better.
  psnr, ssim,   the model generates the photo from the same inputs and seed and it is
  garment_l1    scored against the real photo (whole image; garment pixels only).
                Expensive, so only for the first --gen-limit samples (0 = all).

One network is loaded once; "base" is the same network with every adapter scaled to 0,
which is exactly the original model (tests/test_finetune.py checks this). That halves the
memory, so the comparison also runs on an 8 GB laptop at --scale 0.5.

Writes eval.csv, summary.json and, for generated samples, a strip per sample
(person input | garment | real | base | LoRA).

    python scripts/evaluate.py --data data/prepared --lora runs/indian-v1/lora-best.safetensors \
        --out runs/indian-v1/eval [--scale 0.5] [--gen-limit 8] [--steps 30]
"""

import _common  # noqa: F401
import argparse
import csv
import json
import os
import statistics
import time
from types import SimpleNamespace

import numpy as np
import torch
from fashn_vton import TryOnPipeline
from PIL import Image
from safetensors import safe_open

from haat_ft.data import PreparedDataset
from haat_ft.flow import flow_loss
from haat_ft.infer import load_tryon_model, low_memory_attention, mps_compat
from haat_ft.lora import LoRALinear, inject_lora, load_lora
from haat_ft.metrics import garment_l1, psnr, ssim
from haat_ft.train import rescale

ap = argparse.ArgumentParser()
ap.add_argument("--data", required=True)
ap.add_argument("--weights-dir", default="weights")
ap.add_argument("--lora")
ap.add_argument("--out", required=True)
ap.add_argument("--steps", type=int, default=30)
ap.add_argument("--guidance", type=float, default=1.5)
ap.add_argument("--seed", type=int, default=42)
ap.add_argument("--scale", type=float, default=1.0)
ap.add_argument("--gen-limit", type=int, default=0, help="generate images for the first N val samples only (0 = all)")
ap.add_argument("--device")
a = ap.parse_args()

device = torch.device(a.device or ("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"))
dtype = torch.bfloat16 if device.type in ("cuda", "mps") else torch.float32
if device.type == "mps":
    mps_compat()
    low_memory_attention()

model = load_tryon_model(a.weights_dir, "cpu", dtype)
if a.lora:
    with safe_open(a.lora, "pt") as f:
        meta = f.metadata()
    inject_lora(model, int(meta["rank"]), float(meta["alpha"]), meta["targets"])
    load_lora(model, a.lora)
model = model.to(device, dtype=dtype).eval()
if a.scale != 1.0:
    h, w = model.input_shape
    model.input_shape = (int(h * a.scale), int(w * a.scale))
adapters = [m for m in model.modules() if isinstance(m, LoRALinear)]
full_scale = {id(m): m.scale for m in adapters}


def use(label):
    for m in adapters:
        m.scale = full_scale[id(m)] if label == "lora" else 0.0


labels = ["base", "lora"] if a.lora else ["base"]
data = PreparedDataset(a.data, "val")
os.makedirs(a.out, exist_ok=True)
to_t = lambda im: torch.from_numpy(np.array(im)).float().permute(2, 0, 1)[None] / 127.5 - 1  # noqa: E731
TS = (0.1, 0.3, 0.5, 0.7, 0.9)
rows = []
for i in range(len(data)):
    s = rescale({k: v[None].to(device) for k, v in data[i].items()}, a.scale)
    name = os.path.basename(data.files[i]).removesuffix(".pt")
    gen = torch.Generator().manual_seed(1000 + i)
    noises = [torch.randn(s["target"].shape, generator=gen).to(device, dtype) for _ in TS]
    generate = not a.gen_limit or i < a.gen_limit
    panels = [s["ca"], s["garment"], s["target"]]
    for label in labels:
        use(label)
        with torch.no_grad(), torch.autocast(device.type, dtype=dtype, enabled=device.type != "cpu"):
            losses = [float(flow_loss(model, s, t=torch.full((1,), t, device=device), noise=n, keep=torch.ones(1, dtype=torch.bool, device=device), garment_weight=1.0)) for t, n in zip(TS, noises)]
        row = {"sample": name, "model": label, "denoise_loss": round(statistics.mean(losses), 6), "psnr": "", "ssim": "", "garment_l1": "", "seconds": ""}
        if generate:
            torch.manual_seed(a.seed)
            t0 = time.time()
            with torch.no_grad():
                img = TryOnPipeline._sample(
                    SimpleNamespace(tryon_model=model),
                    ca_images=s["ca"].to(dtype), garment_images=s["garment"].to(dtype), person_poses=s["person_pose"].to(dtype),
                    garment_poses=s["garment_pose"].to(dtype), garment_categories=s["category"],
                    num_timesteps=a.steps, guidance_scale=a.guidance, use_tqdm=False,
                )[0]
            out = to_t(img).to(device)
            panels.append(out)
            wgt = s["weight"].float()
            row.update({"psnr": round(psnr(out, s["target"], wgt), 3), "ssim": round(ssim(out.cpu(), s["target"].cpu(), wgt.cpu()), 4),
                        "garment_l1": round(garment_l1(out, s["target"], s["garment_mask"].float()), 4), "seconds": round(time.time() - t0, 2)})
        rows.append(row)
        print(row, flush=True)
    if generate:
        strip = torch.cat([((p[0].float().cpu() + 1) * 127.5).clamp(0, 255) for p in panels], dim=2).byte().permute(1, 2, 0).numpy()
        Image.fromarray(strip).save(os.path.join(a.out, f"{name}.jpg"), quality=92)
    with open(os.path.join(a.out, "eval.csv"), "w", newline="") as f:  # rewritten each sample: a stopped run keeps its rows
        wr = csv.DictWriter(f, fieldnames=list(rows[0]))
        wr.writeheader()
        wr.writerows(rows)

mean = lambda xs: round(statistics.mean(xs), 5) if xs else None  # noqa: E731
summary = {lab: {k: mean([float(r[k]) for r in rows if r["model"] == lab and r[k] != ""]) for k in ("denoise_loss", "psnr", "ssim", "garment_l1", "seconds")} for lab in labels}
summary["settings"] = {"scale": a.scale, "steps": a.steps, "guidance": a.guidance, "seed": a.seed, "val_samples": len(data), "generated": sum(1 for r in rows if r["model"] == "base" and r["psnr"] != "")}
json.dump(summary, open(os.path.join(a.out, "summary.json"), "w"), indent=2)
print(json.dumps(summary, indent=2))
print("Lower denoise_loss and garment_l1, higher PSNR/SSIM are better. Look at the images too.")
