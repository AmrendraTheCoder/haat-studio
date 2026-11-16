"""
A short, real LoRA run on the real FASHN weights — small enough for a laptop.

What it is: a MEMORISATION test. The training samples are try-ons the app already made
(data/results/<key>: person.jpg, garment.jpg, result.png); the target is the base model's
own photo. It proves the whole fine-tuning path works on the real 972M model — adapters
attach, gradients flow, the loss on the trained samples falls, the adapter saves — and
measures time, memory and size.

What it is NOT: evidence of better try-ons. That needs real photos of people wearing the
garments (docs/model-report.md §5.4) and held-out evaluation with scripts/evaluate.py.

    python scripts/lora_microrun.py --train ../data/results/<k1> ../data/results/<k2> \
        --val ../data/results/<k3> --categories tops bottoms tops --steps 20 --out runs/microrun
"""

import _common  # noqa: F401
import argparse
import csv
import json
import os
import time

import numpy as np
import torch
from PIL import Image

import haat_ft.flow as flow
from haat_ft.data import preprocess, to_tensors
from haat_ft.infer import load_pipeline
from haat_ft.lora import inject_lora, lora_parameters, save_lora

ap = argparse.ArgumentParser()
ap.add_argument("--train", nargs="+", required=True)
ap.add_argument("--val", nargs="*", default=[])
ap.add_argument("--categories", nargs="+", required=True, help="one per folder, train then val")
ap.add_argument("--weights-dir", default="weights")
ap.add_argument("--out", required=True)
ap.add_argument("--steps", type=int, default=20)
ap.add_argument("--rank", type=int, default=16)
ap.add_argument("--lr", type=float, default=1e-4)
ap.add_argument("--targets", default="attn+mlp")
ap.add_argument("--scale", type=float, default=1.0, help="0.5 = train at 432 x 288 (a quarter of the tokens) to fit a small machine")
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
report = {"steps": a.steps, "rank": a.rank, "lr": a.lr, "targets": a.targets, "scale": a.scale}


def mem():
    if torch.backends.mps.is_available():
        return round(torch.mps.driver_allocated_memory() / 2**30, 2)
    if torch.cuda.is_available():
        return round(torch.cuda.max_memory_allocated() / 2**30, 2)
    return None


def save():
    json.dump(report, open(os.path.join(a.out, "report.json"), "w"), indent=2)


pipe = load_pipeline(a.weights_dir)
dev, dt = pipe.device, pipe.inference_dtype
report["device"] = str(dev)

# --- samples, and how long each preprocessing model takes -------------------------
folders = a.train + a.val
assert len(a.categories) == len(folders), "one category per folder"
batches, timing = [], {"pose_s": [], "parser_s": []}
for folder, cat in zip(folders, a.categories):
    garment = Image.open(os.path.join(folder, "garment.jpg")).convert("RGB")
    target = Image.open(os.path.join(folder, "result.png")).convert("RGB")
    arr = np.asarray(target)
    t0 = time.time()
    pipe.pose_model(arr[:, :, ::-1].copy())
    timing["pose_s"].append(round(time.time() - t0, 2))
    t0 = time.time()
    pipe.hp_model.predict(arr)
    timing["parser_s"].append(round(time.time() - t0, 2))
    prep = preprocess(pipe, target, garment, cat, "flat-lay", segmentation_free=False, target=target)
    b = to_tensors(prep, device=dev, dtype=dt)
    if a.scale != 1.0:
        # Fewer tokens: the network is size-agnostic (patch convolution + rotary positions).
        for k, v in b.items():
            if v.dim() == 4:
                mode = "nearest" if k in ("garment_mask", "weight") else "area"
                b[k] = torch.nn.functional.interpolate(v.float(), scale_factor=a.scale, mode=mode).to(dt)
        report["resolution"] = list(b["target"].shape[-2:])
    batches.append(b)
report["preprocess_seconds"] = timing
train_b, val_b = batches[: len(a.train)], batches[len(a.train) :]

# --- the model, with adapters ------------------------------------------------------
model = pipe.tryon_model
if a.scale != 1.0:
    model.input_shape = tuple(batches[0]["target"].shape[-2:])  # only used to reassemble the output image
names = inject_lora(model, rank=a.rank, alpha=float(a.rank), targets=a.targets)
flow.enable_gradient_checkpointing(model)
model.to(dev).train()
params = list(lora_parameters(model))
n_train, n_all = sum(p.numel() for p in params), sum(p.numel() for p in model.parameters())
report["lora"] = {
    "layers_wrapped": len(names),
    "trainable_params": n_train,
    "total_params": n_all,
    "trainable_percent": round(100 * n_train / n_all, 3),
}
print(report["lora"], flush=True)

TS = [0.1, 0.3, 0.5, 0.7, 0.9]
gen = torch.Generator().manual_seed(1234)
NOISE = [torch.randn(batches[0]["target"].shape, generator=gen).to(dev, dt) for _ in TS]
KEEP = torch.ones(1, dtype=torch.bool, device=dev)


@torch.no_grad()
def fixed_loss(group):
    """Loss at fixed times and fixed noise, garment weight 1 — the same ruler before and after."""
    model.eval()
    out = []
    for b in group:
        with torch.autocast(dev.type, dtype=torch.bfloat16, enabled=dev.type != "cpu"):
            out.append([float(flow.flow_loss(model, b, t=torch.full((1,), t, device=dev), noise=n, keep=KEEP, garment_weight=1.0)) for t, n in zip(TS, NOISE)])
    model.train()
    return out


def summary(rows):
    return {"per_sample_per_t": [[round(x, 5) for x in r] for r in rows], "mean": round(float(np.mean(rows)), 5)} if rows else None


report["before"] = {"train": summary(fixed_loss(train_b)), "val": summary(fixed_loss(val_b))}
print("before", report["before"], flush=True)
save()

# --- train ---------------------------------------------------------------------------
opt = torch.optim.AdamW(params, lr=a.lr, weight_decay=0.01)
torch.manual_seed(0)
log = csv.writer(open(os.path.join(a.out, "log.csv"), "w", newline=""))
log.writerow(["step", "sample", "loss", "seconds"])
times = []
for step in range(1, a.steps + 1):
    b = train_b[(step - 1) % len(train_b)]
    t0 = time.time()
    with torch.autocast(dev.type, dtype=torch.bfloat16, enabled=dev.type != "cpu"):
        loss = flow.flow_loss(model, b, p_uncond=0.0, garment_weight=2.0)
    loss.backward()
    torch.nn.utils.clip_grad_norm_(params, 1.0)
    opt.step()
    opt.zero_grad(set_to_none=True)
    if dev.type == "mps":
        torch.mps.synchronize()
    times.append(round(time.time() - t0, 1))
    log.writerow([step, (step - 1) % len(train_b), f"{float(loss):.5f}", times[-1]])
    print(f"step {step}/{a.steps}  loss {float(loss):.4f}  {times[-1]}s  mem {mem()} GB", flush=True)
    report["train"] = {"steps_done": step, "seconds_per_step_median": float(np.median(times)), "seconds_total": round(sum(times), 1), "memory_gb": mem()}
    save()

report["after"] = {"train": summary(fixed_loss(train_b)), "val": summary(fixed_loss(val_b))}
for split in ("train", "val"):
    if report["before"][split]:
        b0, b1 = report["before"][split]["mean"], report["after"][split]["mean"]
        report[f"{split}_loss_change_percent"] = round(100 * (b1 - b0) / b0, 1)

path = os.path.join(a.out, "lora.safetensors")
save_lora(model, path, {"rank": a.rank, "targets": a.targets, "steps": a.steps, "note": "memorisation test"})
report["adapter_mb"] = round(os.path.getsize(path) / 2**20, 1)
report["base_weights_mb"] = round(os.path.getsize(os.path.join(a.weights_dir, "model.safetensors")) / 2**20, 1)
save()
print(json.dumps(report, indent=2))
