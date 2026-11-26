"""LoRA fine-tuning loop for FASHN VTON 1.5 (see scripts/train_lora.py for the command line)."""

import csv
import json
import math
import os
import time
from dataclasses import asdict, dataclass

import torch

from .flow import enable_gradient_checkpointing, flow_loss
from .lora import extend_categories, inject_lora, lora_parameters, save_lora


@dataclass
class TrainConfig:
    rank: int = 16
    alpha: float = 16.0
    targets: str = "attn+mlp"
    lr: float = 1e-4
    weight_decay: float = 0.01
    warmup_steps: int = 100
    steps: int = 2000
    batch_size: int = 1
    grad_accum: int = 4  # effective batch 4
    p_uncond: float = 0.1  # how often all conditions are dropped, so guidance keeps working
    garment_weight: float = 2.0
    max_grad_norm: float = 1.0
    new_categories: int = 0  # e.g. 1 to add "saree" as label 4
    checkpointing: bool = True
    eval_every: int = 200
    save_every: int = 500
    seed: int = 0
    scale: float = 1.0  # 0.5 = train at 432 x 288 (a quarter of the tokens) to fit an 8 GB machine
    val_limit: int = 0  # use only the first N val samples for the curve during training (0 = all)


def rescale(batch: dict, scale: float) -> dict:
    """Downscale images, poses and masks of a batch (masks with nearest, images with area)."""
    if scale == 1.0:
        return batch
    out = {}
    for k, v in batch.items():
        if v.dim() == 4:
            mode = "nearest" if k in ("garment_mask", "weight") else "area"
            out[k] = torch.nn.functional.interpolate(v.float(), scale_factor=scale, mode=mode).to(v.dtype)
        else:
            out[k] = v
    return out


def autocast_dtype(device: torch.device):
    if device.type == "cuda":
        return torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16  # T4/V100: fp16
    if device.type == "mps":
        return torch.bfloat16
    return None


def prepare_model(model: torch.nn.Module, cfg: TrainConfig) -> list:
    names = inject_lora(model, cfg.rank, cfg.alpha, cfg.targets)
    if cfg.new_categories:
        extend_categories(model, cfg.new_categories)
    if cfg.checkpointing:
        enable_gradient_checkpointing(model)
    return names


@torch.no_grad()
def fixed_val_loss(model, loader, device, dtype, cfg, ts=(0.1, 0.3, 0.5, 0.7, 0.9)) -> float:
    """Validation loss at fixed noise and times, so the curve isn't just sampling noise."""
    model.eval()
    gen = torch.Generator(device="cpu").manual_seed(1234)
    total, n = 0.0, 0
    for i, batch in enumerate(loader):
        if cfg.val_limit and i >= cfg.val_limit:
            break
        batch = rescale({k: v.to(device) for k, v in batch.items()}, cfg.scale)
        b = batch["target"].shape[0]
        for t in ts:
            noise = torch.randn(batch["target"].shape, generator=gen).to(device)
            with torch.autocast(device.type, dtype=dtype, enabled=dtype is not None):
                loss = flow_loss(model, batch, t=torch.full((b,), t, device=device), noise=noise, keep=torch.ones(b, dtype=torch.bool, device=device), garment_weight=cfg.garment_weight)
            total += float(loss) * b
            n += b
    model.train()
    return total / max(n, 1)


def train(model, train_set, val_set, out_dir: str, cfg: TrainConfig, device: torch.device, log=print):
    os.makedirs(out_dir, exist_ok=True)
    torch.manual_seed(cfg.seed)
    names = prepare_model(model, cfg)
    model.to(device).train()
    if cfg.scale != 1.0:  # the final unpatchify reassembles the image at this size
        h, w = model.input_shape
        model.input_shape = (int(h * cfg.scale), int(w * cfg.scale))
    params = list(lora_parameters(model))
    n_train = sum(p.numel() for p in params)
    n_all = sum(p.numel() for p in model.parameters())
    log(f"LoRA on {len(names)} layers: training {n_train / 1e6:.1f}M of {n_all / 1e6:.0f}M parameters ({100 * n_train / n_all:.1f}%)")

    dtype = autocast_dtype(device)
    scaler = torch.amp.GradScaler("cuda", enabled=dtype == torch.float16)
    opt = torch.optim.AdamW(params, lr=cfg.lr, weight_decay=cfg.weight_decay)
    # Linear warm-up, then cosine decay to 10%.
    sched = torch.optim.lr_scheduler.LambdaLR(
        opt, lambda s: min(1, (s + 1) / cfg.warmup_steps) * (0.1 + 0.9 * 0.5 * (1 + math.cos(math.pi * min(s, cfg.steps) / cfg.steps)))
    )
    train_loader = torch.utils.data.DataLoader(train_set, batch_size=cfg.batch_size, shuffle=True, drop_last=True, num_workers=2 if device.type == "cuda" else 0)
    val_loader = torch.utils.data.DataLoader(val_set, batch_size=cfg.batch_size)

    meta = {**asdict(cfg), "base": "fashn-ai/fashn-vton-1.5", "layers": len(names)}
    json.dump(meta, open(os.path.join(out_dir, "config.json"), "w"), indent=2)
    log_file = open(os.path.join(out_dir, "log.csv"), "w", newline="")
    writer = csv.writer(log_file)
    writer.writerow(["step", "train_loss", "val_loss", "lr", "seconds"])

    step, start, running = 0, time.time(), []
    best = fixed_val_loss(model, val_loader, device, dtype, cfg)
    log(f"step 0  val {best:.4f}  (the untouched base model)")
    writer.writerow([0, "", f"{best:.5f}", 0, 0])
    while step < cfg.steps:
        for i, batch in enumerate(train_loader):
            batch = rescale({k: v.to(device) for k, v in batch.items()}, cfg.scale)
            with torch.autocast(device.type, dtype=dtype, enabled=dtype is not None):
                loss = flow_loss(model, batch, p_uncond=cfg.p_uncond, garment_weight=cfg.garment_weight)
            scaler.scale(loss / cfg.grad_accum).backward()
            running.append(float(loss))
            if (i + 1) % cfg.grad_accum:
                continue
            scaler.unscale_(opt)
            torch.nn.utils.clip_grad_norm_(params, cfg.max_grad_norm)
            scaler.step(opt)
            scaler.update()
            opt.zero_grad(set_to_none=True)
            sched.step()
            step += 1

            if step % cfg.eval_every == 0 or step == cfg.steps:
                val = fixed_val_loss(model, val_loader, device, dtype, cfg)
                tr = sum(running) / len(running)
                running = []
                log(f"step {step}  train {tr:.4f}  val {val:.4f}  lr {sched.get_last_lr()[0]:.2e}  {time.time() - start:.0f}s")
                writer.writerow([step, f"{tr:.5f}", f"{val:.5f}", f"{sched.get_last_lr()[0]:.3e}", f"{time.time() - start:.0f}"])
                log_file.flush()
                if val < best:
                    best = val
                    save_lora(model, os.path.join(out_dir, "lora-best.safetensors"), {**meta, "step": step, "val_loss": val})
            if step % cfg.save_every == 0 or step == cfg.steps:
                save_lora(model, os.path.join(out_dir, f"lora-step{step}.safetensors"), {**meta, "step": step})
            if step >= cfg.steps:
                break
    log_file.close()
    # What the report's compute-cost table reads (scripts/compare_lora.py).
    seconds = time.time() - start
    json.dump({
        "trainable_params": n_train, "total_params": n_all, "trainable_percent": round(100 * n_train / n_all, 3),
        "layers": len(names), "steps": step, "effective_batch": cfg.batch_size * cfg.grad_accum,
        "train_seconds": round(seconds, 1), "seconds_per_step": round(seconds / max(step, 1), 3),
        "peak_gpu_gb": round(torch.cuda.max_memory_allocated() / 1e9, 2) if device.type == "cuda" else (round(torch.mps.driver_allocated_memory() / 1e9, 2) if device.type == "mps" else None),
        "device": torch.cuda.get_device_name(0) if device.type == "cuda" else device.type,
        "best_val_loss": round(best, 6),
    }, open(os.path.join(out_dir, "train_summary.json"), "w"), indent=2)
    return best
