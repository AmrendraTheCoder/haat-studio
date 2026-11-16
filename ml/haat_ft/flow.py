"""
The training objective, reconstructed from FASHN's inference code.

FASHN has not published training code or the paper (README: "arXiv coming
soon"). What the inference code fixes (fashn_vton/pipeline.py `_sample`,
utils/sampling.py):

  - Rectified flow: start from Gaussian noise at t = 0, take Euler steps
    x ← x + dt · v(x, t) up to the image at t = 1. So along the straight path
        x_t = (1 − t) · noise + t · image
    the velocity the model must predict is   v = image − noise.
  - The step schedule is shifted with mu = 1.5 so that more steps are spent
    near the noise end (small t).
  - Classifier-free guidance: `forward_for_cfg` runs the model once with all
    conditions and once with all of them zeroed (and category 0), so training
    must sometimes drop every condition together.

So we train with: MSE(v_pred, image − noise), t from a logit-normal shifted
the same way as the sampler, and joint condition dropout. These choices are
the standard ones for this model family (Stable Diffusion 3, FLUX); the exact
values FASHN used are unknown. tests/test_flow.py checks the convention end to
end: a model trained with this loss reproduces its target under FASHN's own sampler.
"""

from typing import Dict, Optional

import torch
from torch import nn

# Sampler shift (pipeline._sample time_shift_mu). sigmoid(z − mu) is the same as
# FASHN's time_shift(−mu, 1, sigmoid(z)): a logit-normal pulled towards noise.
TIME_SHIFT_MU = 1.5


def sample_t(n: int, device, mu: float = TIME_SHIFT_MU, std: float = 1.0) -> torch.Tensor:
    return torch.sigmoid(torch.randn(n, device=device) * std - mu)


def flow_targets(image: torch.Tensor, t: torch.Tensor, noise: Optional[torch.Tensor] = None):
    """Point on the noise→image line at time t, and the velocity along it."""
    noise = torch.randn_like(image) if noise is None else noise
    tt = t.view(-1, *([1] * (image.dim() - 1))).to(image.dtype)
    return (1 - tt) * noise + tt * image, image - noise


def flow_loss(
    model: nn.Module,
    batch: Dict[str, torch.Tensor],
    *,
    p_uncond: float = 0.1,
    garment_weight: float = 2.0,
    t: Optional[torch.Tensor] = None,
    noise: Optional[torch.Tensor] = None,
    keep: Optional[torch.Tensor] = None,
) -> torch.Tensor:
    """
    One training loss. `batch` holds tensors in [−1, 1] (images, poses) plus
    `category` (long) and `weight` (1 = count this pixel, 0 = padding).

    garment_weight > 1 makes errors on the garment pixels of the target cost more
    — the seller cares about the product being exact more than the background.
    """
    target = batch["target"]
    b = target.shape[0]
    t = sample_t(b, target.device) if t is None else t
    x_t, v = flow_targets(target, t, noise)

    # One coin per sample drops ALL conditions together, as forward_for_cfg expects.
    keep = torch.rand(b, device=target.device) >= p_uncond if keep is None else keep
    pred = model(
        x_t,
        t.to(target.dtype),
        ca_images=batch["ca"],
        garment_images=batch["garment"],
        person_poses=batch["person_pose"],
        garment_poses=batch["garment_pose"],
        garment_categories=batch["category"],
        mask=keep,
    )["x"]

    w = batch["weight"] * (1 + (garment_weight - 1) * batch["garment_mask"])
    err = (pred.float() - v.float()) ** 2 * w
    return err.sum() / (w.sum() * target.shape[1]).clamp(min=1)


def enable_gradient_checkpointing(model: nn.Module):
    """Recompute each block's activations in the backward pass: ~3–4× less memory, ~30% slower."""
    from torch.utils.checkpoint import checkpoint

    blocks = list(getattr(model, "x_patch_mixer", [])) + list(model.double_blocks) + list(model.single_blocks)
    for block in blocks:
        if getattr(block, "_checkpointed", False):
            continue
        forward = block.forward

        def wrapped(*args, _forward=forward, **kwargs):
            return checkpoint(_forward, *args, use_reentrant=False, **kwargs)

        block.forward = wrapped
        block._checkpointed = True
