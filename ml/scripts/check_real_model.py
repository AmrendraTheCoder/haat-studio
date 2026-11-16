"""
Checks on the REAL FASHN weights, on whatever GPU this machine has.

  1. Our generate() gives the same image as FASHN's own pipeline().
  2. A local run reproduces the photo the Hugging Face Space made (same inputs, seed 42).
  3. The training loss, on real weights, is lower with our time convention than with the
     reversed one — the trained model "agrees" with our objective.
  4. One real LoRA training step: time and memory.

    python scripts/check_real_model.py --result ../data/results/<key> --category tops --out runs/real-check
"""

import _common  # noqa: F401
import argparse
import json
import os
import time

import numpy as np
import torch
from PIL import Image

import haat_ft.flow as flow
from haat_ft.data import preprocess, to_tensors
from haat_ft.infer import generate, load_pipeline
from haat_ft.lora import inject_lora, lora_parameters

ap = argparse.ArgumentParser()
ap.add_argument("--result", required=True, help="a data/results/<key> folder: person.jpg, garment.jpg, result.png")
ap.add_argument("--category", required=True)
ap.add_argument("--photo-type", default="flat-lay")
ap.add_argument("--weights-dir", default="weights")
ap.add_argument("--out", required=True)
ap.add_argument("--steps", type=int, default=30)
ap.add_argument("--skip", default="", help="comma list of checks to skip: equal,space,loss,train")
a = ap.parse_args()
skip = set(a.skip.split(","))
os.makedirs(a.out, exist_ok=True)
report = {}


def mem():
    if torch.backends.mps.is_available():
        return round(torch.mps.driver_allocated_memory() / 2**30, 2)
    if torch.cuda.is_available():
        return round(torch.cuda.max_memory_allocated() / 2**30, 2)
    return None


def diff(x: Image.Image, y: Image.Image) -> dict:
    p, q = np.asarray(x, dtype=np.float32), np.asarray(y.resize(x.size), dtype=np.float32)
    mse = float(((p - q) ** 2).mean())
    return {"mean_abs_diff_0_255": round(float(np.abs(p - q).mean()), 2), "psnr_db": round(10 * np.log10(255**2 / max(mse, 1e-10)), 2)}


t0 = time.time()
pipe = load_pipeline(a.weights_dir)
report["device"], report["dtype"] = str(pipe.device), str(pipe.inference_dtype)
report["load_seconds"], report["memory_after_load_gb"] = round(time.time() - t0, 1), mem()
print(report)

person = Image.open(os.path.join(a.result, "person.jpg")).convert("RGB")
garment = Image.open(os.path.join(a.result, "garment.jpg")).convert("RGB")
space = Image.open(os.path.join(a.result, "result.png")).convert("RGB")

if "space" not in skip:
    t0 = time.time()
    ours = generate(pipe, person, garment, a.category, a.photo_type, steps=a.steps)[0]
    report["generate_seconds"], report["memory_after_generate_gb"] = round(time.time() - t0, 1), mem()
    ours.save(os.path.join(a.out, "local.png"))
    report["local_vs_space"] = diff(ours, space)
    print(report)

if "equal" not in skip:
    steps = 4  # same code path, fewer steps to keep it quick
    theirs = pipe(person, garment, a.category, a.photo_type, num_timesteps=steps).images[0]
    ours4 = generate(pipe, person, garment, a.category, a.photo_type, steps=steps)[0]
    report["ours_vs_fashn_pipeline_4_steps"] = diff(ours4, theirs)
    print(report)

if "parser" not in skip and a.photo_type == "flat-lay":
    # In segmentation-free mode with a flat-lay garment, the human parser's output is
    # computed and then never used (agnostic.py returns the image unchanged when
    # disable_masking is set). Prove it: replace the parser with one that returns zeros.
    steps = 4
    real_parser = pipe.hp_model
    normal = generate(pipe, person, garment, a.category, a.photo_type, steps=steps)[0]
    pipe.hp_model = type("NoParser", (), {"predict": staticmethod(lambda img: np.zeros(img.shape[:2], np.uint8))})()
    without = generate(pipe, person, garment, a.category, a.photo_type, steps=steps)[0]
    pipe.hp_model = real_parser
    report["without_human_parser_4_steps"] = diff(without, normal)
    print(report)

if "loss" not in skip:
    # Training sample from the Space's photo: masked mode, target = that photo.
    prep = preprocess(pipe, space, garment, a.category, a.photo_type, segmentation_free=False, target=space)
    batch = to_tensors(prep, device=pipe.device, dtype=pipe.inference_dtype)
    keep = torch.ones(1, dtype=torch.bool, device=pipe.device)
    gen = torch.Generator().manual_seed(0)
    noises = [torch.randn(batch["target"].shape, generator=gen).to(pipe.device, pipe.inference_dtype) for _ in range(3)]
    ts = [0.1, 0.3, 0.5, 0.7, 0.9]

    def losses(targets_fn):
        flow_targets = flow.flow_targets
        flow.flow_targets = targets_fn
        try:
            with torch.no_grad():
                return [round(float(np.mean([float(flow.flow_loss(pipe.tryon_model, batch, t=torch.full((1,), t, device=pipe.device), noise=n, keep=keep, garment_weight=1.0)) for n in noises])), 4) for t in ts]
        finally:
            flow.flow_targets = flow_targets

    def reversed_time(image, t, noise=None):  # noise at t = 1, image at t = 0
        tt = t.view(-1, 1, 1, 1).to(image.dtype)
        return tt * noise + (1 - tt) * image, noise - image

    report["loss_by_t"] = {"t": ts, "ours": losses(flow.flow_targets), "reversed": losses(reversed_time)}
    print(report)

if "train" not in skip:
    model = pipe.tryon_model
    names = inject_lora(model, rank=16, alpha=16, targets="attn+mlp")
    flow.enable_gradient_checkpointing(model)
    model.to(pipe.device).train()
    params = list(lora_parameters(model))
    opt = torch.optim.AdamW(params, lr=1e-4)
    if "loss" in skip:
        prep = preprocess(pipe, space, garment, a.category, a.photo_type, segmentation_free=False, target=space)
        batch = to_tensors(prep, device=pipe.device, dtype=pipe.inference_dtype)
    times = []
    for _ in range(3):
        t0 = time.time()
        with torch.autocast(pipe.device.type, dtype=torch.bfloat16, enabled=pipe.device.type != "cpu"):
            loss = flow.flow_loss(model, batch)
        loss.backward()
        opt.step()
        opt.zero_grad(set_to_none=True)
        if pipe.device.type == "mps":
            torch.mps.synchronize()
        times.append(round(time.time() - t0, 1))
    report["lora_step"] = {
        "layers": len(names),
        "trainable_million": round(sum(p.numel() for p in params) / 1e6, 2),
        "total_million": round(sum(p.numel() for p in model.parameters()) / 1e6, 1),
        "seconds_per_step": times,
        "memory_gb": mem(),
        "loss": round(float(loss), 4),
    }
    print(report)

json.dump(report, open(os.path.join(a.out, "report.json"), "w"), indent=2)
print(json.dumps(report, indent=2))
