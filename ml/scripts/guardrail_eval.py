"""
Model-output guardrails and evals, run on evaluate.py's generated images.

For every generated held-out sample and for both models (base, base + LoRA) this scores:

  pose_drift   body keypoints (FASHN's own DWPose) of the output vs the REAL photo: mean
               distance of the keypoints visible in both, as a fraction of the image
               diagonal. Small = the person's pose and body were kept. Lower is better.
  colour_de    CIE76 ΔE between output and real photo, averaged over the garment's pixels
               (the garment mask from the prepared sample). Small = the product's colour is
               right. Lower is better.
  blank        output is (almost) one flat colour            -> guardrail FAIL
  unchanged    output (almost) equals the person input        -> guardrail FAIL
  guardrail    passes when none of the above fails and pose_drift <= 0.05 and colour_de <= 20

The scores are added as columns to eval.csv, so compare_lora.py reports them with
confidence intervals like the other metrics, and a pass-rate summary goes to guardrails.json.

    python scripts/guardrail_eval.py --data data/prepared --eval runs/laptop-v1/eval [--scale 0.5]
"""

import _common  # noqa: F401
import argparse
import csv
import json
import os

import cv2
import numpy as np
import torch

from haat_ft.data import PreparedDataset
from haat_ft.train import rescale

ap = argparse.ArgumentParser()
ap.add_argument("--data", required=True)
ap.add_argument("--eval", required=True)
ap.add_argument("--weights-dir", default="weights")
ap.add_argument("--scale", type=float, default=0.5)
a = ap.parse_args()

LIMITS = {"pose_drift": 0.05, "colour_de": 20.0, "blank_std": 6.0, "unchanged_mad": 3.0}

from fashn_vton.dwpose.onnxdet import inference_detector  # noqa: E402
from fashn_vton.dwpose.onnxpose import inference_pose  # noqa: E402
from fashn_vton.dwpose.wholebody import Wholebody  # noqa: E402

wb = Wholebody(os.path.join(a.weights_dir, "dwpose"), device="cpu")


def keypoints(bgr):
    boxes = inference_detector(wb.session_det, bgr)
    if boxes is None or len(boxes) == 0:
        return None
    kps, scores = inference_pose(wb.session_pose, boxes, bgr)
    i = int(np.argmax([(b[3] - b[1]) * (b[2] - b[0]) for b in boxes]))
    return kps[i][:17], scores[i][:17]


def to_bgr(t):
    """tensor (1,3,H,W) in [-1,1] -> uint8 BGR"""
    x = ((t[0].float().cpu().numpy().transpose(1, 2, 0) + 1) * 127.5).clip(0, 255).astype(np.uint8)
    return cv2.cvtColor(x, cv2.COLOR_RGB2BGR)


def lab(bgr):
    return cv2.cvtColor(bgr.astype(np.float32) / 255.0, cv2.COLOR_BGR2LAB)


data = PreparedDataset(a.data, "val")
names = {os.path.basename(f).removesuffix(".pt"): i for i, f in enumerate(data.files)}
rows = list(csv.DictReader(open(os.path.join(a.eval, "eval.csv"))))
summary = {}
for r in rows:
    for k in ("pose_drift", "colour_de", "guardrail"):
        r.setdefault(k, "")
    strip_file = os.path.join(a.eval, f"{r['sample']}.jpg")
    if r.get("psnr", "") == "" or not os.path.exists(strip_file):
        continue
    s = rescale({k: v[None] for k, v in data[names[r["sample"]]].items()}, a.scale)
    target, person_in = to_bgr(s["target"]), to_bgr(s["ca"])
    h, w = target.shape[:2]
    strip = cv2.imread(strip_file)
    panel = {"base": 3, "lora": 4}[r["model"]]
    out = strip[:h, panel * w : (panel + 1) * w]
    # the generated image can be the padded size; compare on the unpadded region
    weight = s["weight"][0, 0].numpy() > 0.5
    gmask = (s["garment_mask"][0, 0].numpy() > 0.5) & weight

    blank = float(out.reshape(-1, 3).std(0).mean()) < LIMITS["blank_std"]
    unchanged = float(np.abs(out.astype(np.float32) - person_in.astype(np.float32))[weight].mean()) < LIMITS["unchanged_mad"]
    kt, ko = keypoints(target), keypoints(out)
    if kt is None or ko is None:
        drift = 1.0
    else:
        vis = (kt[1] > 0.3) & (ko[1] > 0.3)
        drift = float(np.linalg.norm(kt[0][vis] - ko[0][vis], axis=1).mean() / np.hypot(h, w)) if vis.any() else 1.0
    de = float(np.linalg.norm(lab(out)[gmask] - lab(target)[gmask], axis=1).mean()) if gmask.any() else float("nan")
    ok = not blank and not unchanged and drift <= LIMITS["pose_drift"] and (de <= LIMITS["colour_de"])
    r.update({"pose_drift": round(drift, 4), "colour_de": round(de, 2), "guardrail": int(ok)})
    sm = summary.setdefault(r["model"], {"n": 0, "pass": 0, "blank": 0, "unchanged": 0, "pose_fail": 0, "colour_fail": 0})
    sm["n"] += 1
    sm["pass"] += ok
    sm["blank"] += blank
    sm["unchanged"] += unchanged
    sm["pose_fail"] += drift > LIMITS["pose_drift"]
    sm["colour_fail"] += de > LIMITS["colour_de"]
    print(r["sample"], r["model"], r["pose_drift"], r["colour_de"], "PASS" if ok else "FAIL", flush=True)

with open(os.path.join(a.eval, "eval.csv"), "w", newline="") as f:
    wr = csv.DictWriter(f, fieldnames=list(rows[0]))
    wr.writeheader()
    wr.writerows(rows)
for m in summary.values():
    m["pass_rate"] = round(m["pass"] / max(1, m["n"]), 3)
json.dump({"limits": LIMITS, "models": summary}, open(os.path.join(a.eval, "guardrails.json"), "w"), indent=2)
print(json.dumps(summary, indent=2))
