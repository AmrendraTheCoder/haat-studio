# The try-on model: how it works, how we tuned it, how to fine-tune it

Haat Studio · technical report on FASHN VTON 1.5 · 31 October 2026

Code: [`ml/`](../ml/) (Python, PyTorch). Everything here can be re-run; every number
says where it came from.

---

## 0. Summary

- **The model.** FASHN VTON 1.5 is a 972-million-parameter *multimodal diffusion
  transformer* (MMDiT) that generates the try-on photo directly in pixels, by
  *rectified flow*, in 30 steps. We read its full source (2,762 lines) and describe
  every stage below with file and line references.
- **What we built.** FASHN publishes inference code only — no training code and no
  paper yet. We wrote a complete **LoRA fine-tuning kit**: data preparation identical
  to FASHN's inference preprocessing, the training objective reconstructed from the
  sampler, LoRA layers, a training loop, evaluation metrics, an inference-tuning sweep,
  and a way to add a new garment category (e.g. saree).
- **What is verified.** 12 automated tests, including the decisive one: a model
  trained with our objective reproduces its target under **FASHN's own, unmodified
  sampler** (error 0.80 → 0.005), while the reversed convention makes it worse
  (0.80 → 1.14). On the real weights, on this MacBook's GPU (§6.2): our code matches
  FASHN's pipeline exactly, the parser is provably unused in our mode, and the pretrained
  model's loss is ~1,000× lower under our convention than the reversed one.
- **What is not done yet, and why.** An actual fine-tuning *run*. It needs (a) a few
  hundred photo pairs of Indian garments, which don't exist publicly in the needed
  form, and (b) a CUDA GPU with ≥16 GB for a few hours. The kit is ready for both.
- **One finding with commercial impact.** In the exact mode our app uses
  (segmentation-free, flat-lay garment), the human parser — the one component with a
  non-commercial licence — runs but **its output is never used** (§3.3). It can be
  skipped, which also saves time.

---

## 1. Why this model (short)

| Need | FASHN VTON 1.5 |
|---|---|
| Sellers have flat-lay photos | Accepts flat-lay or worn garments (`garment_photo_type`) |
| No mask drawing by the seller | Segmentation-free mode is the default |
| ₹0 | Official Space on Hugging Face ZeroGPU, free tier |
| Path to commercial use | Model and code Apache-2.0 (parser excepted, §3.3) |
| Small enough to run ourselves | 972M parameters, ~2 GB weights in bf16, ~8 GB VRAM |

Alternatives (IDM-VTON, OOTDiffusion, CatVTON, FitDiT, Leffa, Kolors, general image
editors, paid APIs) and why they lost are compared in the project report, Chapter 2 and Table 2.1
(`docs/mini-project-report`).

---

## 2. The architecture

Source: `fashn_vton/tryon_mmdit.py` (FASHN, adapted from FLUX.1, Apache-2.0).

### 2.1 Inputs become tokens

Every image is resized and padded to **864 × 576** and cut into **12 × 12-pixel
patches**: 72 × 48 = **3,456 tokens per image**. There is no VAE: each token is the
raw 432 numbers (12 × 12 × 3) of its patch — "pixel space".

| Stream | Channels stacked per pixel | Embedder |
|---|---|---|
| Person ("img") | noisy image (3) + person photo (3) + person pose (1) = **7** | `x_embedder`, conv 12×12 stride 12 → 1280 |
| Garment ("txt") | garment photo (3) + garment pose (1) = **4** | `garment_embedder`, same |

The garment stream sits where text sits in FLUX — the garment *is* the prompt.

Position: rotary embeddings (RoPE) on 3 axes, dims (16, 56, 56) = the 128-dim head.

Conditioning vector: timestep embedding + category embedding (`y_embedder`: 0 = none,
1 tops, 2 bottoms, 3 one-pieces). It modulates every block (scale, shift, gate — "adaLN").

### 2.2 The transformer

```
person tokens (3456) ──▶ 4 patch-mixer blocks (self-attention among person patches)
                              │
garment tokens (3456) ────────┤
                              ▼
               8 double-stream blocks: separate weights per stream,
               ONE joint attention over all 6912 tokens
               (this is where garment detail flows onto the body)
                              ▼
               16 single-stream blocks on the concatenated 6912 tokens
                              ▼
               keep the 3456 person tokens → final layer → 432 values each
               → reassemble a 864 × 576 × 3 "velocity" image
```

Hidden size 1280, 10 heads × 128, MLP ratio 4, QK-RMSNorm, SDPA attention.
Parameters: 972M (model card). Weights: `model.safetensors`, bf16.

### 2.3 How an image is generated — rectified flow

Source: `pipeline.py` `_sample`, `utils/sampling.py`.

1. Start from pure Gaussian noise `x` (t = 0).
2. The model predicts a **velocity** `v` — the direction from noise to the photo.
3. Euler step: `x ← x + dt · v`. Repeat until t = 1.
4. The step sizes follow a shifted schedule (`mu = 1.5`): more, smaller steps near the
   noisy start, where the layout is decided.

**Classifier-free guidance (CFG).** Every step runs the model twice in one batch: with
all conditions, and with all of them zeroed (`forward_for_cfg`). The output is
`v = v_uncond + 1.5 · (v_cond − v_uncond)` — pushed further towards "follow the
garment". The last step skips guidance to avoid over-saturated colours.

Cost: 30 steps × 2 passes = **60 forward passes** of a 972M transformer over 6,912
tokens per photo.

---

## 3. The full pipeline, stage by stage

Source: `pipeline.py` `TryOnPipeline.__call__`.

| # | Stage | Model | What it produces |
|---|---|---|---|
| 1 | Resize to fit 864 px, no upscaling | — | |
| 2 | Pose of the person | YOLOX-L (person detector) + DWPose (whole-body keypoints), ONNX | Skeleton drawn in grey, **each limb its own grey level** |
| 3 | Pose of the garment's wearer | same, or a blank skeleton for a flat-lay | |
| 4 | Human parsing | FASHN Human Parser (SegFormer), 18 labels | Per-pixel labels: top, dress, skirt, pants, scarf, arms, … |
| 5 | Clothing-agnostic person | — | Masked mode: old garment + limbs greyed; **segmentation-free: the photo unchanged** |
| 6 | Garment image | — | Worn garment: cut out by the parser; flat-lay: unchanged |
| 7 | Pad to 864 × 576, scale to [−1, 1] | — | |
| 8 | 30 Euler steps with CFG | TryOnModel | |
| 9 | Remove padding | — | 576 × ~823 photo for our presets |

### 3.1 Masked vs. segmentation-free

- **Masked:** the old garment region is greyed out, so the model inpaints it. Garment
  can't grow beyond the mask (a long kurti on a model in a crop top gets cut).
- **Segmentation-free (our app, FASHN's default):** the model sees the whole person,
  old clothes included, and decides itself what to replace. Better body preservation,
  free garment length — but the old outfit's shape can leak (our skirt-on-dress failure).

### 3.2 The categories decide what is replaced

`fashn_human_parser`: tops → upper body (top, dress, scarf), bottoms → lower body
(skirt, pants, belt), one-pieces → both. Note **scarf** is an upper-body label: a
dupatta is treated as part of the top.

### 3.3 Finding: the parser is unused in our mode

In `create_clothing_agnostic_image` and `create_garment_image` (preprocessing/agnostic.py),
`disable_masking=True` returns the input untouched. Our app sends
`segmentation_free=True` and flat-lay photos, so **both parser outputs are discarded**.
The parser is the one component under a research-only licence (NVIDIA SegFormer).
Skipping it removes that licence from our path and saves its run time. Measured
proof on the real weights in §6.

---

## 4. Tuning without training — the sampler knobs

| Knob | Default | Space exposes it? | Effect |
|---|---|---|---|
| `num_timesteps` | 30 | yes (our Fast/Balanced/Best = 20/30/50) | Quality vs. time, linear cost |
| `guidance_scale` | 1.5 | yes (we fix 1.5) | Higher follows the garment harder; too high → over-saturated, artefacts |
| `seed` | 42 | yes | Different plausible results; our app's "variation" changes it |
| `segmentation_free` | True | yes | §3.1 |
| `garment_photo_type` | — | yes | flat-lay skips garment pose and parsing |
| `time_shift_mu` | 1.5 | **no** | Where steps are spent along the noise→image path |
| `skip_cfg_last_n_steps` | 1 | **no** | Colour saturation at the end |
| `num_samples` | 1 | yes (1–4) | Batch several seeds in one GPU call |

`ml/scripts/sweep.py` runs any grid of these locally and makes a contact sheet; §6.3
has what we measured.

---

## 5. Fine-tuning — method

### 5.1 Why fine-tune at all

The base model was trained on 18M pairs + 4M synthetic triplets (model card); the
data isn't published and skews, by all appearances of the examples, to Western
retail. Kurtis, salwar suits, dupattas, lehengas and sarees have drapes, borders,
embroidery and lengths it has rarely seen. A small, targeted fine-tune on Indian
garments is the standard fix.

### 5.2 Why LoRA

Low-Rank Adaptation (Hu et al., 2021): each chosen linear layer `W` gets a learned
update `ΔW = (α/r)·B·A` with rank `r` ≪ width. `B` starts at zero, so training starts
from exactly the base model (tested).

| | Full fine-tune | LoRA (r = 16, attention + MLP) |
|---|---|---|
| Trained parameters | 972M | 9.83M = 1.01% (96 layers; counted on the real model) |
| Risk of forgetting with a few hundred pairs | high | low |
| Output file | 2 GB | tens of MB |
| GPU memory | far beyond 16 GB with Adam | fits one 16–24 GB GPU with checkpointing |
| Can be switched off / merged | — | both (`merge_lora`) |

Targets (`lora.py TARGETS`): `attn` (attention projections), `attn+mlp` (default), `all`
(adds the patch mixer). Modulation layers stay frozen.

### 5.3 The objective (reconstructed)

From the sampler (§2.3) the training target follows exactly:

```
t      ~ sigmoid(N(0,1) − 1.5)          (logit-normal, shifted like the sampler)
noise  ~ N(0, I)
x_t    = (1 − t) · noise + t · photo
target = photo − noise                 (the velocity)
loss   = mean( w · (model(x_t, t, conditions) − target)² )
```

- `w` = 0 on padding, 1 on the body/background, **2 on the garment pixels**
  (`garment_weight`): errors on the product cost double.
- With probability 0.1 all conditions are dropped together (zeroed, category 0), so
  guidance keeps working after fine-tuning.
- The exact values FASHN used aren't published; these are the standard choices for
  this model family (SD3, FLUX). The end-to-end test in §6.1 checks the convention.

### 5.4 Data — the real bottleneck

Per garment we need **a photo of a person wearing it** (target) and **the garment
alone** (condition). Two sample types (`prepare_data.py`), as FASHN did:

- **Paired, masked:** person photo with the garment area greyed → the real photo.
- **Synthetic triplet, segmentation-free:** the base model first dresses the same
  person in a *different* garment; the model learns to turn that synthetic photo back
  into the real one. The target is always real, so the model can't learn its own errors.

No horizontal-flip augmentation: limbs are coded by grey level (left ≠ right), and a
mirrored print is a wrong product.

Practical plan: 300–500 garments from 5–10 local sellers (they already have both
photos — catalogue flat-lay and a worn shot), with written consent; 85/15 train/val
split by garment.

### 5.5 Hyper-parameters (defaults in `train.py`)

rank 16, α 16, AdamW lr 1e-4, weight decay 0.01, 100 warm-up steps then cosine to 10%,
2,000 optimiser steps, batch 1 × 4 accumulation, gradient clipping 1.0, bf16 (fp16 +
loss scaling on T4/V100), gradient checkpointing on. Validation loss at fixed
noise/time every 200 steps; the best adapter is kept.

### 5.6 Evaluation

`evaluate.py` generates every held-out sample with the base model and with the adapter
(same inputs, same seed) and reports **PSNR**, **SSIM** (whole image) and **L1 on the
garment pixels**, plus side-by-side images. Papers also use LPIPS, FID/KID; those need
many samples and are future work. Our own 30-point rubric (colour, print, neckline,
sleeves/length, shape, artefacts — [baseline eval](eval-2026-10-26-baseline.md)) stays
the human check: a metric can miss a wrong logo.

---

## 6. What we ran and measured

### 6.1 Tests (no weights, no GPU) — `ml/tests/test_finetune.py`, 12/12 pass

1. LoRA starts as the original model (outputs identical).
2. Only adapter weights are trainable.
3. Target presets select the intended layers.
4. Saving, loading and merging an adapter all give the same outputs.
5. Training timesteps lean towards noise like the sampler (median 0.18).
6. Condition dropout really removes every condition.
7. Gradient checkpointing gives identical gradients.
8. A new category starts as "one-pieces" and leaves the old ones unchanged.
9. **Convention test:** a model overfitted with our loss reproduces its target under
   FASHN's unmodified sampler. Measured separately: ours 0.80 → 0.005 error;
   reversed time 0.80 → 1.14.
10. The whole loop (files → dataset → train → adapters + loss log) runs.
11. Low-memory (chunked) attention gives the same output as full attention.
12. The float32 rotary embedding matches FASHN's float64 one.

### 6.2 Real weights on this MacBook (Apple M3, 8 GB) — `check_real_model.py`

Run on 31 October 2026, one real try-on from the app (a top, flat-lay garment) as input.
Raw numbers: `ml/runs/real-check/report.json`; full log: `ml/runs/real-check.log`.

**Setup.** Apple M3 GPU (`mps`), bfloat16. Loading the weights: 6.6 s, 2.0 GB.

| Check | Result | What it shows |
|---|---|---|
| Our `generate()` vs FASHN's own `pipeline()`, 4 steps | Mean difference 0.00 / 255, PSNR 148 dB (identical) | Our inference code is a faithful copy of FASHN's — evaluation and fine-tuning start from the real model, not an approximation |
| Human parser replaced by one that returns nothing, 4 steps | Mean difference 0.00 / 255, PSNR 148 dB (identical) | §3.3 confirmed on real weights: in our mode the parser's output is never used and can be skipped |
| Local run vs the Space's photo, same inputs, seed 42, 30 steps (script default) | Mean difference 7.0 / 255, PSNR 22.4 dB | Same garment and pose, not the same pixels. Most likely cause: the starting noise is drawn on a different device (Apple GPU vs NVIDIA), so even with seed 42 the sampler starts from a different point. Not investigated further |
| Training loss on real weights, our time convention vs reversed, at t = 0.1 / 0.3 / 0.5 / 0.7 / 0.9 | Ours: 0.0045 / 0.0037 / 0.0040 / 0.0052 / 0.0124. Reversed: 4.31 / 4.64 / 5.73 / 4.60 / 6.43 | The pretrained model already "agrees" with our objective — about 1,000× lower loss — so fine-tuning continues FASHN's training instead of fighting it |
| Time for one full try-on | 1,344 s (≈ 22 min), 4.1 GB memory | Works, but far too slow to serve from this laptop; the Space does it in ~13 s |
| LoRA training on the real weights (`lora_microrun.py`, 12 Nov 2026) | Full resolution: does not fit 8 GB — filled memory + 8.6 GB swap, no step finished in 8 min. **Half resolution (432 × 288): 100 steps, ~7 s/step, 3.26 GB; loss on the 2 trained samples 0.00510 → 0.00372 (−27.1%), unseen sample +1.1%; adapter 37.5 MB** | The fine-tuning path works end to end on the real model. It is a memorisation test (targets are the model's own outputs), not a quality gain. Full-resolution training needs a CUDA GPU |

The loss rises at t = 0.9 (near the finished image) with both conventions; that is expected
for a velocity target and doesn't affect the comparison.

### 6.3 Inference tuning

**Not run yet.** `ml/scripts/sweep.py` is ready (steps, guidance, seed, `time_shift_mu`,
`skip_cfg_last_n_steps`; one contact sheet per grid). On this laptop each 30-step image takes
~22 min, so a useful grid needs a CUDA GPU or our own Space. Until then the app keeps FASHN's
defaults (guidance 1.5, mu 1.5) and offers 20 / 30 / 50 steps.

---

## 7. How it fails today

| Failure | Cause | Evidence |
|---|---|---|
| Bottom blends into a dress | Segmentation-free keeps the old outfit; nothing separate to replace | Baseline: 11/30 vs 29/30 on a model in separates |
| Soft detail at Instagram sizes | Fixed 864 × 576 output; we enlarge to 1080 × 1350 | Model card, our exports |
| Sarees, lehengas, dupattas | Drapes and pleats don't map onto tops/bottoms/one-pieces; dupatta parsed as "scarf" | Parser labels (§3.2); not yet tested |
| Long kurtis on short tops (masked mode) | Mask limits garment length | §3.1 |
| Body shape, hands, hair over the garment | Generative fill near occlusions | Model card limitations |
| Text/logos on unseen sides | The model only sees the front | — |
| Run-to-run variation | Different seeds give different details | App offers "variation" |
| Quota | Free ZeroGPU: 5 min/day, ~8 runs | Quota meter |

---

## 8. How it should work — the roadmap

1. **Our own Space.** A copy of FASHN's Gradio app on our account with: the parser
   skipped in our mode (§3.3), our LoRA adapter, `duration` set to ~30 s (a call then
   needs 30 s of quota left to start, not 60). Added to the app as one new engine file.
2. **Data.** 300–500 Indian garments from partner sellers, with consent; Indian model
   presets in separates and in one-piece outfits.
3. **Fine-tune v1.** LoRA on tops (kurtis, blouses) and bottoms (salwar, palazzo) first,
   on a college GPU or Kaggle; evaluate against the base on held-out garments.
4. **New categories.** "Saree"/"lehenga" as category 4/5 (`--new-categories`),
   initialised from one-pieces, trained on draped examples.
5. **Sharper output.** A super-resolution step (e.g. Real-ESRGAN) to 1080 px wide,
   checked on the garment metric so it doesn't invent texture.
6. **Pre-checks.** Blur, cut-off garment and cluttered-background detection before a
   GPU call is spent.
7. **Speed.** The model card reports ~5 s on an H100; ahead-of-time compilation (the
   ZeroGPU-supported route) and fewer steps with distillation are the levers.

---

## 9. References

- FASHN VTON 1.5 — model card: https://huggingface.co/fashn-ai/fashn-vton-1.5 ·
  code: https://github.com/fashn-AI/fashn-vton-1.5 (commit 7c0f10a, 2026-02-01) ·
  Space: https://huggingface.co/spaces/fashn-ai/fashn-vton-1.5 · paper: "coming soon"
  (Bochman & Bochman, 2026).
- FLUX.1 (architecture FASHN adapts): https://github.com/black-forest-labs/flux
- Esser et al., 2024. *Scaling Rectified Flow Transformers for High-Resolution Image
  Synthesis* (Stable Diffusion 3; MMDiT, logit-normal timesteps). arXiv:2403.03206
- Liu et al., 2022. *Flow Straight and Fast: Rectified Flow*. arXiv:2209.03003
- Lipman et al., 2022. *Flow Matching for Generative Modeling*. arXiv:2210.02747
- Ho & Salimans, 2022. *Classifier-Free Diffusion Guidance*. arXiv:2207.12598
- Peebles & Xie, 2023. *Scalable Diffusion Models with Transformers* (DiT, adaLN). arXiv:2212.09748
- Hu et al., 2021. *LoRA: Low-Rank Adaptation of Large Language Models*. arXiv:2106.09685
- Yang et al., 2023. *Effective Whole-body Pose Estimation with Two-stages Distillation* (DWPose). arXiv:2307.15880
- Ge et al., 2021. *YOLOX*. arXiv:2107.08430
- Xie et al., 2021. *SegFormer*. arXiv:2105.15203 — licence: https://github.com/NVlabs/SegFormer/blob/master/LICENSE
- Wang et al., 2004. *Image Quality Assessment: From Error Visibility to Structural Similarity* (SSIM).
- Hugging Face ZeroGPU documentation: https://huggingface.co/docs/hub/spaces-zerogpu
- Choi et al., 2021, VITON-HD; Morelli et al., 2022, DressCode — the standard try-on datasets (paired format we follow).
