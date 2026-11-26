"""
One try-on with every sampler setting, optionally with a LoRA adapter.

    python scripts/sample.py --person p.jpg --garment g.jpg --category tops --out out.png \
        [--steps 30 --guidance 1.5 --mu 1.5 --skip-cfg 1 --seed 42] [--lora runs/x/lora-best.safetensors]
"""

import _common  # noqa: F401
import argparse
import json
import time

from PIL import Image
from safetensors import safe_open

from haat_ft.infer import attach_lora, generate, load_pipeline

ap = argparse.ArgumentParser()
ap.add_argument("--person", required=True)
ap.add_argument("--garment", required=True)
ap.add_argument("--category", required=True)
ap.add_argument("--photo-type", default="flat-lay")
ap.add_argument("--out", required=True)
ap.add_argument("--weights-dir", default="weights")
ap.add_argument("--steps", type=int, default=30)
ap.add_argument("--guidance", type=float, default=1.5)
ap.add_argument("--mu", type=float, default=1.5)
ap.add_argument("--skip-cfg", type=int, default=1)
ap.add_argument("--seed", type=int, default=42)
ap.add_argument("--masked", action="store_true", help="grey out the old garment instead of segmentation-free")
ap.add_argument("--lora")
ap.add_argument("--scale", type=float, default=1.0, help="generate at this fraction of full size (0.5 = what the laptop adapter was trained and evaluated at)")
ap.add_argument("--device")
a = ap.parse_args()

pipe = load_pipeline(a.weights_dir, a.device)
if a.lora:
    with safe_open(a.lora, "pt") as f:
        m = f.metadata()
    attach_lora(pipe, a.lora, int(m["rank"]), float(m["alpha"]), m["targets"])
start = time.time()
img = generate(
    pipe, Image.open(a.person), Image.open(a.garment), a.category, a.photo_type,
    steps=a.steps, guidance=a.guidance, time_shift_mu=a.mu, skip_cfg_last_n_steps=a.skip_cfg, seed=a.seed, segmentation_free=not a.masked, scale=a.scale,
)[0]
img.save(a.out)
print(json.dumps({"out": a.out, "seconds": round(time.time() - start, 1), "device": str(pipe.device)}))
