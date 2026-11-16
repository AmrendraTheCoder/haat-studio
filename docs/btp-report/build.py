"""
Build the mini project report: fill measured numbers into report.html, draw the charts, print to PDF.

    ml/.venv/bin/python docs/btp-report/build.py          (from the haat-studio folder)

Numbers come from ml/runs/real-check/report.json and ml/runs/microrun/report.json. If the
micro-run has not finished, Section VI-E says so instead of showing numbers.
"""

import csv
import json
import os
import subprocess

os.environ.setdefault("MPLCONFIGDIR", os.path.join(os.environ.get("TMPDIR", "/tmp"), "mpl"))
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
FIG = os.path.join(HERE, "figures")
plt.rcParams.update({"font.family": "serif", "font.size": 9, "axes.spines.top": False, "axes.spines.right": False})

real = json.load(open(os.path.join(ROOT, "ml/runs/real-check/report.json")))
micro_path = os.path.join(ROOT, "ml/runs/microrun/report.json")
micro = json.load(open(micro_path)) if os.path.exists(micro_path) else {}

# --- Fig. 2: loss under the two conventions -------------------------------------------
lt = real["loss_by_t"]
fig, ax = plt.subplots(figsize=(3.4, 2.1))
x = range(len(lt["t"]))
ax.bar([i - 0.2 for i in x], lt["ours"], 0.4, label="Reconstructed", color="#333")
ax.bar([i + 0.2 for i in x], lt["reversed"], 0.4, label="Reversed", color="#bbb")
ax.set_yscale("log")
ax.set_xticks(list(x), [str(t) for t in lt["t"]])
ax.set_xlabel("timestep t")
ax.set_ylabel("loss")
ax.legend(frameon=False, fontsize=8, loc="center left", bbox_to_anchor=(0, 0.55))
fig.tight_layout()
fig.savefig(os.path.join(FIG, "chart-loss.png"), dpi=300)
plt.close(fig)

# --- tokens ---------------------------------------------------------------------------
lora = micro.get("lora", {"trainable_params": 9830400, "total_params": 981644208, "layers_wrapped": 96})
n_lora, n_base = lora["trainable_params"], lora["total_params"] - lora["trainable_params"]
pct = 100 * n_lora / n_base
tok = {
    "LORA_PCT": f"{pct:.2f}",
    "LORA_M": f"{n_lora / 1e6:.2f}",
    "TOTAL_M": f"{n_base / 1e6:.1f}",
    "BASE_MB": f"{os.path.getsize(os.path.join(ROOT, 'ml/weights/model.safetensors')) / 2**20:,.0f}",
    "LORA_COUNT_SENTENCE": f"Counted on the real model, the adapters add {n_lora:,} trainable parameters on {lora['layers_wrapped']} layers to {n_base:,} frozen ones: {pct:.2f}% of the network.",
}

done = "after" in micro
if done:
    tr, b, a = micro["train"], micro["before"], micro["after"]
    rows = list(csv.DictReader(open(os.path.join(ROOT, "ml/runs/microrun/log.csv"))))
    fig, ax = plt.subplots(figsize=(3.4, 1.9))
    ys = [float(r["loss"]) for r in rows]
    ax.plot(range(1, len(ys) + 1), ys, "o", color="#aaa", ms=2.5, label="each step")
    k = 10
    if len(ys) >= 2 * k:
        ax.plot(range(k, len(ys) + 1), [sum(ys[i - k : i]) / k for i in range(k, len(ys) + 1)], color="#000", lw=1.4, label=f"mean of last {k}")
        ax.legend(frameon=False, fontsize=8)
    ax.set_xlabel("training step")
    ax.set_ylabel("training loss")
    fig.tight_layout()
    fig.savefig(os.path.join(FIG, "chart-microrun.png"), dpi=300)
    plt.close(fig)

    dtr, dva = micro["train_loss_change_percent"], micro.get("val_loss_change_percent")
    pre, res = micro["preprocess_seconds"], micro.get("resolution", [864, 576])
    pose, parser = sum(pre["pose_s"]) / len(pre["pose_s"]), sum(pre["parser_s"]) / len(pre["parser_s"])
    word = lambda d: f"fell by {abs(d):.1f}%" if d < 0 else f"rose by {d:.1f}%"  # noqa: E731
    val_row = f"<tr><td>Loss on the unseen sample, before → after</td><td>{b['val']['mean']:.5f} → {a['val']['mean']:.5f} ({dva:+.1f}%)</td></tr>" if dva is not None else ""
    val_text = f" On the one sample not trained on, the loss {word(dva)}; with one sample this is an observation, not a result." if dva is not None else ""
    tok["MICRO_SECTION"] = f"""
<p>To test the fine-tuning path on the real 972M-parameter network, a short LoRA run was carried out on the laptop. A training step at the full 864 × 576 resolution does not fit this machine: two runs ended during their first step without an error message, and a third, observed directly, had filled the 8 GB of memory and a further 8.6 GB of swap and had not completed one step after eight minutes. The run was therefore made at half resolution, {res[0]} × {res[1]}, which gives a quarter of the tokens (1,728) and one sixteenth of the attention memory; the network accepts this size unchanged because its patch embedding is convolutional and its positions are rotary. The pretrained model's loss at this size is about twice its full-resolution value, so it is outside the size it was trained for but still functioning. This is a <i>memorisation test</i>. The two training samples are try-ons the system had already produced, with the base model's own output as target; a third is held back. The run shows whether adapters attach to the real model, gradients flow, the loss on the trained samples falls and the adapter saves, and it measures cost. It is <b>not</b> evidence of better try-ons: the targets are the model's own outputs, and nothing new can be learned from them.</p>
<div class="tbl">
<p class="tcap">Table VII: LoRA Run on the Real Weights (Apple M3, 8 GB, Half Resolution)</p>
<table>
<tr><th>Quantity</th><th>Value</th></tr>
<tr><td>Adapter layers / trainable parameters</td><td>{lora['layers_wrapped']} / {n_lora:,} ({pct:.2f}%)</td></tr>
<tr><td>Resolution / tokens</td><td>{res[0]} × {res[1]} / 1,728</td></tr>
<tr><td>Optimiser steps (batch 1, lr 10<sup>−4</sup>)</td><td>{tr['steps_done']}</td></tr>
<tr><td>Time per step (median) / total</td><td>{tr['seconds_per_step_median']:.0f} s / {tr['seconds_total'] / 60:.1f} min</td></tr>
<tr><td>GPU memory during training</td><td>{tr['memory_gb']} GB</td></tr>
<tr><td>Loss on the 2 trained samples, before → after</td><td>{b['train']['mean']:.5f} → {a['train']['mean']:.5f} ({dtr:+.1f}%)</td></tr>
{val_row}
<tr><td>Adapter file / base weights</td><td>{micro['adapter_mb']} MB / {micro['base_weights_mb']:,.0f} MB ({100 * micro['adapter_mb'] / micro['base_weights_mb']:.1f}%)</td></tr>
<tr><td>Preprocessing per image: pose / parser</td><td>{pose:.1f} s / {parser:.1f} s (CPU)</td></tr>
</table>
</div>
<p>Table VII gives the measurements; loss is evaluated before and after at the same five timesteps and the same noise. After {tr['steps_done']} steps the loss on the trained samples {word(dtr)}.{val_text} A step, forward and backward through all 28 blocks with gradient checkpointing, takes about {tr['seconds_per_step_median']:.0f} s at this size. The saved adapter is {micro['adapter_mb']} MB, {100 * micro['adapter_mb'] / micro['base_weights_mb']:.1f}% of the base weights. The practical conclusion is that the fine-tuning path works end to end on the real network, and that training at the model's own resolution needs a CUDA GPU.</p>
<figure><img src="figures/chart-microrun.png" style="width:96%"><p class="cap">Fig. 6: Training loss per step in the LoRA run. Each step draws a random timestep and noise, so the curve is noisy; Table VII uses a fixed evaluation.</p></figure>
"""
    tok["ABSTRACT_MICRO"] = f"A {tr['steps_done']}-step LoRA run on the real weights, a memorisation test of the training machinery run at half resolution because a full-resolution step exceeds 8 GB, changed the loss on its training samples by {dtr:+.1f}%."
    tok["SUMMARY_MICRO"] = f"<tr><td>LoRA run (half resolution), loss on trained samples</td><td>{dtr:+.1f}% after {tr['steps_done']} steps</td></tr><tr><td>Adapter size vs base weights</td><td>{micro['adapter_mb']} MB vs {micro['base_weights_mb']:,.0f} MB</td></tr>"
else:
    tok["MICRO_SECTION"] = "<p>A short LoRA run on the real weights was started on the laptop but had not completed when this report was built. No result is reported.</p>"
    tok["ABSTRACT_MICRO"] = ""
    tok["SUMMARY_MICRO"] = ""

html = open(os.path.join(HERE, "report.html"), encoding="utf-8").read()
for k, v in tok.items():
    html = html.replace("{{" + k + "}}", v)
assert "{{" not in html, html[html.index("{{") : html.index("{{") + 40]
out_html = os.path.join(HERE, "report.filled.html")
open(out_html, "w", encoding="utf-8").write(html)

pdf = os.path.join(HERE, "Mini-Project-Report-Virtual-Try-On.pdf")
chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
subprocess.run([chrome, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={pdf}", "file://" + out_html], check=True, capture_output=True, timeout=120)
print("wrote", pdf, f"{os.path.getsize(pdf) / 1024:.0f} KB", "| micro-run included:", done)
