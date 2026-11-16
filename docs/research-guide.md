# Research guide: the problem, the model layer by layer, the hypotheses, the evidence

Read this before the meeting so you can explain **why** each part of the work exists, what
problem it solves, which paper the idea comes from, and what was actually tested. It is written
so you can explain the work in your own words without reading code.

How it fits with the other documents:

| Document | Use it for |
|---|---|
| **This guide** | Understanding and explaining: problem, research lineage, layers, hypotheses |
| [presentation-guide.md](presentation-guide.md) | Running things, which file to open, the maths in one place |
| [btp-report/how-to-explain.md](btp-report/how-to-explain.md) | Exact numbers and sentences, section by section of the report |
| [model-report.md](model-report.md) | Full technical detail with source references |

---

## 0. The honest framing (read this first)

Three different things can be called "improving the model". Keep them apart; professors notice
when they are mixed up.

| Kind | What it means | Status |
|---|---|---|
| **A. Better output by using the model better** | Change *what goes into* the frozen model (preprocessing, choice of model photo, settings) | **Done and measured.** Skirt 11/30 → 29/30 |
| **B. Making the model trainable** | The model shipped without training code; work out its training method, prove it, and build a fine-tuning kit (LoRA) | **Done and verified** on the real weights |
| **C. Better output by training it** | Actually fine-tune on Indian garments and measure a gain | **Not done.** Needs data and a CUDA GPU |

The sentence to use:

> "I did not change FASHN's network or retrain it. I improved results by changing how the model
> is used, I reconstructed how it was trained and proved that on its real weights, and I built and
> tested the LoRA adapter layers that would let us fine-tune it on Indian garments. The fine-tune
> itself is the next step."

**On the code.** If the implementation was written with an AI coding assistant, say so plainly:
*"The implementation was written with an AI coding assistant under my direction. I chose the
model, set the questions, designed the checks, and verified each result. I can explain every
step."* Your contribution is the reasoning in this guide, meaning the problem, the hypotheses, the
tests and the interpretation, and that is what you should be able to explain. Check your
department's rules on AI tools, and if the report needs a disclosure line, add one.

---

## 1. The problem

### 1.1 The seller's problem

A small Indian seller on Instagram has a **flat photo of a kurti on a bed**. Buyers want to see it
**worn**. A model shoot costs thousands of rupees a day. So the question is whether one flat
phone photo can become a believable on-model photo, for free, **without changing the product**.

### 1.2 The technical problem it becomes

This task is called **virtual try-on**: given a photo of a person and a photo of a garment,
generate the person wearing that garment. There are four hard parts:

1. **Fidelity.** The garment's colour, print, logo and neckline must survive exactly. A
   good-looking photo of the *wrong* product is a failure, because the seller would be posting
   something they don't sell.
2. **Fit and pose.** The flat garment has to be bent onto a body in a different pose.
3. **Preservation.** The person's face, body, hands and background must stay the same.
4. **Our constraints.** Flat-lay input, no masks drawn by the seller, ₹0 to run, and Indian garments
   (kurtis, salwars, dupattas, sarees) that the model probably saw rarely in training.

### 1.3 The research questions this project asked

- **RQ1.** Which open model solves 1–4 best under our constraints? → FASHN VTON 1.5 (§2.4)
- **RQ2.** Where does it fail on our kind of input, and can we fix that without training? → §4 H4
- **RQ3.** It was released without training code. Can we work out *how* it was trained well enough
  to fine-tune it? → §4 H1, H2
- **RQ4.** Can it be adapted cheaply to Indian garments without forgetting what it knows? → §4 H6–H8

---

## 2. The research lineage: how the field got to this model

Each step below solved a problem that the step before it left open. FASHN VTON 1.5 combines the
answers. Knowing this chain is what lets you explain *why* the model is built the way it is.

### 2.1 Try-on before diffusion: warping (2018–2022)

| Paper | Problem it attacked | Idea | What it left open |
|---|---|---|---|
| **VITON** (Han et al., CVPR 2018) | Put a garment on a person from photos alone | Coarse-to-fine: generate a rough result, then warp the garment onto it | Blurry; details lost in the warp |
| **CP-VTON** (Wang et al., ECCV 2018) | Keep the garment's *characteristics* (print, texture) | Learn a geometric warp (thin-plate spline) of the garment first | Warps break on big pose changes and folds |
| **VITON-HD** (Choi et al., CVPR 2021) | High resolution (1024 px) | Misalignment-aware normalisation | Still a warp-then-blend pipeline; still upper-body only |
| **Dress Code** (Morelli et al., ECCV 2022) | Only tops were supported | Dataset + model for **tops, bottoms, dresses** | Same warp limits |

**What we took:** VITON-HD and Dress Code fixed the standard **paired data format** (a photo of a
person wearing the garment, plus the garment alone). Our fine-tuning data plan uses exactly that
format (`ml/scripts/prepare_data.py`). Dress Code's three categories are the same as FASHN's
tops, bottoms and one-pieces.

### 2.2 Diffusion: generating instead of warping (2020–2024)

| Paper | Problem | Idea |
|---|---|---|
| **DDPM** (Ho et al., NeurIPS 2020) | GANs are unstable and drop variety | Learn to *remove noise* step by step; generate by starting from pure noise |
| **Latent Diffusion / Stable Diffusion** (Rombach et al., CVPR 2022) | Diffusion on pixels is expensive | Diffuse in a compressed **latent** space (a VAE) |
| **TryOnDiffusion** (Zhu et al., CVPR 2023) | Warping fails on big pose changes | Do try-on *inside* the diffusion model: garment and person are fused by attention, with no explicit warp |
| **OOTDiffusion** (Xu et al., 2024), **IDM-VTON** (Choi et al., ECCV 2024), **CatVTON** (Chong et al., 2024) | Make diffusion try-on practical | Reuse Stable Diffusion; garment features injected by attention, or (CatVTON) simply concatenated |

**What they left open, and why it matters to us:** most of these work in a **VAE latent**, which
blurs small text and fine prints, and most are licensed **non-commercial** (CC BY-NC-SA). Both
are problems for a seller tool.

### 2.3 Transformers and flow (2023–2024): the parts FASHN is built from

| Paper | Problem | Idea | Where it appears in FASHN |
|---|---|---|---|
| **Attention** (Vaswani et al., NeurIPS 2017) | Relating every part of an input to every other part | Self-attention | Every block |
| **ViT** (Dosovitskiy et al., ICLR 2021) | Feeding images to a transformer | Cut the image into patches; each patch is a token | 12×12-pixel patches |
| **RoFormer / RoPE** (Su et al., 2021) | Telling attention *where* each token is | Rotary position embedding | 3-axis RoPE |
| **DiT** (Peebles & Xie, ICCV 2023) | Replacing the U-Net in diffusion with a transformer | **adaLN**: the timestep (and class) scales and shifts each block | Timestep + category conditioning |
| **Rectified Flow** (Liu et al., ICLR 2023), **Flow Matching** (Lipman et al., ICLR 2023) | Diffusion needs many curved steps | Learn a **straight path** from noise to image; predict the velocity along it | The sampler, and our training loss |
| **SD3 / MMDiT** (Esser et al., ICML 2024) | Mixing two kinds of input (image + text) well | **Two streams with separate weights, one joint attention**; logit-normal timestep sampling | Person stream + garment stream |
| **FLUX.1** (Black Forest Labs, 2024) | Scaling MMDiT | Double-stream blocks followed by single-stream blocks | FASHN's code is adapted from FLUX |
| **Classifier-free guidance** (Ho & Salimans, 2022) | Making the output follow the condition more strongly | Run with and without the condition; push away from "without" | Guidance 1.5 at every step |

### 2.4 Why FASHN VTON 1.5 (the answer to RQ1)

FASHN combines these ideas so that our open problems are covered:

| Our need | Why FASHN meets it | Idea behind it |
|---|---|---|
| Fine prints and logos must survive | Works **in pixels, no VAE** | ViT-style raw patches instead of a latent |
| Flat-lay input, no mask | `garment_photo_type = flat-lay`, segmentation-free mode | — |
| Garment detail reaches the body | Garment stream + **joint attention** | MMDiT (SD3) |
| Fast, few steps | **Rectified flow**, 30 steps | Liu et al.; Lipman et al. |
| Free to run | Official Hugging Face ZeroGPU Space | — |
| Path to commercial use | Apache-2.0 code and weights | — |

The **gap it left**, and what this project fills: **no training code, and no paper** (the paper is
announced as "coming soon"). Without those, nobody can adapt the model to Indian garments.

---

## 3. The model layer by layer: what each layer does, why, and what we did

The diagram comes first; each layer then gets the same five questions.

```
 person photo ─┐                                      garment photo ─┐
 person pose ──┤ (L2)                                 garment pose ──┤ (L2)
 noisy image ──┤                                                     │
               ▼                                                     ▼
 L1 input prep: resize to 864×576, pad, scale to [−1,1]  (+ L3 parser, L4 agnostic image)
               ▼                                                     ▼
 L5 patchify: 12×12 px → 3,456 tokens (7 channels)     L5 patchify: 3,456 tokens (4 channels)
               ▼                                                     │
 L7 4 patch-mixer blocks (person only)                               │
               ▼                                                     ▼
 L8 8 DOUBLE-STREAM blocks: separate weights per stream, ONE joint attention over 6,912 tokens
               ▼
 L9 16 SINGLE-STREAM blocks: shared weights on all 6,912 tokens
               ▼
 L10 final layer: keep the 3,456 person tokens → 864×576×3 "velocity"
               ▼
 L11 sampler: 30 Euler steps × 2 (guidance) = 60 passes → the try-on photo

 L6 conditioning (timestep + garment category) modulates EVERY block through adaLN
 ★ = where our LoRA adapters sit (L8, L9; L7 optional)
```

### L1 Input preparation

- **What it does.** Resizes so the image fits 864 px without upscaling, pads it to 864 × 576 and
  scales the pixel values to [−1, 1].
- **Why.** A transformer needs a fixed grid of patches, and diffusion works on values centred on 0.
- **Problem it solves.** Photos come in every size and shape.
- **What we did.** We added an app-side step *before* this one (`prepareImage`). It turns photos
  upright using EXIF, because phone photos stored sideways reached the model sideways. It flattens
  transparency onto white, because FASHN's RGB conversion turns transparent cut-outs **black**. It
  limits size to 1536 px and strips GPS data.
- **Evidence.** These are fixes for failures we observed. They are system-level (kind A).

### L2 Pose: YOLOX + DWPose

- **What it does.** YOLOX finds the person, and DWPose finds the body keypoints. The skeleton is
  drawn in grey on black, **each limb with its own grey level**.
- **Why (papers).** YOLOX (Ge et al., 2021) is a fast detector. DWPose (Yang et al., 2023) is
  whole-body pose estimation distilled into a small model.
- **Problem it solves.** The model needs to know where the arms, shoulders and hips are to put the
  garment on them.
- **What we did.** Nothing to the layer. But it fixed a **design decision in our training kit**:
  *no mirror-flip augmentation*. Left and right limbs have different grey levels, so a flipped
  image would carry a wrong pose code, and a mirrored print would be a wrong product.

### L3 Human parser: SegFormer, 18 labels

- **What it does.** Labels every pixel as top, dress, skirt, pants, scarf, arm and so on.
- **Why (paper).** SegFormer (Xie et al., NeurIPS 2021) is an efficient transformer for segmentation.
- **Problem it solves.** In *masked* mode it decides which region to grey out and repaint.
- **What we did.** This is **our finding**. In the mode the app uses (segmentation-free, flat-lay
  garment), the parser runs but its output is **never used**. That matters because the parser is
  the **only component with a non-commercial licence** (NVIDIA SegFormer).
- **Evidence.** See H3 in §4: with the parser replaced by a stub, the output is identical
  (0.00 / 255 difference).

### L4 Clothing-agnostic person image

- **What it does.** In *masked* mode it greys out the old garment and the limbs. In
  *segmentation-free* mode it passes the photo through unchanged.
- **Why.** Masked mode makes the task "fill the hole". Segmentation-free mode lets the model
  decide what to replace.
- **The trade-off.** With a mask, the garment can't grow longer than the mask (a long kurti on a
  model in a crop top gets cut off). Without one, body detail is preserved and length is free, but
  **the old outfit's shape can leak through**.
- **What we did.** We kept segmentation-free mode, found its failure, and fixed it in the system
  (H4).

### L5 Patch tokeniser: pixel space, no VAE

- **What it does.** Cuts each 864 × 576 image into 12 × 12 patches: 72 × 48 = **3,456 tokens**.
  Each token is the raw 432 numbers (12·12·3) of its patch, sent through a 12×12 convolution with
  stride 12 to 1,280 numbers.
- **Channels.** Person stream: noisy image (3) + person photo (3) + pose (1) = **7**. Garment
  stream: garment (3) + pose (1) = **4**.
- **Why (papers).** Patches come from ViT. *Not* using a VAE is FASHN's choice: a VAE compresses
  8× per side and loses fine detail.
- **Problem it solves.** **Small text and fine prints survive**, which is our fidelity requirement.
- **What we did.** Nothing to the layer. It is the main reason we chose this model.

### L6 Conditioning: timestep + category, through adaLN

- **What it does.** The current timestep and the garment category (0 none, 1 tops, 2 bottoms,
  3 one-pieces) become one vector, which **scales, shifts and gates** every block.
- **Why (paper).** adaLN comes from DiT, where it worked better than other ways of conditioning.
- **Problem it solves.** The same network behaves differently at "very noisy" and "nearly done",
  and for tops versus bottoms.
- **What we did.**
  1. We **left these layers frozen** when adding LoRA. They control every sampling step, so
     disturbing them risks breaking the sampler. This is a design choice we haven't tested.
  2. We **added a way to create new categories** such as saree (4) or lehenga (5). A new row in the
     category table starts as a **copy of "one-pieces"** (the closest existing category) and is
     trained (H8). The reason: sarees and dupattas don't map onto tops, bottoms or one-pieces, and
     the parser even labels a dupatta as a *scarf*, which counts as upper body.

### L7 Four patch-mixer blocks

- **What they do.** Self-attention among the **person** tokens only, before the garment joins.
- **Why.** The person stream gets organised first: where the body is and what is background.
- **What we did.** It is an optional LoRA target (the `all` preset). It isn't in the default,
  because the garment-to-body transfer happens later.

### L8 Eight double-stream blocks: the heart of try-on ★

- **What they do.** The person stream and the garment stream each keep **their own weights**, but
  run **one joint attention over all 6,912 tokens**. A chest token on the person can "look at" the
  logo token on the garment directly.
- **Why (paper).** This is MMDiT from SD3, where it was built to combine image and text. Here
  **the garment takes the place of the text prompt.** This replaces the explicit warp of
  VITON-era models: instead of bending the garment geometrically, attention learns where each
  garment patch belongs.
- **Problem it solves.** Fit and pose (hard part 2) without a fragile warp.
- **What we did.** This is a **default LoRA target**: attention projections (qkv, proj) and the MLPs
  of both streams. Our hypothesis is that Indian-garment knowledge (drapes, borders, embroidery
  placement) lives mainly in *how garment tokens map onto body tokens*, which is exactly these
  layers.

### L9 Sixteen single-stream blocks ★

- **What they do.** The two streams are merged into one sequence and processed with **shared**
  weights. Attention and MLP are fused into `linear1` and `linear2`.
- **Why (paper).** This is FLUX's design: after the streams have exchanged information, shared
  weights are cheaper and still powerful.
- **What we did.** This is a **default LoRA target**. Because `linear1` is fused, **one adapter
  covers both attention and MLP** there.

### L10 Final layer

- **What it does.** Keeps the 3,456 person tokens and turns them back into an 864 × 576 × 3 image.
  That image is a **velocity** (the direction from noise to the photo), not the photo itself.
- **What we did.** Nothing. Left frozen.

### L11 The sampler: rectified flow + guidance

- **What it does.** Starts from pure noise, then takes 30 small steps `x ← x + Δt · v`. The steps
  are bunched near the noisy start (shift mu = 1.5), where the layout gets decided. Each step runs
  the model twice: once with all conditions, once with all of them zeroed. Then
  `v = v_uncond + 1.5 · (v_cond − v_uncond)`. The last step skips guidance to avoid over-saturated
  colours. In total that is **60 forward passes per photo**.
- **Why (papers).** Rectified flow and flow matching give straight paths and so few steps.
  Classifier-free guidance (Ho & Salimans) makes the output follow the garment harder. The
  timestep shift comes from SD3.
- **What we did.**
  1. **Read the sampler backwards to recover the training rule** (H1). This is the core research
     step: the sampler fixes which quantity the network must have been trained to predict.
  2. Exposed two settings the public Space hides (`time_shift_mu`, `skip_cfg_last_n_steps`) in our
     own sampler, plus a sweep tool to test them. **Not run yet** (it needs a GPU).
  3. In the app: 20, 30 or 50 steps (Fast, Balanced, Best), and "another variation" = a new seed.

### The adapter layer we added: LoRA ★

- **What it is.** Next to a frozen layer `W` we add a small trainable bypass:
  `y = W·x + (α/r)·B·A·x`, with rank r = 16. Matrix A shrinks the input to 16 numbers, and matrix B
  expands them back.
- **Why (paper).** LoRA (Hu et al., ICLR 2022). The changes a model needs to adapt to a new domain
  are low-rank, so a small bypass is enough.
- **Problem it solves.** A full fine-tune of 972M parameters on a few hundred pairs would overwrite
  what the model learned from 18M pairs (catastrophic forgetting). It would also need far more than
  16 GB of GPU memory and produce a 2 GB file per version.
- **Three design decisions, each with a reason.**
  1. **B starts at zero.** At step 0 the adapted model is *exactly* the base model, so training
     starts from what already works (tested).
  2. **Adapters are kept in float32** although the model is bfloat16. bf16 keeps only about 3
     significant digits, so tiny updates would round to nothing.
  3. **Garment pixels count 2× in the loss**, so an error on the product costs more than one on the
     background. This is our own addition, motivated by the fidelity requirement. Its effect is
     untested (H7).
- **Size.** 96 layers wrapped, **9,830,400 trainable parameters, 1.01%** of the model. The saved
  adapter is 37.5 MB, against 1,854 MB for the base model.

---

## 4. The hypotheses: claim, reasoning, test, result

This is the core of the explanation. Each row follows the same scientific pattern: what we
believed, why, how we could be proved wrong, and what happened.

| # | Hypothesis | Why we believed it | Test that could prove it wrong | Result | Status |
|---|---|---|---|---|---|
| **H1** | FASHN was trained with rectified flow: `x_t = (1−t)·noise + t·image`, target velocity `= image − noise`, with time running noise → image | The sampler steps `x ← x + Δt·v` from noise at t = 0 to the image at t = 1; only this target makes that step correct | (a) Train a tiny model with our loss and sample it with **FASHN's unmodified sampler**. (b) On the **real weights**, compare the loss under our convention with the reversed one | (a) Error 0.80 → **0.005** with ours; reversed time gets *worse*, 0.80 → 1.14. (b) Real weights: mean loss **0.0060 vs 5.14, 863× lower** under ours | **Confirmed** |
| **H2** | Our re-implementation of preprocessing and sampling is identical to FASHN's | Written step by step from FASHN's source | Run both on the same inputs and seed (4 steps) and compare pixels | **0.00 / 255** difference (PSNR 148 dB) | **Confirmed** |
| **H3** | In segmentation-free + flat-lay mode, the human parser's output is never used | In FASHN's code, `disable_masking=True` returns the inputs untouched | Replace the parser with a stub that returns nothing and compare outputs | **0.00 / 255** difference | **Confirmed**. It can be skipped, removing the only non-commercial licence from our path |
| **H4** | The skirt failure is caused by segmentation-free mode keeping the old outfit: on a model in a dress there is no separate bottom to replace | L4: without a mask the model sees the dress and keeps its shape | Same skirt on a model wearing separates (tee + shorts) | **11/30 → 29/30** (36.7% → 96.7%) | **Supported** (one garment, one rater). The app now marks each model ✓/✗ for each garment type |
| **H5** | Our local run differs from the Space's because the starting noise differs between Apple and NVIDIA GPUs, even with seed 42 | Same seed, same code (H2), but different random-number implementations per device | Generate the noise on the CPU in both places and compare | Same garment and pose, different pixels (PSNR 22.4 dB) | **Untested**. Say so if asked |
| **H6** | LoRA can adapt the model to new garments while leaving the rest unchanged | LoRA literature; 1% of parameters; B = 0 start | Fine-tune on Indian pairs; compare against the base on held-out garments (PSNR, SSIM, garment L1, rubric) | Only a **memorisation test** so far: loss on 2 trained samples **−27.1%**, unseen sample **+1.1%** (no change), at half resolution | **Not tested yet.** The training path works end to end on the real model |
| **H7** | Weighting garment pixels 2× improves product fidelity | Sellers care about the product more than the background | Train with weight 1 and weight 2; compare garment L1 | — | **Not tested** (a design choice) |
| **H8** | A saree category works best when started from "one-pieces" | A saree covers both upper and lower body, like a dress | Train the new category from one-pieces vs from random; compare | — | **Not tested** |
| **H9** | The model can run on an 8 GB Mac | Weights are 1.9 GB in bf16 | Run it | Inference yes: our loader **2.04 GB vs FASHN's 3.9 GB (−48%)**, plus chunked attention; **22 min per image**. Training at full resolution **no** (memory full + 8.6 GB swap, no step in 8 min); half resolution yes (3.26 GB) | **Partly confirmed.** This is the measured reason we need a CUDA GPU |

Tell the H1 story in this order, because it is the strongest piece of reasoning in the project:

1. "The model came without training code, so it couldn't be adapted."
2. "But the sampler fixes what the network must predict. Reading it backwards gives the training
   rule."
3. "There are two plausible conventions. I tested which one is right in two independent ways."
4. "On a tiny model, mine reproduces the target under FASHN's own sampler and the reversed one
   makes it worse. On the real 972M weights, the pretrained model's loss is 863× lower under mine.
   The model already 'agrees' with my objective."
5. "So fine-tuning with this objective continues FASHN's training instead of fighting it."

---

## 5. What to show while testing, and what it means

| Show | What the professor sees | What it means |
|---|---|---|
| The app: navy crop top on a model (cached, instant) | The garment worn, before/after slider | The base model, used through our system (kind A) |
| The skirt example on the dress model vs the model in separates (baseline doc) | 11/30 vs 29/30 | H4: failure diagnosed from the architecture (L4) and fixed without training |
| The ✓/✗ marks on models in the studio | The app warns before a wasted generation | H4 turned into a product rule |
| `ml/runs/real-check/report.json` | `equal`, `parser` ≈ 0 difference; loss table | H2, H3, H1(b) |
| `cd ml && .venv/bin/python -m pytest -q tests` (≈ 26 s) | 12 passed | LoRA starts at the base model; convention test (H1a); save/load/merge; new category |
| `ml/runs/microrun/report.json` + the loss chart in the report | Loss falling on trained samples, flat on the unseen one | H6 path works. It is **memorisation**, not a quality gain |
| The 22-minute local timing | — | H9: why a GPU is the blocker |

---

## 6. Glossary (one line each)

- **Diffusion / flow model:** generates an image by starting from noise and removing it step by step.
- **Rectified flow:** a flow model trained to go from noise to image in a straight line, so few steps are needed.
- **Velocity (v):** the direction to move at each step, `image − noise`.
- **Timestep (t):** how far along the path the current image is: 0 = pure noise, 1 = finished.
- **Euler step:** `x ← x + Δt · v`, one small move along the predicted direction.
- **Classifier-free guidance (CFG):** run with and without the conditions, then exaggerate the difference.
- **Token / patch:** a 12 × 12-pixel square treated as one "word" for the transformer.
- **Attention:** each token computes how much to take from every other token.
- **Joint attention:** person tokens and garment tokens attend to each other in one operation.
- **MMDiT:** multimodal diffusion transformer: two input streams, separate weights, joint attention.
- **adaLN:** the timestep and category set a scale and shift inside every block.
- **VAE / latent:** a compressor that diffusion often works inside; FASHN doesn't use one.
- **Segmentation-free:** the model sees the whole person, old clothes included, with no mask.
- **LoRA:** a small trainable bypass `B·A` added next to a frozen layer.
- **Rank (r):** the width of that bypass (16 here).
- **bf16 / float32:** number formats; bf16 halves memory but has little precision.
- **Gradient checkpointing:** recompute activations during the backward pass to save memory.
- **PSNR / SSIM / L1:** pixel-level similarity scores (higher PSNR and SSIM are better, lower L1 is better).
- **Memorisation test:** training on a few samples to check the loss can fall; it proves the training runs, not that results get better.

---

## 7. References, and what we used from each

The report's reference list ([btp-report/report.html](btp-report/report.html)) has entries 1–23.
Those marked † below are **not** in the report yet. They are background for the layer
explanations; add them to the report if you cite them.

| Reference | Used for |
|---|---|
| FASHN AI, *FASHN VTON 1.5*, model card + code (commit 7c0f10a), 2026 | The model, its pipeline, its sampler: the source for everything in §3 |
| Han et al., *VITON*, CVPR 2018 | Origin of image-based try-on; warp-based baseline |
| Wang et al., *CP-VTON*, ECCV 2018 | Garment-characteristic preservation; why warping breaks |
| Choi et al., *VITON-HD*, CVPR 2021 | Paired data format; high-resolution try-on |
| Morelli et al., *Dress Code*, ECCV 2022 | Multi-category try-on (tops, bottoms, dresses); paired format |
| Ho et al., *DDPM*, NeurIPS 2020 | Diffusion: generating by denoising |
| Rombach et al., *Latent Diffusion*, CVPR 2022 | Latent (VAE) diffusion, and why FASHN avoids it |
| Zhu et al., *TryOnDiffusion*, CVPR 2023 | Try-on by attention instead of warping |
| Xu et al., *OOTDiffusion*, 2024; Choi et al., *IDM-VTON*, ECCV 2024; Chong et al., *CatVTON*, 2024 | Alternatives compared; licences |
| Peebles & Xie, *DiT*, ICCV 2023 | Transformer instead of U-Net; adaLN conditioning (L6) |
| Liu et al., *Rectified Flow*, ICLR 2023 | Straight-path generation; the velocity target (H1) |
| Lipman et al., *Flow Matching*, ICLR 2023 | The training objective family (H1) |
| Esser et al., *SD3 / MMDiT*, ICML 2024 | Two-stream joint attention (L8); logit-normal timesteps used in our loss |
| Black Forest Labs, *FLUX.1*, 2024 | Double- then single-stream design (L8, L9); FASHN's code base |
| Ho & Salimans, *Classifier-free guidance*, 2022 | Guidance (L11); why our loss drops all conditions 10% of the time |
| Hu et al., *LoRA*, ICLR 2022 | Adapter layers; B = 0 initialisation |
| Ge et al., *YOLOX*, 2021 | Person detector (L2) |
| Yang et al., *DWPose*, ICCV-W 2023 | Pose keypoints (L2) |
| Xie et al., *SegFormer*, NeurIPS 2021 | Human parser (L3); its licence (H3) |
| Hugging Face, *ZeroGPU* docs, 2026 | Free GPU, quota, 60-second reservation |
| Wang et al., *SSIM*, IEEE TIP 2004 | Evaluation metric |
| † Vaswani et al., *Attention Is All You Need*, NeurIPS 2017 | Self-attention |
| † Dosovitskiy et al., *An Image is Worth 16×16 Words (ViT)*, ICLR 2021 | Patch tokens (L5) |
| † Su et al., *RoFormer: rotary position embedding*, arXiv:2104.09864, 2021 | RoPE positions (L6) |
| † Chen et al., *Training Deep Nets with Sublinear Memory Cost*, arXiv:1604.06174, 2016 | Gradient checkpointing |
| † Loshchilov & Hutter, *Decoupled Weight Decay (AdamW)*, ICLR 2019 | Optimiser |
| † Loshchilov & Hutter, *SGDR (cosine schedule)*, ICLR 2017 | Learning-rate schedule |

---

## 8. If you remember only five things

1. **Problem:** flat garment photo → worn photo, free, without changing the product.
2. **Why this model:** pixel space keeps prints sharp; joint attention replaces warping; flat-lay
   input; free; Apache-2.0.
3. **Main research step:** the model had no training code. I recovered the training rule from its
   sampler and proved it on the real weights (863× lower loss than the alternative).
4. **What I added to the network:** LoRA adapters beside 96 layers (1.01%), plus a way to add new
   garment categories. The original weights stay frozen.
5. **What is measured vs not:** the system fix is measured (skirt 11 → 29/30). The fine-tune gain is
   **not** measured yet; it needs Indian garment pairs and a CUDA GPU.
