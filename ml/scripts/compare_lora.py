"""
Base FASHN VTON 1.5 vs base + our LoRA adapter: the numbers the report and the slides claim.

Reads what the other scripts already wrote and adds the statistics:

    runs/<name>/eval/eval.csv          evaluate.py  (per val sample: psnr, ssim, garment_l1, seconds)
    runs/<name>/train_summary.json     train_lora.py (params, time per step, peak GPU memory)
    runs/<name>/log.csv                train_lora.py (loss curve)
    runs/<name>/lora-best.safetensors  the adapter (its size)
    data/pairs/qc.json                 build_pairs.py (how the data was made)

For every metric: mean for each model, paired difference (LoRA − base) with a 95 %
bootstrap confidence interval (10,000 resamples of the val samples), the share of
samples where LoRA is better, and a two-sided Wilcoxon signed-rank test (exact for
n ≤ 20, normal approximation above). A claim is made only when the interval excludes 0
and p < 0.05.

    python scripts/compare_lora.py --run runs/indian-v1 [--qc data/pairs/qc.json] \
        --out ../docs/mini-project-report/results/lora_comparison.json
"""

import argparse
import csv
import itertools
import json
import math
import os
import random

ap = argparse.ArgumentParser()
ap.add_argument("--run", required=True)
ap.add_argument("--eval", help="defaults to <run>/eval")
ap.add_argument("--qc", default="data/pairs/qc.json")
ap.add_argument("--out", required=True)
ap.add_argument("--seed", type=int, default=0)
a = ap.parse_args()
ev = a.eval or os.path.join(a.run, "eval")

HIGHER_IS_BETTER = {"denoise_loss": False, "psnr": True, "ssim": True, "garment_l1": False, "pose_drift": False, "colour_de": False}

rows = list(csv.DictReader(open(os.path.join(ev, "eval.csv"))))
by = {}
for r in rows:
    by.setdefault(r["sample"], {})[r["model"]] = r
pairs = [v for v in by.values() if "base" in v and "lora" in v]
if not pairs:
    raise SystemExit("eval.csv has no sample scored by both models: run evaluate.py with --lora")
rng = random.Random(a.seed)


def wilcoxon(d):
    d = [x for x in d if x != 0]
    n = len(d)
    if n == 0:
        return 1.0
    ranks = sorted(range(n), key=lambda i: abs(d[i]))
    r = [0.0] * n
    i = 0
    while i < n:  # average ranks for ties
        j = i
        while j + 1 < n and abs(d[ranks[j + 1]]) == abs(d[ranks[i]]):
            j += 1
        for k in range(i, j + 1):
            r[ranks[k]] = (i + j) / 2 + 1
        i = j + 1
    w = sum(rk for rk, x in zip(r, d) if x > 0)
    if n <= 20:  # exact: every sign pattern (2^n of them)
        total, extreme = 0, 0
        obs = min(w, n * (n + 1) / 2 - w)
        for signs in itertools.product((0, 1), repeat=n):
            s = sum(rk for rk, sg in zip(r, signs) if sg)
            total += 1
            extreme += min(s, n * (n + 1) / 2 - s) <= obs + 1e-9
        return extreme / total
    mu, sd = n * (n + 1) / 4, math.sqrt(n * (n + 1) * (2 * n + 1) / 24)
    z = (w - mu) / sd
    return math.erfc(abs(z) / math.sqrt(2))


metrics = {}
for m, up in HIGHER_IS_BETTER.items():
    have = [p for p in pairs if p["base"].get(m, "") != "" and p["lora"].get(m, "") != ""]
    if len(have) < 2:
        continue
    base = [float(p["base"][m]) for p in have]
    lora = [float(p["lora"][m]) for p in have]
    d = [y - x for x, y in zip(base, lora)]
    boot = sorted(sum(rng.choice(d) for _ in d) / len(d) for _ in range(10000))
    lo, hi = boot[250], boot[9749]
    better = sum((x > 0) if up else (x < 0) for x in d)
    p_value = wilcoxon(d)
    # claim rule: the 95% interval excludes zero AND the paired Wilcoxon test is significant
    significant = (lo > 0 or hi < 0) and p_value < 0.05
    improved = significant and ((lo > 0) if up else (hi < 0))
    metrics[m] = {
        "base": round(sum(base) / len(base), 4), "lora": round(sum(lora) / len(lora), 4),
        "diff": round(sum(d) / len(d), 4), "ci95": [round(lo, 4), round(hi, 4)],
        "relative_percent": round(100 * (sum(d) / len(d)) / (sum(base) / len(base)), 2) if sum(base) else None,
        "lora_better_share": round(better / len(d), 3), "wilcoxon_p": round(p_value, 4),
        "higher_is_better": up, "verdict": "improved" if improved else ("worse" if significant else "no clear change"), "n": len(d),
    }

secs = {k: [float(p[k]["seconds"]) for p in pairs if p[k].get("seconds") not in ("", None)] for k in ("base", "lora")}
out = {
    "run": os.path.basename(os.path.normpath(a.run)),
    "n_val_samples": len(pairs),
    "metrics": metrics,
    "inference_seconds": {k: round(sum(v) / len(v), 2) if v else None for k, v in secs.items()},
}
ts = os.path.join(a.run, "train_summary.json")
if os.path.exists(ts):
    out["training"] = json.load(open(ts))
cfg = os.path.join(a.run, "config.json")
if os.path.exists(cfg):
    out["config"] = json.load(open(cfg))
for name in ("lora-best.safetensors", "lora.safetensors"):
    f = os.path.join(a.run, name)
    if os.path.exists(f):
        out["adapter_mb"] = round(os.path.getsize(f) / 2**20, 1)
        break
log = os.path.join(a.run, "log.csv")
if os.path.exists(log):
    out["curve"] = [{k: (float(v) if v not in ("", None) else None) for k, v in r.items()} for r in csv.DictReader(open(log))]
gr = os.path.join(ev, "guardrails.json")
if os.path.exists(gr):
    out["guardrails"] = json.load(open(gr))
sm = os.path.join(ev, "summary.json")
if os.path.exists(sm):
    out["eval_settings"] = json.load(open(sm)).get("settings")
if os.path.exists(a.qc):
    q = json.load(open(a.qc))
    out["data"] = {"pairs": q.get("pairs"), "families": q.get("families"), "leak_check": q.get("leak_check")}
out["sheets"] = sorted(f for f in os.listdir(ev) if f.endswith(".jpg"))[:6]

os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
json.dump(out, open(a.out, "w"), indent=2)
print(json.dumps({k: v for k, v in out.items() if k in ("n_val_samples", "metrics", "inference_seconds", "adapter_mb")}, indent=2))
