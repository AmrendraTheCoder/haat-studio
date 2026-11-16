"""
Compare the base model and a LoRA adapter on the held-out (val) samples.

For each val sample the model generates the photo from the same inputs and seed,
and we score it against the real photo: PSNR and SSIM on the whole image, L1 on
the garment pixels. Writes eval.csv, a summary, and a side-by-side image per sample
(inputs | real | base | LoRA).

    python scripts/evaluate.py --data data/prepared --weights-dir weights \
        --lora runs/indian-v1/lora-best.safetensors --out runs/indian-v1/eval
"""

import _common  # noqa: F401
import argparse
import csv
import json
import os
import statistics
from types import SimpleNamespace

import torch
from fashn_vton import TryOnPipeline
from PIL import Image
from safetensors import safe_open

from haat_ft.data import PreparedDataset
from haat_ft.infer import load_tryon_model, low_memory_attention, mps_compat
from haat_ft.lora import inject_lora, load_lora
from haat_ft.metrics import garment_l1, psnr, ssim

ap = argparse.ArgumentParser()
ap.add_argument("--data", required=True)
ap.add_argument("--weights-dir", default="weights")
ap.add_argument("--lora")
ap.add_argument("--out", required=True)
ap.add_argument("--steps", type=int, default=30)
ap.add_argument("--guidance", type=float, default=1.5)
ap.add_argument("--seed", type=int, default=42)
ap.add_argument("--device")
a = ap.parse_args()

device = torch.device(a.device or ("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"))
dtype = torch.bfloat16 if device.type in ("cuda", "mps") else torch.float32


if device.type == "mps":
    mps_compat()
    low_memory_attention()


def load(lora=None):
    m = load_tryon_model(a.weights_dir, "cpu", dtype)
    if lora:
        with safe_open(lora, "pt") as f:
            meta = f.metadata()
        inject_lora(m, int(meta["rank"]), float(meta["alpha"]), meta["targets"])
        load_lora(m, lora)
    return m.to(device, dtype=dtype).eval()


models = {"base": load()}
if a.lora:
    models["lora"] = load(a.lora)

data = PreparedDataset(a.data, "val")
os.makedirs(a.out, exist_ok=True)
to_t = lambda im: torch.from_numpy(__import__("numpy").array(im)).float().permute(2, 0, 1)[None] / 127.5 - 1  # noqa: E731
rows = []
for i in range(len(data)):
    s = {k: v[None].to(device) for k, v in data[i].items()}
    name = os.path.basename(data.files[i]).removesuffix(".pt")
    panels = [s["ca"], s["garment"], s["target"]]
    for label, model in models.items():
        torch.manual_seed(a.seed)
        img = TryOnPipeline._sample(
            SimpleNamespace(tryon_model=model),
            ca_images=s["ca"].to(dtype), garment_images=s["garment"].to(dtype), person_poses=s["person_pose"].to(dtype),
            garment_poses=s["garment_pose"].to(dtype), garment_categories=s["category"],
            num_timesteps=a.steps, guidance_scale=a.guidance, use_tqdm=False,
        )[0]
        out = to_t(img).to(device)
        panels.append(out)
        w = s["weight"].float()
        rows.append({
            "sample": name, "model": label,
            "psnr": round(psnr(out, s["target"], w), 3),
            "ssim": round(ssim(out.cpu(), s["target"].cpu(), w.cpu()), 4),
            "garment_l1": round(garment_l1(out, s["target"], s["garment_mask"].float()), 4),
        })
        print(rows[-1])
    strip = torch.cat([((p[0].float().cpu() + 1) * 127.5).clamp(0, 255) for p in panels], dim=2).byte().permute(1, 2, 0).numpy()
    Image.fromarray(strip).save(os.path.join(a.out, f"{name}.jpg"), quality=92)

with open(os.path.join(a.out, "eval.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader()
    w.writerows(rows)
summary = {
    m: {k: round(statistics.mean(r[k] for r in rows if r["model"] == m), 4) for k in ("psnr", "ssim", "garment_l1")} for m in models
}
json.dump(summary, open(os.path.join(a.out, "summary.json"), "w"), indent=2)
print(json.dumps(summary, indent=2))
print("Higher PSNR/SSIM and lower garment_l1 are better. Look at the images too: these numbers miss a wrong logo.")
