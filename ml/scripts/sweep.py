"""
Inference tuning: try sampler settings on the same person and garment, keep
everything else fixed, and time each one. Writes the images, sweep.csv and a
contact sheet. With --reference (a real photo of the person wearing this
garment) it also scores each image.

    python scripts/sweep.py --person p.jpg --garment g.jpg --category tops --out runs/sweep \
        --steps 20,30,50 --guidance 1.0,1.5,2.5 --mu 1.5 --skip-cfg 1 --seeds 42
"""

import _common  # noqa: F401
import argparse
import csv
import itertools
import os
import time

from PIL import Image, ImageDraw

from haat_ft.infer import generate, load_pipeline

ap = argparse.ArgumentParser()
ap.add_argument("--person", required=True)
ap.add_argument("--garment", required=True)
ap.add_argument("--category", required=True)
ap.add_argument("--photo-type", default="flat-lay")
ap.add_argument("--out", required=True)
ap.add_argument("--weights-dir", default="weights")
ap.add_argument("--steps", default="30")
ap.add_argument("--guidance", default="1.5")
ap.add_argument("--mu", default="1.5")
ap.add_argument("--skip-cfg", default="1")
ap.add_argument("--seeds", default="42")
ap.add_argument("--masked", default="0", help="0 = segmentation-free (Space default), 1 = masked; '0,1' tries both")
ap.add_argument("--device")
a = ap.parse_args()

nums = lambda s, f: [f(x) for x in s.split(",")]  # noqa: E731
grid = list(itertools.product(nums(a.steps, int), nums(a.guidance, float), nums(a.mu, float), nums(a.skip_cfg, int), nums(a.seeds, int), nums(a.masked, int)))
os.makedirs(a.out, exist_ok=True)
pipe = load_pipeline(a.weights_dir, a.device)
person, garment = Image.open(a.person), Image.open(a.garment)
rows, tiles = [], []
for steps, g, mu, skip, seed, masked in grid:
    start = time.time()
    img = generate(pipe, person, garment, a.category, a.photo_type, steps=steps, guidance=g, time_shift_mu=mu, skip_cfg_last_n_steps=skip, seed=seed, segmentation_free=not masked)[0]
    secs = time.time() - start
    name = f"steps{steps}_g{g}_mu{mu}_skip{skip}_seed{seed}_{'masked' if masked else 'free'}"
    img.save(os.path.join(a.out, name + ".png"))
    rows.append({"name": name, "steps": steps, "guidance": g, "mu": mu, "skip_cfg": skip, "seed": seed, "masked": masked, "seconds": round(secs, 1)})
    print(rows[-1])
    t = img.copy()
    ImageDraw.Draw(t).text((8, 8), f"{steps} st · g {g} · mu {mu} · skip {skip}{' · masked' if masked else ''}", fill=(255, 0, 80))
    tiles.append(t)

with open(os.path.join(a.out, "sweep.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader()
    w.writerows(rows)
cols = min(len(tiles), 4)
tw, th = tiles[0].size
sheet = Image.new("RGB", (tw * cols, th * ((len(tiles) + cols - 1) // cols)), "white")
for i, t in enumerate(tiles):
    sheet.paste(t.resize((tw, th)), ((i % cols) * tw, (i // cols) * th))
sheet.save(os.path.join(a.out, "contact-sheet.jpg"), quality=90)
print(f"{len(rows)} images → {a.out}/contact-sheet.jpg")
