"""
Retail catalogue → training pairs for LoRA, with pose and image guardrails.

A product listing usually has several photos of the same product: some worn by a
model, some of the garment alone (flat, on a hanger or an invisible mannequin).
That is exactly the pair the fine-tune needs (prepare_data.py):

    person   = a photo of someone WEARING the product   (what the model must produce)
    garment  = the same product alone (flat-lay), or worn in a different photo (model)

Every photo goes through the same pose model FASHN uses (YOLOX person detector +
DWPose, already in weights/dwpose), and is sorted:

    worn          a person is detected and enough body keypoints are visible
    garment-only  no person detected (or too few keypoints to be a person)
    rejected      unreadable, too small, too blurry, or a person who fails the pose rules

Pose guardrails for a TARGET photo (the photo the model learns to produce):
    - a real person: detector confidence >= 0.6 (DWPose alone will "find" a body in a
      print close-up)
    - exactly one dominant person (a second person must be < 35 % of its height)
    - shoulders and hips visible (the torso is where tops go)
    - knees visible as well for bottoms and one-pieces
    - roughly frontal: shoulder width ≥ 0.45 × torso height, and the face is visible
      (nose and both eyes) and the body faces the camera (left shoulder on the photo's
      right), so back and side views are not used as targets
    - a keypoint counts only when it is confident and inside the photo
    - the person fills ≥ 45 % of the photo height
A worn photo used as the GARMENT input must show the front of the whole garment:
shoulders, hips and a frontal face (no close-ups, no back views).
A garment-only photo must look like a product on a background: a plain border that
differs from the centre, and the product touching at most two edges of the photo
on a light studio backdrop (a fabric swatch or a print close-up is rejected).
Image guardrails for every photo: short side ≥ 384 px, sharpness (variance of the
Laplacian at 512 px) ≥ 12, and a perceptual hash so a photo shared by several colour
variants is used once.

Splits are by product family (parent ASIN), never by photo, so no garment is in both
train and val. Everything is reported in qc.json; per-photo decisions are cached in
photos.jsonl so a long run can be stopped and resumed.

    python scripts/build_pairs.py --retail <data/retail> --out data/pairs \
        [--categories tshirt:tops,top:tops,saree:saree] [--limit 200] [--val 0.15]

Then:  python scripts/prepare_data.py --csv data/pairs/pairs.csv --out data/prepared [--new-category saree:4]
"""

import _common  # noqa: F401
import argparse
import collections
import csv
import hashlib
import json
import os
import random
import time

import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("--retail", required=True, help="folder that holds amazon/<category>/details/products_detail.jsonl and amazon/images/")
ap.add_argument("--out", required=True)
ap.add_argument("--weights-dir", default="weights")
ap.add_argument("--categories", default="tshirt:tops,top:tops", help="catalogue folder:FASHN category, comma-separated (saree:saree adds a new category)")
ap.add_argument("--source", default="amazon", help="sub-folder of --retail")
ap.add_argument("--limit", type=int, default=0, help="products per category (0 = all)")
ap.add_argument("--min-photos", type=int, default=2, help="skip products with fewer photos on disk (a pair needs two)")
ap.add_argument("--val", type=float, default=0.15)
ap.add_argument("--seed", type=int, default=7)
ap.add_argument("--sheet", type=int, default=8, help="pairs drawn on the contact sheet")
a = ap.parse_args()

# DWPose / OpenPose body indices
NOSE, NECK, RSHO, LSHO, RHIP, LHIP, RKNEE, LKNEE = 0, 1, 2, 5, 8, 11, 9, 12
KP_THR = 0.3  # FASHN's own keypoint visibility threshold
MIN_SIDE, MIN_SHARP = 384, 12.0
RULES = {"min_side": MIN_SIDE, "min_sharpness": MIN_SHARP, "keypoint_threshold": KP_THR, "min_person_height": 0.45,
         "min_shoulder_to_torso": 0.45, "max_second_person": 0.35, "val_fraction": a.val}

os.makedirs(a.out, exist_ok=True)
src = os.path.join(a.retail, a.source)
img_dir = os.path.abspath(os.path.join(src, "images"))
local = {}
for f in os.listdir(img_dir):
    local.setdefault(f.split(".")[0], f)


def image_id(url: str) -> str:
    return url.rsplit("/", 1)[-1].split(".")[0]


def dhash(gray: np.ndarray) -> str:
    small = cv2.resize(gray, (9, 8), interpolation=cv2.INTER_AREA)
    bits = (small[:, 1:] > small[:, :-1]).flatten()
    return "%016x" % int("".join("1" if b else "0" for b in bits), 2)


# ---------- pose model (FASHN's detector + DWPose, on CPU unless CUDA is there) ----------
from fashn_vton.dwpose.onnxdet import demo_postprocess, multiclass_nms, preprocess  # noqa: E402
from fashn_vton.dwpose.onnxpose import inference_pose  # noqa: E402
from fashn_vton.dwpose.wholebody import Wholebody  # noqa: E402

try:
    import torch
    dev = "cuda:0" if torch.cuda.is_available() else "cpu"
except Exception:
    dev = "cpu"
wb = Wholebody(os.path.join(a.weights_dir, "dwpose"), device=dev)


MIN_PERSON_SCORE = 0.6
RULES["min_person_score"] = MIN_PERSON_SCORE


def detect_people(img):
    """FASHN's YOLOX person detector (onnxdet.inference_detector), but keeping the scores."""
    x, ratio = preprocess(img, (640, 640))
    out = wb.session_det.run(None, {wb.session_det.get_inputs()[0].name: x[None]})
    pred = demo_postprocess(out[0], (640, 640))[0]
    b, s = pred[:, :4], pred[:, 4:5] * pred[:, 5:]
    xyxy = np.stack([b[:, 0] - b[:, 2] / 2, b[:, 1] - b[:, 3] / 2, b[:, 0] + b[:, 2] / 2, b[:, 1] + b[:, 3] / 2], 1) / ratio
    dets = multiclass_nms(xyxy, s, nms_thr=0.45, score_thr=0.1)
    if dets is None:
        return np.zeros((0, 4)), np.zeros(0)
    keep = (dets[:, 5] == 0) & (dets[:, 4] > 0.3)
    return dets[keep, :4], dets[keep, 4]


def analyse(path: str) -> dict:
    img = cv2.imread(path)
    if img is None:
        return {"kind": "rejected", "reason": "unreadable"}
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    small = cv2.resize(gray, (int(w * 512 / min(w, h)), int(h * 512 / min(w, h))), interpolation=cv2.INTER_AREA)
    info = {"w": w, "h": h, "sharpness": round(float(cv2.Laplacian(small, cv2.CV_64F).var()), 1), "hash": dhash(gray)}
    bw = max(4, int(0.04 * min(w, h)))
    border = np.concatenate([img[:bw].reshape(-1, 3), img[-bw:].reshape(-1, 3), img[:, :bw].reshape(-1, 3), img[:, -bw:].reshape(-1, 3)]).astype(np.float32)
    centre = img[h // 3 : 2 * h // 3, w // 3 : 2 * w // 3].reshape(-1, 3).astype(np.float32)
    info["border_std"] = round(float(border.std(0).mean()), 1)
    info["centre_contrast"] = round(float(np.abs(centre.mean(0) - border.mean(0)).mean()), 1)
    if min(w, h) < MIN_SIDE:
        return {**info, "kind": "rejected", "reason": "too small"}
    if info["sharpness"] < MIN_SHARP:
        return {**info, "kind": "rejected", "reason": "blurry"}
    boxes, box_scores = detect_people(img)
    info["person_score"] = round(float(box_scores.max()), 3) if len(box_scores) else 0.0
    # the product must sit inside the frame: a close-up of a print touches 3-4 edges
    fg = np.abs(img.astype(np.float32) - border.mean(0)).mean(2) > 40
    e = max(2, int(0.02 * min(w, h)))
    info["edges_touched"] = int(sum(float(s.mean()) > 0.05 for s in (fg[:e], fg[-e:], fg[:, :e], fg[:, -e:])))
    # and the backdrop must be a light studio backdrop: on a print close-up the "border"
    # is the (often dark) fabric itself
    info["border_brightness"] = round(float(border.mean()), 1)
    product_shot = (info["border_std"] < 30 and info["centre_contrast"] > 12 and info["edges_touched"] <= 2
                    and info["border_brightness"] >= 150)
    if len(boxes) == 0:
        if not product_shot:
            return {**info, "kind": "rejected", "reason": "no product on a plain background"}
        return {**info, "kind": "garment-only", "people": 0}
    kps, scores = inference_pose(wb.session_pose, boxes, img)
    body = scores[:, :17]
    visible = (body > KP_THR).sum(1)
    people = int((visible >= 6).sum())
    if people == 0 or info["person_score"] < MIN_PERSON_SCORE:
        if not product_shot:
            return {**info, "kind": "rejected", "reason": "no product on a plain background"}
        return {**info, "kind": "garment-only", "people": 0, "note": "detector box without a body"}
    heights = [(b[3] - b[1]) / h for b in boxes]
    order = np.argsort(heights)[::-1]
    main = int(order[0])
    # mmpose (COCO-17) indices on the raw output: 5/6 shoulders, 11/12 hips, 13/14 knees, 0 nose
    s, k = scores[main], kps[main]
    # a keypoint counts only if it is confident AND inside the photo (DWPose also guesses
    # joints beyond the frame, e.g. hips under a collar close-up)
    inside = lambda i: bool(0 <= k[i][0] <= w and 0 <= k[i][1] <= 0.98 * h)  # noqa: E731
    vis = lambda i: bool(s[i] > KP_THR) and inside(i)  # noqa: E731
    shoulders, hips, knees = vis(5) and vis(6), vis(11) and vis(12), vis(13) and vis(14)
    shoulder_w = float(np.linalg.norm(k[5] - k[6])) if shoulders else 0.0
    torso_h = float(np.linalg.norm((k[5] + k[6]) / 2 - (k[11] + k[12]) / 2)) if shoulders and hips else 0.0
    second = heights[order[1]] / heights[main] if len(order) > 1 else 0.0
    pose = {"people": people, "person_height": round(heights[main], 3), "shoulders": shoulders, "hips": hips, "knees": knees,
            "face": vis(0) and vis(1) and vis(2), "frontal_ratio": round(shoulder_w / torso_h, 3) if torso_h else 0.0, "second_person": round(second, 3),
            "keypoints_visible": int(visible[main]),
            # facing the camera: the person's LEFT shoulder/hip appears on the RIGHT of the photo.
            # DWPose scores a "face" even on the back of a head, but it gets left/right right.
            "facing_front": bool(shoulders and k[5][0] > k[6][0] and (not hips or k[11][0] > k[12][0]))}
    return {**info, "kind": "worn", **pose}


def target_ok(p: dict, category: str):
    """The pose guardrails. Returns (ok, reason)."""
    if p["second_person"] > RULES["max_second_person"]:
        return False, "more than one person"
    if not (p["shoulders"] and p["hips"]):
        return False, "torso not visible"
    if category in ("bottoms", "one-pieces", "saree") and not p["knees"]:
        return False, "legs not visible"
    if p["frontal_ratio"] < RULES["min_shoulder_to_torso"]:
        return False, "not frontal"
    if not (p["face"] and p.get("facing_front")):
        return False, "back view or face cropped"
    if p["person_height"] < RULES["min_person_height"]:
        return False, "person too small"
    return True, ""


def garment_view_ok(p: dict) -> bool:
    """A worn photo used as the garment input must show the FRONT of the whole garment."""
    return p["shoulders"] and p["hips"] and p["face"] and p.get("facing_front", False) and p["frontal_ratio"] >= RULES["min_shoulder_to_torso"]


def quality(p: dict) -> float:
    return p.get("keypoints_visible", 0) / 17 + p.get("person_height", 0) + min(p.get("sharpness", 0), 400) / 400


# ---------- per-photo decisions, cached ----------
cache_file = os.path.join(a.out, "photos.jsonl")
cache = {}
if os.path.exists(cache_file):
    for line in open(cache_file):
        r = json.loads(line)
        cache[r["file"]] = r
cache_out = open(cache_file, "a")

qc = {"rules": RULES, "categories": {}, "started": time.strftime("%Y-%m-%d %H:%M"), "device": dev}
rows, sheet = [], []
seen_hash = {}
rng = random.Random(a.seed)
t0, analysed = time.time(), 0

for spec in a.categories.split(","):
    folder, cat = spec.split(":")
    path = os.path.join(src, folder, "details", "products_detail.jsonl")
    if not os.path.exists(path):
        print(f"skip {folder}: {path} not found")
        continue
    products = [json.loads(l) for l in open(path) if l.strip()]
    if a.limit:
        products = products[: a.limit]
    c = collections.Counter()
    reasons = collections.Counter()
    for prod in products:
        c["products"] += 1
        urls = prod.get("hires_images") or prod.get("images") or []
        on_disk = {image_id(u) for u in urls} & local.keys()
        if len(on_disk) < a.min_photos:
            # a pair needs two photos of the SAME product; most listings have only their main photo locally
            c[f"products with fewer than {a.min_photos} photos on disk"] += 1
            continue
        worn, flat, worn_any = [], [], []
        for url in urls:
            iid = image_id(url)
            if iid not in local:
                c["photos missing"] += 1
                continue
            f = local[iid]
            if f not in cache:
                cache[f] = {"file": f, **analyse(os.path.join(img_dir, f))}
                cache_out.write(json.dumps(cache[f]) + "\n")
                analysed += 1
                if analysed % 50 == 0:
                    cache_out.flush()
                    print(f"  {analysed} photos analysed, {time.time() - t0:.0f}s")
            p = cache[f]
            c[f"photos {p['kind']}"] += 1
            if p["kind"] == "rejected":
                reasons[p["reason"]] += 1
                continue
            owner = seen_hash.setdefault(p["hash"], prod["product_id"])
            if owner != prod["product_id"]:
                c["photos shared with another product"] += 1
                continue
            if p["kind"] == "worn":
                worn_any.append(p)
                ok, why = target_ok(p, cat)
                if not ok:
                    reasons[why] += 1
                (worn if ok else []).append(p)
                if not ok:
                    c["worn photos failing pose rules"] += 1
            else:
                flat.append(p)
        worn.sort(key=quality, reverse=True)
        flat.sort(key=lambda p: p.get("sharpness", 0), reverse=True)
        if not worn:
            c["products without a usable worn photo"] += 1
            continue
        if flat:
            garment, ptype = flat[0], "flat-lay"
        elif any(garment_view_ok(q) for q in worn if q is not worn[0]) or any(garment_view_ok(q) for q in worn_any if q is not worn[0]):
            garment = next(q for q in worn + worn_any if q is not worn[0] and garment_view_ok(q))
            ptype = "model"
        else:
            c["products with only one usable photo"] += 1
            continue
        family = prod.get("parent_asin") or prod["product_id"]
        split = "val" if int(hashlib.md5(family.encode()).hexdigest(), 16) % 1000 < a.val * 1000 else "train"
        rows.append({"id": f"{folder}-{prod['product_id']}", "person": os.path.join(img_dir, worn[0]["file"]),
                     "garment": os.path.join(img_dir, garment["file"]), "category": cat, "photo_type": ptype, "split": split,
                     "family": family, "price": prod.get("price_current"), "colour": (prod.get("attributes") or {}).get("Colour", "")})
        c[f"pairs {ptype}"] += 1
        c[f"pairs {split}"] += 1
    qc["categories"][folder] = {"fashn_category": cat, **dict(c), "rejections": dict(reasons)}
    print(folder, json.dumps(qc["categories"][folder]))

cache_out.close()
with open(os.path.join(a.out, "pairs.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["id", "person", "garment", "category", "photo_type", "split", "family", "price", "colour"])
    w.writeheader()
    w.writerows(rows)

tot = collections.Counter()
for v in qc["categories"].values():
    for k, n in v.items():
        if isinstance(n, int):
            tot[k] += n
qc["totals"] = dict(tot)
qc["pairs"] = len(rows)
qc["families"] = {"train": len({r["family"] for r in rows if r["split"] == "train"}), "val": len({r["family"] for r in rows if r["split"] == "val"})}
qc["leak_check"] = len({r["family"] for r in rows if r["split"] == "train"} & {r["family"] for r in rows if r["split"] == "val"})
qc["seconds"] = round(time.time() - t0, 1)
qc["photos_analysed_this_run"] = analysed
json.dump(qc, open(os.path.join(a.out, "qc.json"), "w"), indent=2)

# contact sheet: garment | worn target, for a few random pairs
if rows and a.sheet:
    pick = rng.sample(rows, min(a.sheet, len(rows)))
    tiles = []
    for r in pick:
        ims = [cv2.imread(r[k]) for k in ("garment", "person")]
        ims = [cv2.resize(im, (int(im.shape[1] * 360 / im.shape[0]), 360)) for im in ims]
        pair = np.concatenate([ims[0], np.full((360, 8, 3), 255, np.uint8), ims[1]], 1)
        pair = cv2.copyMakeBorder(pair, 0, 0, 0, max(0, 560 - pair.shape[1]), cv2.BORDER_CONSTANT, value=(255, 255, 255))[:, :560]
        tiles.append(pair)
    while len(tiles) % 4:
        tiles.append(np.full_like(tiles[0], 255))
    grid = np.concatenate([np.concatenate(tiles[i : i + 4], 1) for i in range(0, len(tiles), 4)], 0)
    cv2.imwrite(os.path.join(a.out, "pairs-sheet.jpg"), grid, [cv2.IMWRITE_JPEG_QUALITY, 88])

print(json.dumps({"pairs": len(rows), **qc["families"], "leak_check": qc["leak_check"], "seconds": qc["seconds"]}, indent=2))
