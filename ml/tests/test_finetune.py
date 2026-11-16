"""
Fast checks on a tiny, randomly initialised TryOnModel (FASHN's own class,
smaller sizes). No weights, no GPU, no network.
"""

from types import SimpleNamespace

import numpy as np
import torch
from fashn_vton import TryOnPipeline
from fashn_vton.tryon_mmdit import TryOnModel

from haat_ft.flow import enable_gradient_checkpointing, flow_loss, flow_targets, sample_t
from haat_ft.lora import LoRALinear, extend_categories, inject_lora, lora_parameters, load_lora, merge_lora, save_lora

H, W = 48, 36  # divisible by FASHN's 12-pixel patches → 4 × 3 tokens


def tiny(seed=0):
    torch.manual_seed(seed)
    return TryOnModel(
        input_shape=(H, W), hidden_size=64, n_heads=2, double_blocks_depth=1, single_blocks_depth=1, patch_mixer_depth=1, axes_dim=(8, 12, 12)
    )


def batch(b=1, seed=1):
    g = torch.Generator().manual_seed(seed)
    r = lambda c: torch.rand((b, c, H, W), generator=g) * 2 - 1  # noqa: E731
    target = r(3)
    return {
        "target": target,
        "ca": target.clone(),
        "garment": r(3),
        "person_pose": r(1),
        "garment_pose": r(1),
        "category": torch.ones(b, dtype=torch.long),
        "weight": torch.ones(b, 1, H, W),
        "garment_mask": (torch.rand((b, 1, H, W), generator=g) > 0.5).float(),
    }


def run(model, b, t=0.4):
    x_t, _ = flow_targets(b["target"], torch.full((1,), t), torch.zeros_like(b["target"]))
    return model(x_t, torch.full((1,), t), b["ca"], b["garment"], b["person_pose"], b["garment_pose"], garment_categories=b["category"])["x"]


def test_lora_starts_as_the_original_model():
    m, b = tiny(), batch()
    before = run(m, b)
    names = inject_lora(m, rank=4, alpha=4)
    assert len(names) == 1 * 8 + 1 * 2  # double block: 2 streams × (qkv, proj, mlp.0, mlp.2); single: linear1, linear2
    assert torch.allclose(before, run(m, b), atol=1e-6)


def test_only_the_adapter_trains():
    m = tiny()
    inject_lora(m, rank=4, alpha=4)
    trainable = {n for n, p in m.named_parameters() if p.requires_grad}
    assert trainable and all(".down." in n or ".up." in n for n in trainable)


def test_target_presets():
    assert len(inject_lora(tiny(), targets="attn")) == 1 * 4 + 2
    assert len(inject_lora(tiny(), targets="all")) == 1 * 8 + 2 + 2  # + patch mixer


def test_merge_and_save_load_match_the_adapted_model(tmp_path):
    m, b = tiny(), batch()
    inject_lora(m, rank=4, alpha=8)
    for mod in m.modules():
        if isinstance(mod, LoRALinear):
            torch.nn.init.normal_(mod.up.weight, std=0.05)
    adapted = run(m, b)
    path = str(tmp_path / "a.safetensors")
    save_lora(m, path, {"rank": 4})

    fresh = tiny()  # same base weights (same seed), adapter loaded from disk
    inject_lora(fresh, rank=4, alpha=8)
    load_lora(fresh, path)
    assert torch.allclose(adapted, run(fresh, b), atol=1e-5)

    merged = merge_lora(fresh)
    assert not any(isinstance(x, LoRALinear) for x in merged.modules())
    assert torch.allclose(adapted, run(merged, b), atol=1e-4)


def test_timesteps_lean_towards_noise_like_the_sampler():
    t = sample_t(20000, "cpu")
    assert 0 < t.min() and t.max() < 1
    assert 0.17 < t.median() < 0.2  # median sigmoid(−1.5) ≈ 0.18: most training near the noise end, like the sampler


def test_dropout_mask_zeroes_every_condition():
    m, b = tiny(), batch(b=2)
    keep = torch.tensor([True, False])
    t = torch.full((2,), 0.5)
    noise = torch.zeros_like(b["target"])
    loss_drop = flow_loss(m, b, t=t, noise=noise, keep=keep)
    b2 = {**b, "ca": torch.randn_like(b["ca"]), "garment": torch.randn_like(b["garment"])}
    b2["ca"][0], b2["garment"][0] = b["ca"][0], b["garment"][0]
    # Changing the dropped sample's conditions changes nothing.
    assert torch.allclose(loss_drop, flow_loss(m, b2, t=t, noise=noise, keep=keep), atol=1e-6)


def test_checkpointing_gives_the_same_gradients():
    grads = []
    for ckpt in (False, True):
        m, b = tiny(), batch()
        inject_lora(m, rank=4, alpha=4)
        for mod in m.modules():
            if isinstance(mod, LoRALinear):
                torch.nn.init.normal_(mod.up.weight, std=0.05, generator=torch.Generator().manual_seed(3))
        if ckpt:
            enable_gradient_checkpointing(m)
        flow_loss(m, b, t=torch.full((1,), 0.3), noise=torch.zeros_like(b["target"]), keep=torch.ones(1, dtype=torch.bool)).backward()
        grads.append(torch.cat([p.grad.flatten() for p in lora_parameters(m)]))
    assert torch.allclose(grads[0], grads[1], atol=1e-6)


def test_new_category_keeps_the_old_ones():
    m, b = tiny(), batch()
    before = run(m, b)
    first = extend_categories(m, 1)
    assert first == 4 and m.y_embedder.num_embeddings == 5
    assert torch.allclose(before, run(m, b), atol=1e-6)
    saree = {**b, "category": torch.full((1,), 4)}
    assert torch.allclose(run(m, saree), run(m, {**b, "category": torch.full((1,), 3)}), atol=1e-6)  # starts as one-pieces


def test_training_with_this_loss_reproduces_the_target_under_fashns_sampler():
    """
    The end-to-end check of the convention: overfit one example with our loss,
    then generate with FASHN's unmodified sampler (TryOnPipeline._sample). If the
    direction of time or the velocity sign were wrong, the output would move
    away from the target (measured: with the flipped convention the error rose
    from 0.80 to 1.14 after 1500 steps; with ours it fell to 0.005).

    Needs FASHN's real width (hidden 512+): a 64-wide model can't carry a 12×12×3
    patch of noise through, so its loss can't fall far whatever the convention.
    """
    import torch.nn.functional as F

    torch.manual_seed(0)
    m = TryOnModel(input_shape=(H, W), hidden_size=512, n_heads=4, double_blocks_depth=1, single_blocks_depth=1, patch_mixer_depth=1)
    b = batch()
    smooth = F.interpolate(torch.rand((1, 3, 4, 3), generator=torch.Generator().manual_seed(5)) * 2 - 1, size=(H, W), mode="bilinear")
    b["target"], b["ca"] = smooth, smooth.clone()
    owner = SimpleNamespace(tryon_model=m)

    def err():
        torch.manual_seed(0)
        im = TryOnPipeline._sample(
            owner, ca_images=b["ca"], garment_images=b["garment"], person_poses=b["person_pose"], garment_poses=b["garment_pose"],
            garment_categories=b["category"], num_timesteps=20, guidance_scale=1.0, use_tqdm=False,
        )[0]
        x = torch.from_numpy(np.array(im)).float().permute(2, 0, 1) / 127.5 - 1
        return float(((x - b["target"][0]) ** 2).mean())

    before = err()
    opt = torch.optim.Adam(m.parameters(), lr=3e-4)
    for _ in range(600):
        opt.zero_grad()
        flow_loss(m, b, p_uncond=0.0, garment_weight=1.0).backward()
        opt.step()
    after = err()
    assert after < before * 0.3, (before, after)


def test_full_training_loop_on_a_tiny_dataset(tmp_path):
    """prepare → PreparedDataset → train() → adapter files and a loss log, end to end."""
    import csv
    import json

    from haat_ft.data import Prepared, PreparedDataset, save_prepared
    from haat_ft.train import TrainConfig, train

    rng = np.random.default_rng(0)
    index = []
    for i, split in enumerate(["train"] * 4 + ["val"] * 2):
        arrays = {k: rng.integers(0, 256, (H, W, 3), dtype=np.uint8) for k in ("ca", "garment", "target")}
        arrays |= {k: rng.integers(0, 256, (H, W), dtype=np.uint8) for k in ("person_pose", "garment_pose")}
        arrays |= {"garment_mask": (rng.random((H, W)) > 0.5).astype(np.uint8) * 255, "weight": np.full((H, W), 255, np.uint8)}
        save_prepared(Prepared(arrays, 1, (0, 0, 0, 0)), str(tmp_path / f"s{i}.pt"), {})
        index.append({"file": f"s{i}.pt", "split": split})
    json.dump(index, open(tmp_path / "index.json", "w"))

    out = tmp_path / "run"
    cfg = TrainConfig(rank=4, alpha=4, steps=6, grad_accum=2, warmup_steps=2, eval_every=3, save_every=3, checkpointing=True)
    best = train(tiny(), PreparedDataset(str(tmp_path), "train"), PreparedDataset(str(tmp_path), "val"), str(out), cfg, torch.device("cpu"), log=lambda *_: None)

    assert best > 0
    assert {"config.json", "log.csv", "lora-step3.safetensors", "lora-step6.safetensors"} <= {p.name for p in out.iterdir()}
    rows = list(csv.DictReader(open(out / "log.csv")))
    assert [r["step"] for r in rows] == ["0", "3", "6"]


def test_low_memory_attention_gives_the_same_output():
    import fashn_vton.tryon_mmdit as mmdit

    from haat_ft.infer import low_memory_attention

    m, b = tiny(), batch()
    full = run(m, b)
    original = mmdit._attn_processor
    try:
        low_memory_attention(heads_per_chunk=1)
        assert torch.allclose(full, run(m, b), atol=1e-5)
    finally:
        mmdit._attn_processor = original


def test_float32_rope_matches_fashns_float64_rope():
    import fashn_vton.tryon_mmdit as mmdit

    from haat_ft.infer import mps_compat

    pos = torch.stack(torch.meshgrid(torch.zeros(1), torch.arange(72.0), torch.arange(48.0), indexing="ij"), -1).reshape(1, -1, 3)
    original = mmdit.rope
    want = torch.cat([original(pos[..., i], d, 10000) for i, d in enumerate((16, 56, 56))], dim=-3)
    try:
        mps_compat()
        got = torch.cat([mmdit.rope(pos[..., i], d, 10000) for i, d in enumerate((16, 56, 56))], dim=-3)
    finally:
        mmdit.rope = original
    assert (got - want).abs().max() < 1e-4
