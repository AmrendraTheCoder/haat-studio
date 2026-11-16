"""
Image metrics for comparing a generated photo with the real one.

PSNR and SSIM (Wang et al. 2004) on the whole image, and L1 on the garment
pixels only — the number a seller cares about. LPIPS and FID are the usual
try-on metrics in papers; they need extra networks and many samples, so they
are left to `evaluate.py --lpips` when the package is installed.
"""

import torch
import torch.nn.functional as F


def _to01(x: torch.Tensor) -> torch.Tensor:
    return ((x.float() + 1) / 2).clamp(0, 1)


def psnr(a: torch.Tensor, b: torch.Tensor, weight: torch.Tensor) -> float:
    """a, b in [−1, 1], shape (1, 3, H, W); weight (1, 1, H, W) excludes padding."""
    mse = (((_to01(a) - _to01(b)) ** 2) * weight).sum() / (weight.sum() * 3).clamp(min=1)
    return float(10 * torch.log10(1 / mse.clamp(min=1e-10)))


def ssim(a: torch.Tensor, b: torch.Tensor, weight: torch.Tensor) -> float:
    """Mean SSIM with an 11×11 Gaussian window (σ = 1.5), averaged over unpadded pixels."""
    x, y = _to01(a), _to01(b)
    g = torch.exp(-((torch.arange(11, dtype=torch.float32, device=x.device) - 5) ** 2) / (2 * 1.5**2))
    g = (g / g.sum())[:, None] @ (g / g.sum())[None, :]
    win = g.expand(3, 1, 11, 11)
    blur = lambda z: F.conv2d(z, win, padding=5, groups=3)  # noqa: E731
    mx, my = blur(x), blur(y)
    vx, vy, cxy = blur(x * x) - mx**2, blur(y * y) - my**2, blur(x * y) - mx * my
    c1, c2 = 0.01**2, 0.03**2
    s = ((2 * mx * my + c1) * (2 * cxy + c2)) / ((mx**2 + my**2 + c1) * (vx + vy + c2))
    return float((s.mean(1, keepdim=True) * weight).sum() / weight.sum().clamp(min=1))


def garment_l1(a: torch.Tensor, b: torch.Tensor, garment_mask: torch.Tensor) -> float:
    """Mean absolute error (0–1 scale) on the garment pixels of the real photo."""
    return float(((_to01(a) - _to01(b)).abs() * garment_mask).sum() / (garment_mask.sum() * 3).clamp(min=1))
