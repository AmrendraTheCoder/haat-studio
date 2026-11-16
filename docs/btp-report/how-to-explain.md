# How to explain the project to the professor

Speaking guide for the 5th-semester mini project report (`Mini-Project-Report-Virtual-Try-On.pdf`), guide: Dr. Nishant Gupta. Every number below is
measured and has a source file. Where something was not done, the guide says so — say it
yourself before he asks.

## The one-minute version

> "Small sellers only have flat photos of garments. A virtual try-on model can put the garment
> on a person. I took the best open model, FASHN VTON 1.5 — 972 million parameters — which was
> released **without any training code**. I worked out how it works layer by layer, rebuilt its
> training method from the inference code, proved on the real weights that my reconstruction is
> right, and built a LoRA fine-tuning framework on top. I also built the system that serves it
> for free and measured its quality. What I have **not** done yet is the actual fine-tune on
> Indian garments — that needs a dataset and a GPU I don't have yet."

## Be exact about what is yours

| Theirs (FASHN AI) | Yours |
|---|---|
| The network design and the pretrained weights | The layer-by-layer analysis |
| The inference code | The reconstructed training objective + garment-weighted loss |
| | The LoRA framework (adapters, data prep, training loop, evaluation, new categories) |
| | Running it in 8 GB (loader, chunked attention) |
| | The parser finding |
| | The serving system and the baseline |

Don't say "I improved the model" or "I added layers to the model" without qualifying it.
Say: **"I added trainable LoRA adapter layers beside 96 of its layers; the original weights stay frozen."**

## 1. How the model combines the two photos (Section III)

1. **Two streams.** Person stream = noisy image + person photo + pose drawing (7 channels).
   Garment stream = garment photo + pose (4 channels).
2. **Patches, no VAE.** Each is cut into 12×12-pixel patches → 3,456 tokens each. Working on
   raw pixels is why printed text on a T-shirt survives.
3. **The garment is the prompt.** In FLUX the second stream is text; here it is the garment.
4. **Joint attention.** In 8 double-stream + 16 single-stream blocks all 6,912 tokens attend to
   each other. A chest token reads from the logo token. No warping.
5. **Rectified flow.** Start from noise; 30 Euler steps along the predicted velocity; each step
   runs twice for guidance (scale 1.5) → **60 forward passes per photo**.

## 2. What LoRA is and exactly what you did (Section IV)

- For a frozen layer `W`, learn a small update: `y = W·x + (α/r)·B·A·x`, rank r = 16.
- `B` starts at zero → the adapted model starts **identical** to the original (tested).
- **Where:** attention + MLP layers of the 8 double-stream and 16 single-stream blocks = **96 layers**.
- **How many:** **9,830,400** trainable parameters added to **971,813,808** frozen = **1.01%**.
- **Three model-specific decisions:**
  1. adapters in float32 although the model is bf16 (small updates vanish in bf16);
  2. modulation layers left frozen (they control every sampling step);
  3. one adapter on the fused `linear1` of single-stream blocks covers attention and MLP.
- **Your own loss design:** garment pixels count **2×** — a wrong print is a wrong product.
- **New categories:** saree / lehenga can be added as category 4 / 5, initialised from one-pieces.

## 3. How you know the reconstruction is right (Section VI-A, VI-B)

| Evidence | Number |
|---|---|
| Tiny model trained with your loss, sampled by **FASHN's own sampler** | error 0.80 → 0.005 (**−99.4%**) |
| Same, with time reversed | error 0.80 → 1.14 (**+43%**, worse) |
| Real weights: loss under your convention vs reversed | 0.0060 vs 5.14 → **863× lower** |
| Your inference code vs FASHN's pipeline | **0.00 / 255** difference — identical |
| Automated tests | **12 / 12** framework, **54 / 54** application |

## 4. The parser finding (Section VI-B)

In the mode the app uses (segmentation-free + flat-lay garment), the human parser runs but its
output is thrown away. Proof: replace it with a stub → **0.00 / 255** change in the output.
Why it matters: it is the only part with a non-commercial licence, and skipping it saves time.

## 5. Output quality — what was measured (Section VI-C, VI-D)

| Garment | On model wearing | Score |
|---|---|---|
| Black logo tee | tee + chinos | 30/30 = **100%** |
| Navy crop top | dress | 28/30 = **93.3%** |
| White skirt | dress | 11/30 = **36.7%** ← failure |
| White skirt | tee + shorts | 29/30 = **96.7%** |

**The one real output improvement:** the skirt went **36.7% → 96.7%** (+60 points, **+163.6%**
relative) after you changed the system to pair bottoms with a model wearing separates. Say
clearly: this came from *how the model is used*, not from fine-tuning; one garment; one rater.

## 6. LoRA on the real weights (Section VI-E)

A real LoRA training run on the real 972M model, on your laptop, 12 November 2026.

| | |
|---|---|
| Adapters | 96 layers, 9,830,400 parameters (1.01%) |
| Resolution | **half**: 432 × 288 (1,728 tokens instead of 6,912) |
| Steps | 100 (batch 1, learning rate 10⁻⁴) |
| Time | ~7 s per step, 13.4 min total |
| Memory | 3.26 GB |
| Loss on the 2 trained samples | 0.00510 → 0.00372 = **−27.1%** |
| Loss on the 1 unseen sample | 0.01067 → 0.01079 = **+1.1%** (no real change) |
| Adapter file | **37.5 MB** vs 1,854 MB base = **2.0%** |

**How to say it:**
> "I ran my LoRA training on the real model. In 100 steps the loss on the training samples fell
> 27%, and the saved adapter is 37.5 MB — 2% of the model. This proves the fine-tuning path
> works end to end on the real network."

**Then say the three caveats yourself:**
1. **It is a memorisation test, not a quality improvement.** The targets were the model's own
   outputs, so there was nothing new to learn. The unseen sample didn't improve (+1.1%), which
   is exactly what you'd expect.
2. **It ran at half resolution.** A full-resolution training step doesn't fit in 8 GB: it filled
   memory plus 8.6 GB of swap and didn't finish one step in 8 minutes. Two earlier attempts
   died without an error. That is the measured reason a CUDA GPU is needed.
3. **Only 2 training samples and 1 held-out sample.**

If he asks "by how much did LoRA improve the output?" the honest answer is: **"Not yet measured.
This run shows the training works; improvement needs real paired data."**

## 7. GPU and compute (Table III)

| | |
|---|---|
| Weights | 1,854 MB on disk (bf16) |
| GPU memory to run | ~8 GB (model card) |
| On your M3: after load / after generating | 2.04 GB / 4.05 GB |
| Your loader vs FASHN's | 2.04 GB vs 3.9 GB (**−48%**) |
| Per photo | 60 forward passes over 6,912 tokens; roughly 10¹⁵ operations (estimate) |
| Hosted (half an RTX Pro 6000, 48 GB) | **13.5 s** warm, ~31 s cold |
| NVIDIA H100 | ~5 s (model card) |
| Your M3 laptop | **1,344 s** (~22 min) — about 100× slower than hosted |
| Free quota | 5 GPU-minutes/day; refused after 8 runs |

## 8. Questions he is likely to ask

**"So did fine-tuning improve the output?"**
"Not measured. I have not fine-tuned on real data. The framework is built and verified; I need
300–500 paired photos of Indian garments and a 16 GB CUDA GPU. That is the next phase."

**"Then what is your contribution?"**
"The model shipped with no way to train it. I reconstructed the training objective and proved it
against the released weights — 863× lower loss than the wrong convention — and built the whole
fine-tuning framework. Nobody can adapt this model without that."

**"Why LoRA and not full fine-tuning?"**
"A few hundred pairs would make a 972M model forget what it learned from 18M pairs. LoRA trains
1.01% of the parameters, the adapter is ~40 MB instead of 1.9 GB, it fits a 16 GB GPU, and it
can be merged or removed."

**"Why this model?"**
"It accepts flat-lay photos, needs no mask, is Apache-2.0, has a free hosted demo, and works in
pixel space so logos and prints survive."

**"Why does your local result differ from the hosted one?"**
"Same garment and pose, different pixels (PSNR 22.4 dB). Probably the random noise differs
between Apple and NVIDIA GPUs with the same seed. I have not verified that — it's a hypothesis."

**"How reliable are the quality scores?"**
"Four images, one rater. It's a baseline, not a benchmark. A proper evaluation needs held-out
garments, two raters, and PSNR/SSIM/garment-L1 — the evaluation script for that is written."

## Where each number comes from

| Number | File |
|---|---|
| Real-weight checks | `ml/runs/real-check/report.json` |
| LoRA run | `ml/runs/microrun/report.json`, `log.csv` |
| Rubric scores, timings | `docs/eval-2026-10-26-baseline.md` |
| Tests | `cd ml && .venv/bin/python -m pytest -q tests` ; `npm test` |
