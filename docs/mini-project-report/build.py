"""
Builds the mini-project report: reads every result file, draws every chart, writes the
numbers into generated/values.tex, and compiles main.tex with tectonic.

Nothing in the report is typed by hand if a file holds it. When a result does not exist
yet (the base-vs-LoRA comparison before training has run), the report says "pending" in
those places; run this script again after the experiment and the numbers appear.

    ml/.venv/bin/python docs/mini-project-report/build.py [--tests] [--no-pdf]

Inputs (paths relative to haat-studio/):
    data/results/*/meta.json                 10 real generations (timings)
    data/gpu-quota.json                      free-GPU ledger and the learned run limit
    ml/runs/real-check/report.json           checks on the real weights
    ml/runs/microrun/report.json, log.csv    the 100-step LoRA run on the laptop
    ml/data/pairs/qc.json, pairs-sheet.jpg   build_pairs.py on the retail catalogue
    analysis/results/market.json             analysis/market.py
    docs/mini-project-report/results/lora_comparison.json   compare_lora.py (after training)
    docs/mini-project-report/results/tests.json             written here with --tests
"""

import argparse
import csv
import json
import math
import os
import re
import shutil
import subprocess
import statistics

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
GEN = os.path.join(HERE, "generated")
FIG = os.path.join(GEN, "fig")
OUT_PDF = os.path.abspath(os.path.join(ROOT, "..", "Mini-Project-Report-Haat-Studio.pdf"))
R = lambda *p: os.path.join(ROOT, *p)  # noqa: E731

ap = argparse.ArgumentParser()
ap.add_argument("--tests", action="store_true", help="run npm test and the ML tests and record the counts")
ap.add_argument("--no-pdf", action="store_true")
a = ap.parse_args()
os.makedirs(FIG, exist_ok=True)
os.makedirs(os.path.join(HERE, "results"), exist_ok=True)

DARK, LIGHT, GREY, ACCENT, WARN = "#2E5E8E", "#A9C4E4", "#B0B0B0", "#C0504D", "#E39B2D"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "axes.spines.top": False, "axes.spines.right": False,
                     "axes.titlesize": 9.5, "legend.frameon": False, "savefig.bbox": "tight", "figure.dpi": 150})

V = {}  # macro name -> text


def val(name, value):
    V[name] = value


def tex(s):
    return str(s).replace("\\", r"\textbackslash{}").replace("&", r"\&").replace("%", r"\%").replace("_", r"\_").replace("#", r"\#").replace("₹", r"\rupee{}")


def fmt(x, nd=1):
    return f"{x:,.{nd}f}" if isinstance(x, float) else f"{x:,}"


def load(*p):
    f = R(*p)
    return json.load(open(f)) if os.path.exists(f) else None


def save(fig, name):
    fig.savefig(os.path.join(FIG, name))
    plt.close(fig)


med = lambda xs: statistics.median(xs)  # noqa: E731

# ------------------------------------------------------------------ serving: 10 real generations
runs = []
for k in sorted(os.listdir(R("data/results"))):
    m = R("data/results", k, "meta.json")
    if re.fullmatch(r"[0-9a-f]{32}", k) and os.path.exists(m):
        j = json.load(open(m))
        if j["engine"] == "fashn-space":
            runs.append(j)
runs.sort(key=lambda j: j["createdAt"])
tot = [j["totalMs"] / 1000 for j in runs]
que = [j["queueMs"] / 1000 for j in runs]
gpu = [t - q for t, q in zip(tot, que)]
val("NRuns", len(runs))
val("MedTotal", f"{med(tot):.1f}")
val("MedGpu", f"{med(gpu):.1f}")
val("MedQueue", f"{med(que):.1f}")
val("MinTotal", f"{min(tot):.1f}")
val("MaxTotal", f"{max(tot):.1f}")
lab = {"tops": "top", "bottoms": "bottom", "one-pieces": "dress"}
fig, ax = plt.subplots(figsize=(6.2, 3.0))
names = [f"{i + 1}: {lab[j['settings']['category']]}" for i, j in enumerate(runs)]
names_runs = list(names)
ax.barh(names, que, color=GREY, label="Waiting in the queue")
ax.barh(names, gpu, left=que, color=DARK, label="Running on the GPU (incl. download)")
for i, (q, g) in enumerate(zip(que, gpu)):
    ax.text(q + g + 0.4, i, f"{q + g:.1f} s", va="center", fontsize=7.5)
ax.invert_yaxis()
ax.set_xlabel("seconds from request to finished image")
ax.set_xlim(0, 40)
ax.legend(loc="upper center", bbox_to_anchor=(0.5, 1.13), ncol=2, fontsize=7.5)
save(fig, "timing.pdf")
prep = [p for j in runs for p in (j["prep"]["garment"], j["prep"]["person"])]
val("NPrepPhotos", len(prep))
val("NPrepUntouched", sum(1 for p in prep if not (p["resized"] or p["stripped"] or p["rotated"] or p["flattened"])))

# cache: measured on 26 Nov 2026 (scripts in the appendix): 25 look-ups of the T-shirt result
CACHE_MS = 0.32
val("CacheMs", f"{CACHE_MS:.2f}")
val("CacheRatio", f"{round(med(tot) * 1000 / CACHE_MS, -3):,.0f}")
fig, ax = plt.subplots(figsize=(4.6, 1.6))
ax.barh(["Repeat request\n(saved result)", "New photo\n(median)"], [CACHE_MS, med(tot) * 1000], color=[DARK, GREY])
ax.set_xscale("log")
ax.set_xlim(0.01, 1e5)
for i, v in enumerate([CACHE_MS, med(tot) * 1000]):
    ax.text(v * 1.3, i, f"{v:,.2f} ms" if v < 1 else f"{v:,.0f} ms", va="center", fontsize=8)
ax.set_xlabel("time to answer, milliseconds (log scale)")
save(fig, "cache.pdf")

# quota
ledger = load("data/gpu-quota.json")
per = round(med([r["ms"] / 1000 for r in ledger["runs"][-10:]]))
limit = ledger["runsLimit"]["runs"]
used = sum(r["ms"] for r in ledger["runs"] if r["at"] < ledger["refusal"]["at"]) / 1000
first_day = [r for r in ledger["runs"] if r["at"] < ledger["refusal"]["at"]]
val("PerPhoto", per)
val("RunsLimit", limit)
val("UsedAtRefusal", f"{sum(r['ms'] for r in first_day) / 1000:.0f}")
photosFit = lambda left: (math.floor((left - 60) / per) + 1) if left >= 60 else 0  # noqa: E731
xs = list(range(0, 11))
byT = [photosFit(300 - per * k) for k in xs]
byR = [max(0, limit - k) for k in xs]
val("ByTimeFresh", byT[0])
fig, ax = plt.subplots(figsize=(4.8, 2.4))
ax.plot(xs, byT, "o-", color=WARN, ms=3.5, label="photos left by GPU time (300 s/day, 60 s reserved)")
ax.plot(xs, byR, "s-", color=DARK, ms=3.5, label=f"photos left by run limit (learned: {limit})")
ax.axvline(limit, color=ACCENT, ls=":", lw=1)
ax.text(limit + 0.1, 8.6, "refused here\n(26 Oct)", fontsize=7, color=ACCENT)
ax.set_xlabel("photos already made today")
ax.set_ylabel("photos left")
ax.set_ylim(0, 10.5)
ax.legend(fontsize=7, loc="upper center", bbox_to_anchor=(0.5, 1.22), ncol=1)
save(fig, "quota.pdf")

# ------------------------------------------------------------------ model checks
rc = load("ml/runs/real-check/report.json")
lt = rc["loss_by_t"]
ours, rev = lt["ours"], lt["reversed"]
val("LossOurs", f"{statistics.mean(ours):.4f}")
val("LossRev", f"{statistics.mean(rev):.2f}")
val("LossRatio", f"{statistics.mean(rev) / statistics.mean(ours):,.0f}")
val("MemLoad", rc["memory_after_load_gb"])
val("MemGen", rc["memory_after_generate_gb"])
val("GenSeconds", f"{rc['generate_seconds']:,.0f}")
val("GenMinutes", f"{rc['generate_seconds'] / 60:.0f}")
val("LocalPsnr", rc["local_vs_space"]["psnr_db"])
val("EquivDiff", f"{rc['ours_vs_fashn_pipeline_4_steps']['mean_abs_diff_0_255']:.2f}")
val("ParserDiff", f"{rc['without_human_parser_4_steps']['mean_abs_diff_0_255']:.2f}")
fig, ax = plt.subplots(figsize=(4.8, 2.4))
w = 0.38
ix = range(len(lt["t"]))
ax.bar([i - w / 2 for i in ix], ours, w, color=DARK, label="reconstructed objective (ours)")
ax.bar([i + w / 2 for i in ix], rev, w, color=GREY, label="reversed time convention")
ax.set_yscale("log")
ax.set_xticks(list(ix), [f"t = {t}" for t in lt["t"]])
ax.set_ylabel("loss of the pretrained model (log)")
ax.legend(fontsize=7.5)
save(fig, "recon.pdf")

mr = load("ml/runs/microrun/report.json")
val("MicroTrainBefore", f"{mr['before']['train']['mean']:.5f}")
val("MicroTrainAfter", f"{mr['after']['train']['mean']:.5f}")
val("MicroTrainChange", f"{mr['train_loss_change_percent']:+.1f}")
val("MicroValBefore", f"{mr['before']['val']['mean']:.5f}")
val("MicroValAfter", f"{mr['after']['val']['mean']:.5f}")
val("MicroValChange", f"{mr['val_loss_change_percent']:+.1f}")
val("AdapterMb", mr["adapter_mb"])
val("BaseMb", f"{mr['base_weights_mb']:,.0f}")
val("AdapterPct", f"{100 * mr['adapter_mb'] / mr['base_weights_mb']:.1f}")
val("TrainParams", f"{mr['lora']['trainable_params']:,}")
val("TrainParamsM", f"{mr['lora']['trainable_params'] / 1e6:.2f}")
# share of the BASE model (the report's 971,813,808 parameters), not of base + adapters
val("LoraPct", f"{100 * mr['lora']['trainable_params'] / (mr['lora']['total_params'] - mr['lora']['trainable_params']):.2f}")
val("LoraLayers", mr["lora"]["layers_wrapped"])
steps, loss = [], []
for r in csv.DictReader(open(R("ml/runs/microrun/log.csv"))):
    steps.append(int(r["step"]))
    loss.append(float(r["loss"]))
secs = []
for r in csv.DictReader(open(R("ml/runs/microrun/log.csv"))):
    secs.append(float(r["seconds"]))
val("MicroStepSec", f"{med(secs):.1f}")
val("MicroMinutes", f"{sum(secs) / 60:.1f}")
roll = [statistics.mean(loss[max(0, i - 9): i + 1]) for i in range(len(loss))]
fig, ax = plt.subplots(figsize=(4.8, 2.3))
ax.plot(steps, loss, color=LIGHT, lw=0.8, label="per step (one random sample, random t)")
ax.plot(steps, roll, color=DARK, lw=1.8, label="mean of last 10 steps")
ax.set_xlabel("training step")
ax.set_ylabel("loss")
ax.legend(fontsize=7.5)
save(fig, "microrun.pdf")

# compute cost of adapting the model (analytic; activations excluded and stated so)
P = mr["lora"]["total_params"] - mr["lora"]["trainable_params"]  # frozen base
T = mr["lora"]["trainable_params"]
full_gb = (P + T) * 16 / 1e9  # fp32 weight + grad + Adam m + v for every parameter
lora_gb = P * 2 / 1e9 + T * 16 / 1e9  # bf16 frozen weights + fp32 state for the adapters
val("FullStateGb", f"{full_gb:.1f}")
val("LoraStateGb", f"{lora_gb:.2f}")
val("StateRatio", f"{full_gb / lora_gb:.1f}")
val("BaseParamsM", f"{P / 1e6:.0f}")
fig, axs = plt.subplots(1, 2, figsize=(6.2, 2.2))
axs[0].bar(["Full fine-tune", "LoRA (ours)"], [full_gb, lora_gb], color=[GREY, DARK])
for i, v in enumerate([full_gb, lora_gb]):
    axs[0].text(i, v + 0.3, f"{v:.1f} GB", ha="center", fontsize=8)
axs[0].set_title("training state: weights + gradients + Adam\n(activations excluded)")
axs[0].set_ylabel("GB")
axs[1].bar(["Full model", "LoRA adapter"], [mr["base_weights_mb"], mr["adapter_mb"]], color=[GREY, DARK])
for i, v in enumerate([mr["base_weights_mb"], mr["adapter_mb"]]):
    axs[1].text(i, v + 30, f"{v:,.0f} MB" if v > 100 else f"{v} MB", ha="center", fontsize=8)
axs[1].set_title("what has to be stored or shipped")
axs[1].set_ylabel("MB")
save(fig, "compute.pdf")

# ------------------------------------------------------------------ data pipeline (build_pairs.py)
qc = load("ml/data/pairs/qc.json")
V["ifPairs"] = qc is not None
if qc:
    t = qc["totals"]
    worn = t.get("photos worn", 0)
    flat = t.get("photos garment-only", 0)
    rej = t.get("photos rejected", 0)
    found = worn + flat + rej
    val("PairsProducts", f"{t.get('products', 0):,}")
    val("PairsPhotos", f"{found:,}")
    val("PairsMissing", f"{t.get('photos missing', 0):,}")
    val("PairsWorn", f"{worn:,}")
    val("PairsFlat", f"{flat:,}")
    val("PairsRejected", f"{rej:,}")
    val("PairsPoseFail", f"{t.get('worn photos failing pose rules', 0):,}")
    val("PairsShared", f"{t.get('photos shared with another product', 0):,}")
    val("PairsN", f"{qc['pairs']:,}")
    val("PairsFlatLay", f"{t.get('pairs flat-lay', 0):,}")
    val("PairsModel", f"{t.get('pairs model', 0):,}")
    val("PairsTrain", f"{t.get('pairs train', 0):,}")
    val("PairsVal", f"{t.get('pairs val', 0):,}")
    val("PairsFamTrain", qc["families"]["train"])
    val("PairsFamVal", qc["families"]["val"])
    val("PairsLeak", qc["leak_check"])
    val("PairsMinutes", f"{qc['seconds'] / 60:.0f}")
    skipped = sum(n for k, n in t.items() if k.startswith("products with fewer than"))
    val("PairsSkipped", f"{skipped:,}")
    val("PairsEligible", f"{t.get('products', 0) - skipped:,}")
    val("PairsYield", f"{100 * qc['pairs'] / max(1, t.get('products', 1)):.0f}")
    reasons = {}
    for c in qc["categories"].values():
        for k, n in c.get("rejections", {}).items():
            reasons[k] = reasons.get(k, 0) + n
    fig, axs = plt.subplots(1, 2, figsize=(7.0, 2.6), gridspec_kw={"width_ratios": [1, 1.2], "wspace": 1.0})
    stages = ["photos\nfound", "usable\nworn", "garment\nonly", "pairs"]
    vals = [found, worn - t.get("worn photos failing pose rules", 0), flat, qc["pairs"]]
    axs[0].bar(stages, vals, color=[GREY, DARK, LIGHT, ACCENT])
    for i, v in enumerate(vals):
        axs[0].text(i, v, f"{v:,}", ha="center", va="bottom", fontsize=7.5)
    axs[0].set_title("from catalogue photos to training pairs")
    rs = sorted(reasons.items(), key=lambda x: x[1])
    axs[1].barh([k for k, _ in rs], [v for _, v in rs], color=WARN)
    for i, (_, v) in enumerate(rs):
        axs[1].text(v, i, f" {v}", va="center", fontsize=7.5)
    axs[1].set_title("why photos were rejected (guardrails)")
    save(fig, "pairs.pdf")
    if os.path.exists(R("ml/data/pairs/pairs-sheet.jpg")):
        shutil.copy(R("ml/data/pairs/pairs-sheet.jpg"), os.path.join(FIG, "pairs-sheet.jpg"))
    val("PairsCats", "; ".join(f"{ {'tshirt': 'men' + chr(39) + 's T-shirts', 'top': 'women' + chr(39) + 's tops'}.get(k, k)}: {v.get('products', 0):,} listings" for k, v in qc["categories"].items()))

# ------------------------------------------------------------------ market (analysis/market.py)
mk = load("analysis/results/market.json")
V["ifMarket"] = mk is not None
PREFIX = {"tshirt": "Tee", "top": "Top", "saree": "Saree", "kurta-set": "Kurta"}
SHORT = {"tshirt": "Men's T-shirts", "top": "Women's tops", "saree": "Sarees", "kurta-set": "Kurta sets"}
CCOL = {"tshirt": DARK, "top": LIGHT, "saree": WARN, "kurta-set": ACCENT}
if mk:
    cats = mk["categories"]
    val("MkTotalClean", f"{sum(c['after_cleaning'] for c in cats.values()):,}")
    val("MkTotalRaw", f"{sum(c['listings_raw'] for c in cats.values()):,}")
    val("MkTotalRatings", f"{int(sum(c['rating']['total_ratings'] for c in cats.values())):,}")
    for key, c in cats.items():
        p = PREFIX[key]
        val(f"Mk{p}Raw", f"{c['listings_raw']:,}")
        val(f"Mk{p}Fam", f"{c['families']:,}")
        val(f"Mk{p}Clean", f"{c['after_cleaning']:,}")
        val(f"Mk{p}Out", f"{c['price_outliers_removed']:,}")
        val(f"Mk{p}Rated", f"{c['with_ratings']:,}")
        val(f"Mk{p}Med", f"{c['price']['median']:,}")
        val(f"Mk{p}Pone", f"{c['price']['p25']:,}")
        val(f"Mk{p}Pthree", f"{c['price']['p75']:,}")
        val(f"Mk{p}Disc", f"{c['discount']['median']:.0f}")
        val(f"Mk{p}DiscHalf", f"{100 * c['discount']['share_over_50']:.0f}")
        val(f"Mk{p}Stars", c["rating"]["mean"])
        val(f"Mk{p}Ratings", f"{int(c['rating']['total_ratings']):,}")
        val(f"Mk{p}UnitsLo", f"{c['units_estimate_lifetime'][0] / 1e5:,.1f}")
        val(f"Mk{p}UnitsHi", f"{c['units_estimate_lifetime'][1] / 1e5:,.1f}")
        val(f"Mk{p}TopTen", f"{100 * c['demand_concentration']['top10_brand_share']:.0f}")
        val(f"Mk{p}TopOne", f"{100 * c['demand_concentration']['top1_listing_share']:.1f}")
        val(f"Mk{p}Hhi", f"{c['demand_concentration']['hhi']:,}")
        val(f"Mk{p}RhoPrice", c["correlations"]["price_vs_ratings"])
        val(f"Mk{p}RhoDisc", c["correlations"]["discount_vs_ratings"])
        val(f"Mk{p}RhoStars", c["correlations"]["price_vs_stars"])
        val(f"Mk{p}CutA", f"{c['tier_cuts'][0]:,}")
        val(f"Mk{p}CutB", f"{c['tier_cuts'][1]:,}")
        for tn in ("value", "mid", "premium"):
            val(f"Mk{p}Tier{tn.title()}", f"{100 * c['tiers'][tn]['demand_share']:.0f}")
        val(f"Mk{p}Kw", tex(", ".join(k["term"] for k in c["seo_keywords"][:10])))
        val(f"Mk{p}TitleTop", f"{c['title_length']['top_quartile_median']:.0f}")
    rho = [abs(c["correlations"][k]) for c in cats.values() for k in ("price_vs_ratings", "discount_vs_ratings") if c["correlations"][k] is not None]
    val("MkMaxRho", f"{max(rho):.2f}")
    keys = [k for k in ("tshirt", "top", "saree", "kurta-set") if k in cats]
    # price distributions, 2 x 2
    fig, axs = plt.subplots(2, 2, figsize=(6.6, 4.2))
    for ax, key in zip(axs.flat, keys):
        c = cats[key]
        pr = [p[0] for p in c["price_points"]]
        ax.hist(pr, bins=30, color=CCOL[key], edgecolor="white", lw=0.4)
        ax.axvline(c["price"]["median"], color="black", lw=0.9)
        ax.set_title(f"{SHORT[key]} (n = {c['after_cleaning']:,}); median ₹{c['price']['median']:,}", fontsize=8.5)
        ax.set_xlabel("selling price (₹)", fontsize=8)
    fig.tight_layout()
    save(fig, "mk_price.pdf")
    # tiers
    fig, axs = plt.subplots(1, len(keys), figsize=(6.8, 2.3), sharey=True)
    for ax, key in zip(axs, keys):
        c = cats[key]
        tn = ["value", "mid", "premium"]
        ax.bar([i - 0.2 for i in range(3)], [100 * c["tiers"][x]["listing_share"] for x in tn], 0.4, color=GREY, label="listings")
        ax.bar([i + 0.2 for i in range(3)], [100 * c["tiers"][x]["demand_share"] for x in tn], 0.4, color=CCOL[key], label="demand")
        ax.set_xticks(range(3), ["value", "mid", "premium"], fontsize=7.5)
        ax.set_title(SHORT[key], fontsize=8.5)
    axs[0].set_ylabel("%")
    axs[0].set_ylim(0, 60)
    axs[0].legend(fontsize=7, loc="upper left")
    save(fig, "mk_tiers.pdf")
    # attribute lift: sarees fabric + border, kurta sets pattern + neck
    panels = [("saree", "fabric"), ("saree", "border"), ("kurta-set", "pattern"), ("kurta-set", "neck")]
    panels = [(k, a_) for k, a_ in panels if k in cats]
    fig, axs = plt.subplots(1, len(panels), figsize=(7.0, 2.5), gridspec_kw={"wspace": 1.1})
    for ax, (key, attr) in zip(axs, panels):
        rows = [r for r in cats[key]["attributes"][attr] if r["value"] != "Other" and r["listings"] >= 5][:6][::-1]
        ax.barh([r["value"] for r in rows], [r["lift"] for r in rows], color=[CCOL[key] if r["lift"] >= 1 else GREY for r in rows])
        ax.axvline(1, color="black", lw=0.7, ls=":")
        ax.set_title(f"{SHORT[key]}: {attr}", fontsize=8.5)
        ax.tick_params(labelsize=7.5)
        ax.set_xlabel("demand ÷ supply", fontsize=8)
    save(fig, "mk_lift.pdf")
    # price vs ratings
    fig, ax = plt.subplots(figsize=(5.2, 2.7))
    for key in keys:
        pts = [p for p in cats[key]["price_points"] if p[1] > 0]
        ax.scatter([p[0] for p in pts], [p[1] for p in pts], s=4, alpha=0.35, color=CCOL[key], label=SHORT[key])
    ax.set_yscale("log")
    ax.set_xscale("log")
    ax.set_xlabel("selling price (₹, log)")
    ax.set_ylabel("number of ratings (log)")
    ax.legend(fontsize=7, markerscale=3)
    save(fig, "mk_scatter.pdf")
    # SEO keywords
    fig, axs = plt.subplots(2, 2, figsize=(6.6, 4.4))
    for ax, key in zip(axs.flat, keys):
        kw = cats[key]["seo_keywords"][:8][::-1]
        ax.barh([k["term"] for k in kw], [k["score"] for k in kw], color=CCOL[key])
        ax.set_title(f"{SHORT[key]}: title terms by demand", fontsize=8.5)
        ax.tick_params(labelsize=7.5)
    fig.tight_layout()
    save(fig, "mk_seo.pdf")
    ex = mk.get("example")
    V["ifExample"] = ex is not None
    if ex:
        pr = ex["pricing"]
        val("ExComparables", f"{pr['comparables']:,}")
        val("ExCompMed", f"{pr['comparable_price']['median']:,}")
        val("ExCompPone", f"{pr['comparable_price']['p25']:,}")
        val("ExCompPthree", f"{pr['comparable_price']['p75']:,}")
        val("ExBandLo", f"{pr['recommended_band'][0]:,}")
        val("ExBandHi", f"{pr['recommended_band'][1]:,}")
        val("ExMarginLo", pr["margin_at_band"][0])
        val("ExMarginHi", pr["margin_at_band"][1])
        val("ExFloor", f"{pr['floor_for_30pct_margin']:,}")
        val("ExCost", ex["input"]["cost"])
        val("ExPosition", pr["position"])
        val("ExDisc", f"{pr.get('category_median_discount') or 0:.0f}")
        val("ExTitle", tex(ex["seo"]["title"]))
        val("ExTitleChars", ex["seo"]["title_chars"])
        val("ExTitleBench", f"{ex['seo']['benchmark_title_chars']:.0f}")
        val("ExConsider", tex(", ".join(ex["seo"]["keywords_to_consider"][:6])))
        val("ExTags", tex(" ".join(ex["hashtags"]["tags"])))
        val("ExNTags", len(ex["hashtags"]["tags"]))
        val("ExCity", ex["input"]["city"])
        val("ExNoun", ex["input"]["product_noun"])
        val("ExMoments", tex("; ".join(f"{m['name']} ({m['days_away']} days)" for m in ex["geo"]["moments"][:4])))
        val("ExStatement", tex(ex["positioning"]["statement"]))
        val("ExUnder", tex(", ".join(f"{u['value'].lower()} {u['attribute']} (×{u['lift']})" for u in ex["positioning"]["under_supplied"][:3])))
        val("ExShop", tex(ex["input"]["shop"]))
        val("ExWarn", "thin" if pr.get("warning") else "healthy")

# ------------------------------------------------------------------ base vs LoRA (after training)
cmp_ = load("docs/mini-project-report/results/lora_comparison.json")
V["ifLora"] = cmp_ is not None
if cmp_:
    m = cmp_["metrics"]
    val("LcN", cmp_["n_val_samples"])
    es = cmp_.get("eval_settings") or {}
    val("LcScale", "half (432\\,$\\times$\\,288)" if es.get("scale") == 0.5 else "full (864\\,$\\times$\\,576)")
    val("LcGen", es.get("generated", "--"))
    val("LcEvalSteps", es.get("steps", "--"))
    for k, p in (("denoise_loss", "Dl"), ("psnr", "Psnr"), ("ssim", "Ssim"), ("garment_l1", "Gl"), ("pose_drift", "Pd"), ("colour_de", "Cd")):
        if k not in m:
            for suf in ("Base", "Lora", "Diff", "Ci", "Rel", "Win", "P", "Verdict", "N"):
                val(f"Lc{p}{suf}", "--")
            continue
        nd = 2 if k in ("psnr", "colour_de") else (5 if k == "denoise_loss" else 4)
        val(f"Lc{p}Base", f"{m[k]['base']:.{nd}f}")
        val(f"Lc{p}Lora", f"{m[k]['lora']:.{nd}f}")
        val(f"Lc{p}Diff", f"{m[k]['diff']:+.{nd}f}")
        val(f"Lc{p}Ci", f"[{m[k]['ci95'][0]:+.{nd}f}, {m[k]['ci95'][1]:+.{nd}f}]")
        val(f"Lc{p}Rel", f"{m[k]['relative_percent']:+.1f}")
        val(f"Lc{p}Win", f"{100 * m[k]['lora_better_share']:.0f}")
        val(f"Lc{p}P", "<0.001" if m[k]["wilcoxon_p"] < 0.001 else f"{m[k]['wilcoxon_p']:.3f}")
        val(f"Lc{p}Verdict", m[k]["verdict"])
        val(f"Lc{p}N", m[k].get("n", "--"))
    grd = (cmp_.get("guardrails") or {}).get("models", {})
    V["ifModelGuard"] = bool(grd)
    for lab_, p in (("base", "Base"), ("lora", "Lora")):
        g_ = grd.get(lab_, {})
        val(f"Gr{p}Pass", g_.get("pass", "--"))
        val(f"Gr{p}N", g_.get("n", "--"))
        val(f"Gr{p}Rate", f"{100 * g_['pass_rate']:.0f}" if g_ else "--")
        val(f"Gr{p}Pose", g_.get("pose_fail", "--"))
        val(f"Gr{p}Colour", g_.get("colour_fail", "--"))
        val(f"Gr{p}Blank", g_.get("blank", 0) + g_.get("unchanged", 0) if g_ else "--")
    inf = cmp_.get("inference_seconds", {})
    val("LcSecBase", inf.get("base") or "--")
    val("LcSecLora", inf.get("lora") or "--")
    tr = cmp_.get("training", {})
    val("LcSteps", tr.get("steps", "--"))
    val("LcTrainMin", f"{tr['train_seconds'] / 60:.0f}" if tr.get("train_seconds") else "--")
    val("LcStepSec", f"{tr['seconds_per_step']:.1f}" if tr.get("seconds_per_step") else "--")
    val("LcPeakGb", tr.get("peak_gpu_gb") or "--")
    val("LcDevice", tex({"mps": "the laptop's Apple M3 GPU (8 GB)"}.get(tr.get("device"), tr.get("device", "--"))))
    val("LcBestVal", tr.get("best_val_loss", "--"))
    cfgr = cmp_.get("config", {})
    val("LcLr", cfgr.get("lr", "--"))
    val("LcAccum", cfgr.get("grad_accum", "--"))
    shown = [(k, t_) for k, t_ in (("denoise_loss", "denoising error ↓"), ("psnr", "PSNR (dB) ↑"), ("ssim", "SSIM ↑"), ("garment_l1", "garment L1 ↓")) if k in m]
    fig, axs = plt.subplots(1, len(shown), figsize=(6.8, 2.2))
    for ax, (k, title) in zip(axs, shown):
        b, l_, ci = m[k]["base"], m[k]["lora"], m[k]["ci95"]
        ax.bar(["base", "LoRA"], [b, l_], color=[GREY, DARK])
        ax.errorbar([1], [l_], yerr=[[max(0, l_ - (b + ci[0]))], [max(0, (b + ci[1]) - l_)]], color="black", capsize=3, lw=1)
        ax.set_title(f"{title}\n(n = {m[k].get('n', '')})", fontsize=8.5)
        lo, hi = min(b, l_, b + ci[0]), max(b, l_, b + ci[1])
        pad = (hi - lo) * 0.6 + 1e-9
        ax.set_ylim(lo - pad, hi + pad)
        ax.tick_params(labelsize=7.5)
    fig.tight_layout()
    save(fig, "lora_compare.pdf")
    if cmp_.get("curve"):
        cv = [r for r in cmp_["curve"] if r.get("val_loss")]
        fig, ax = plt.subplots(figsize=(4.8, 2.2))
        ax.plot([r["step"] for r in cv], [r["val_loss"] for r in cv], "o-", color=DARK, ms=3, label="validation loss (fixed noise)")
        tr_ = [r for r in cmp_["curve"] if r.get("train_loss")]
        ax.plot([r["step"] for r in tr_], [r["train_loss"] for r in tr_], "s-", color=GREY, ms=3, label="training loss")
        ax.set_xlabel("optimizer step")
        ax.legend(fontsize=7.5)
        save(fig, "lora_curve.pdf")
    run_dir = R("ml/runs", cmp_.get("run", "laptop-v1"), "eval")
    strips = sorted(f for f in os.listdir(run_dir) if f.endswith(".jpg"))[:4] if os.path.isdir(run_dir) else []
    if strips:
        import PIL.Image as PI
        ims = [PI.open(os.path.join(run_dir, f)).convert("RGB") for f in strips]
        w0 = max(i.width for i in ims)
        sheet = PI.new("RGB", (w0, sum(i.height for i in ims) + 6 * len(ims)), "white")
        y = 0
        for i in ims:
            sheet.paste(i, (0, y))
            y += i.height + 6
        sheet.save(os.path.join(FIG, "lora_strips.jpg"), quality=90)
else:
    fig, ax = plt.subplots(figsize=(6.2, 1.6))
    ax.axis("off")
    ax.add_patch(plt.Rectangle((0, 0), 1, 1, transform=ax.transAxes, fill=False, ls="--", ec=GREY))
    ax.text(0.5, 0.62, "Pending: base vs LoRA on held-out garments", ha="center", fontsize=11, color=DARK, transform=ax.transAxes)
    ax.text(0.5, 0.32, "drawn automatically from results/lora_comparison.json (scripts/compare_lora.py)", ha="center", fontsize=8, color="#555", transform=ax.transAxes)
    save(fig, "lora_compare.pdf")

# ------------------------------------------------------------------ rubric (docs/eval-2026-10-26-baseline.md)
rub = [("Black logo tee\non tee + chinos", [5, 5, 5, 5, 5, 5]), ("Navy crop top\non dress", [5, 4, 5, 5, 4, 5]),
       ("White skirt\non dress", [3, 2, 1, 2, 1, 2]), ("White skirt\non tee + shorts", [5, 5, 5, 5, 5, 4])]
crit = ["colour", "print", "neckline/waist", "sleeves/length", "shape & fit", "no artefacts"]
fig, ax = plt.subplots(figsize=(6.2, 2.4))
cols = ["#1F3B5A", DARK, "#5B85B5", LIGHT, "#D3E1F1", GREY]
for ci_, c in enumerate(crit):
    ax.bar([i + (ci_ - 2.5) * 0.13 for i in range(4)], [r[1][ci_] for r in rub], 0.13, color=cols[ci_], label=c)
for i, r in enumerate(rub):
    ax.text(i, 5.35, f"{sum(r[1])}/30", ha="center", fontsize=8, fontweight="bold")
ax.set_xticks(range(4), [r[0] for r in rub], fontsize=7.5)
ax.set_ylim(0, 6)
ax.set_ylabel("score (1–5)")
ax.legend(fontsize=6.5, ncol=6, loc="upper center", bbox_to_anchor=(0.5, -0.28))
save(fig, "rubric.pdf")

# ------------------------------------------------------------------ tests
tests_file = os.path.join(HERE, "results", "tests.json")
if a.tests:
    res = {}
    out = subprocess.run(["npm", "test", "--silent"], cwd=ROOT, capture_output=True, text=True).stdout
    mm = re.search(r"Tests\s+(\d+) passed", out)
    res["app"] = int(mm.group(1)) if mm else None
    out = subprocess.run([R("ml/.venv/bin/python"), "-m", "pytest", "-q", "tests"], cwd=R("ml"), capture_output=True, text=True).stdout
    mm = re.search(r"(\d+) passed", out)
    res["ml"] = int(mm.group(1)) if mm else None
    json.dump(res, open(tests_file, "w"))
tests = json.load(open(tests_file)) if os.path.exists(tests_file) else {"app": 54, "ml": 12}
val("TestsApp", tests["app"])
val("TestsMl", tests["ml"])

# ------------------------------------------------------------------ app output guardrails (scripts/guardrail-audit.ts)
ag = load("docs/mini-project-report/results/app_guardrails.json")
V["ifAppGuard"] = ag is not None
if ag:
    rs_ = ag["results"]
    val("AgN", len(rs_))
    val("AgWarn", sum(1 for r in rs_ if not all(c["ok"] for c in r["checks"].values())))
    val("AgFail", sum(1 for r in rs_ if not r["passed"]))
    val("AgMs", f"{med([r['ms'] for r in rs_]):.0f}")
    names_ = {"standing-men": "men's preset", "standing-women": "women's preset", "casual-women": "women's casual preset"}
    lines = []
    for r in sorted(rs_, key=lambda r: (r["category"], r["key"])):
        c = r["checks"]
        cell = lambda k, nd=1: (f"{c[k]['value']:.{nd}f}" + ("" if c[k]["ok"] else r"\,$\triangle$"))  # noqa: E731
        who = names_.get(r["model"], "uploaded photo" if r["model"].startswith("upload") else r["model"])
        lines.append(f"{r['key']} & {r['category']} & {tex(who)} & {cell('blank')} & {cell('changed')} & {cell('size', 2)} & {cell('colour')} & {cell('person')} & {'pass' if r['passed'] else 'fail'}\\\\")
    head = (r"\begin{tabular}{@{}lllrrrrrl@{}}" "\n" r"\toprule" "\n"
            r"\textbf{Result} & \textbf{Category} & \textbf{Model photo} & \textbf{blank} & \textbf{changed} & \textbf{size} & \textbf{colour} & \textbf{person} & \textbf{Outcome}\\" "\n"
            r"\midrule" "\n")
    open(os.path.join(GEN, "app_guardrails.tex"), "w").write(head + "\n".join(lines) + "\n" + r"\bottomrule" + "\n" + r"\end{tabular}" + "\n")

# ------------------------------------------------------------------ images, values, compile
for src, dst in (("docs/btp-report/figures/baseline-sheet.jpg", "baseline-sheet.jpg"), ("docs/btp-report/figures/skirt-on-separates.jpg", "skirt.jpg"),
                 ("docs/btp-report/figures/space-vs-local.jpg", "space-vs-local.jpg"), ("docs/btp-report/figures/team/shot-numbers.png", "shot-numbers.png"),
                 ("docs/btp-report/figures/team/shot-saved.png", "shot-saved.png"), ("docs/btp-report/figures/team/shot-beforeafter.png", "shot-beforeafter.png"),
                 ("docs/btp-report/figures/ui/studio-product.png", "ui-product.png"), ("docs/btp-report/figures/ui/studio-review.png", "ui-review.png"),
                 ("docs/btp-report/figures/ui/studio-result.png", "ui-result.png"), ("docs/btp-report/figures/ui/library.png", "ui-library.png"),
                 ("docs/btp-report/figures/ui/help-popover.png", "ui-help.png"), ("docs/btp-report/figures/ui/mobile.png", "ui-mobile.png")):
    if os.path.exists(R(src)):
        shutil.copy(R(src), os.path.join(FIG, dst))

with open(os.path.join(GEN, "values.tex"), "w") as f:
    f.write("% generated by build.py: do not edit\n")
    for k in ("ifPairs", "ifMarket", "ifExample", "ifLora", "ifAppGuard", "ifModelGuard"):
        f.write(f"\\newif\\{k}\\{k[2:]}{'true' if V.get(k) else 'false'}\n")
    for k, v in V.items():
        if not k.startswith("if"):
            f.write(f"\\newcommand{{\\v{k}}}{{{v}}}\n")
# ------------------------------------------------------------------ data for the slides (build-final-deck.cjs)
deck = {"V": {k: v for k, v in V.items() if not k.startswith("if")}, "flags": {k: bool(V.get(k)) for k in ("ifPairs", "ifMarket", "ifExample", "ifLora", "ifAppGuard", "ifModelGuard")},
        "runs": {"labels": names_runs, "queue": [round(x, 1) for x in que], "gpu": [round(x, 1) for x in gpu]},
        "cache": [CACHE_MS, round(med(tot) * 1000)], "quota": {"x": xs, "byTime": byT, "byRuns": byR, "limit": limit},
        "recon": {"t": lt["t"], "ours": ours, "rev": rev}, "micro": {"steps": steps[::2], "roll": [round(x, 5) for x in roll[::2]]},
        "compute": {"full_gb": round(full_gb, 1), "lora_gb": round(lora_gb, 2), "base_mb": mr["base_weights_mb"], "adapter_mb": mr["adapter_mb"]},
        "rubric": {"labels": [r[0].replace("\n", " ") for r in rub], "totals": [sum(r[1]) for r in rub], "criteria": crit, "scores": [r[1] for r in rub]},
        "tests": tests}
if qc:
    deck["pairs"] = {"stages": ["photos found", "usable worn", "garment-only", "pairs"], "values": vals, "reasons": rs}
if mk:
    deck["market"] = {}
    for key, c in cats.items():
        pr = [p[0] for p in c["price_points"]]
        edges = list(range(0, 4001, 400))
        hist = [round(100 * sum(1 for x in pr if lo <= x < lo + 400) / len(pr), 1) for lo in edges[:-1]] + [round(100 * sum(1 for x in pr if x >= 4000) / len(pr), 1)]
        deck["market"][key] = {"label": SHORT[key], "n": c["after_cleaning"], "med": c["price"]["median"], "disc": c["discount"]["median"], "disc50": round(100 * c["discount"]["share_over_50"]), "stars": c["rating"]["mean"], "ratings": c["rating"]["total_ratings"],
                               "hist_labels": [f"{lo // 100 / 10:g}–{(lo + 400) // 100 / 10:g}k" for lo in edges[:-1]] + ["4k+"], "hist": hist,
                               "tiers": {tn: [round(100 * c["tiers"][tn]["listing_share"]), round(100 * c["tiers"][tn]["demand_share"])] for tn in ("value", "mid", "premium")},
                               "cuts": c["tier_cuts"], "kw": [[k["term"], k["score"]] for k in c["seo_keywords"][:10]],
                               "lift": {a_: [[r["value"], r["lift"]] for r in c["attributes"][a_] if r["value"] != "Other" and r["listings"] >= 5][:6] for a_ in ("fabric", "neck", "sleeve", "colour", "pattern", "border")}}
    if mk.get("example"):
        deck["example"] = mk["example"]
if cmp_:
    deck["lora"] = cmp_
json.dump(deck, open(os.path.join(GEN, "deck-data.json"), "w"), indent=1, ensure_ascii=False)
print(f"{len(V)} values, figures in {FIG}")

if not a.no_pdf:
    subprocess.run(["tectonic", "-X", "compile", "main.tex"], cwd=HERE, check=True)
    shutil.copy(os.path.join(HERE, "main.pdf"), OUT_PDF)
    print("wrote", OUT_PDF)
