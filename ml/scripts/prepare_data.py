"""
Turn photos into training samples (.pt), using FASHN's own preprocessing.

Input: a CSV with one row per photo of a person wearing a garment:

    id,person,garment,category,photo_type,split
    kurti-001,photos/kurti-001-worn.jpg,photos/kurti-001-flat.jpg,tops,flat-lay,train

  person      photo of someone WEARING the garment (this is what the model must produce)
  garment     the same garment on its own (flat-lay) or worn by someone else (model)
  category    tops | bottoms | one-pieces (or a new one registered with --new-category)
  split       train | val

Two kinds of sample, as FASHN trained (model card: masked pairs, then a 50/50
mix with synthetic triplets):

  paired   the old garment region of the person photo is greyed out and the model
           learns to fill it with the garment (masked mode).
  triplet  for segmentation-free mode: the base model first dresses the same person
           in a DIFFERENT garment from the dataset; the model then learns to turn
           that synthetic photo back into the real one. The target is always a real
           photo. (--triplets; needs a GPU — one generation per sample.)

    python scripts/prepare_data.py --csv data/pairs.csv --out data/prepared --weights-dir weights [--triplets]
"""

import _common  # noqa: F401
import argparse
import csv
import json
import os

from PIL import Image

from haat_ft.data import add_category, preprocess, save_prepared
from haat_ft.infer import generate, load_pipeline

ap = argparse.ArgumentParser()
ap.add_argument("--csv", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--weights-dir", default="weights")
ap.add_argument("--triplets", action="store_true")
ap.add_argument("--new-category", action="append", default=[], help="name:label, e.g. saree:4")
ap.add_argument("--device")
a = ap.parse_args()

for spec in a.new_category:
    name, label = spec.split(":")
    add_category(name, int(label))

root = os.path.dirname(os.path.abspath(a.csv))
rows = list(csv.DictReader(open(a.csv)))
os.makedirs(a.out, exist_ok=True)
pipe = load_pipeline(a.weights_dir, a.device)
index = []

for i, r in enumerate(rows):
    person = Image.open(os.path.join(root, r["person"])).convert("RGB")
    garment = Image.open(os.path.join(root, r["garment"])).convert("RGB")
    meta = {k: r[k] for k in ("id", "category", "photo_type", "split")}

    prep = preprocess(pipe, person, garment, r["category"], r["photo_type"], segmentation_free=False, target=person)
    f = f"{r['id']}-paired.pt"
    save_prepared(prep, os.path.join(a.out, f), {**meta, "mode": "paired"})
    index.append({"file": f, "split": r["split"], "id": r["id"], "mode": "paired"})

    if a.triplets:
        # Another garment of the same type, chosen deterministically (the next one in the file).
        others = [o for o in rows if o["category"] == r["category"] and o["id"] != r["id"]]
        if others:
            other = others[i % len(others)]
            swap = Image.open(os.path.join(root, other["garment"])).convert("RGB")
            synthetic = generate(pipe, person, swap, r["category"], other["photo_type"], seed=i)[0]
            synthetic.save(os.path.join(a.out, f"{r['id']}-synthetic.jpg"), quality=95)
            prep = preprocess(pipe, synthetic.resize(person.size), garment, r["category"], r["photo_type"], segmentation_free=True, target=person)
            f = f"{r['id']}-triplet.pt"
            save_prepared(prep, os.path.join(a.out, f), {**meta, "mode": "triplet", "swapped_with": other["id"]})
            index.append({"file": f, "split": r["split"], "id": r["id"], "mode": "triplet"})
    print(f"[{i + 1}/{len(rows)}] {r['id']}")

json.dump(index, open(os.path.join(a.out, "index.json"), "w"), indent=1)
print(f"{len(index)} samples → {a.out}")
