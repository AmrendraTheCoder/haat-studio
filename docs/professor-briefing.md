# Professor meeting — briefing

Your notes for presenting Haat Studio: what to say, what to show, the effort behind it,
how it scales, and what to ask for. The long version is [project-summary.md](project-summary.md).

---

## 1. The pitch (say this first, 30 seconds)

> "India has millions of small sellers who sell clothes on Instagram and WhatsApp. They
> have a flat photo of a kurti on a bed, no budget for a model shoot, and no idea what
> to post or what to charge. Haat Studio takes one phone photo of a garment and gives
> back the garment worn by a model, a ready Instagram post with the price and a caption,
> and a market plan for the shop — in English or Hindi, and it costs ₹0 to run."

Three tools, one flow: **photo → post → plan.**

---

## 2. How a seller uses it

*Priya runs a kurti business from home in Jaipur, 40 new pieces for Diwali.*

1. **Try-on studio** — photographs a kurti flat on her bed, uploads it, says "top",
   picks a model. ~15–30 s later she sees it worn, with a before/after slider.
2. **Post maker** — types name, ₹799, MRP ₹999. The app lays out "20% off" and
   "DM to order" on the photo in Instagram sizes and writes a Hinglish caption with hashtags.
3. **Market research** — answers 10 questions once and gets: who her buyers are,
   a 7-day post plan, her real profit per piece, and "Diwali is 13 days away".
4. **Hindi** — one tap in the header switches every screen, the post, the caption and
   the report to Hindi.

What used to need a photographer, model, designer and marketer takes a few minutes, free.

---

## 3. How it works (the architecture slide)

```
Phone/laptop            Our server (Next.js)                         Free AI services
garment photo ──▶ 1. clean the photo (upright, resize, strip GPS)
                  2. made this exact photo before? ── yes ─▶ instant, no GPU
                  3. one job at a time (protects free quota)
                  4. try-on engine ─────────────────────────────▶ FASHN VTON 1.5
live progress ◀── 5. save result, count GPU used  ◀────────────  (Hugging Face ZeroGPU)

post details ───▶ caption (checked: no invented prices) ────────▶ Gemini 2.5 Flash / Groq
post image: drawn by OUR code in the browser — exact text, never by an image AI

10 answers ─────▶ report = AI part (format-checked) + calculated part (profit, dates)
```

**Key line for the professor:** *"We didn't train the AI models. Our work is the system
around them — preparing inputs, protecting a tiny free quota, verifying every AI answer,
and measuring quality honestly."*

**Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, sharp (images), zod (validates
every input and every AI reply), Gradio client (calls Hugging Face), Vitest, Docker.

**Design decisions worth saying out loud (these show engineering judgement):**
- **Maths and dates are code, not AI.** Profit, margins and festival dates are calculated —
  language models get numbers wrong.
- **Text on images is layout, not AI.** Image models misspell prices, so we draw the text.
- **Check the AI, don't trust it.** A caption that quotes a price the seller didn't give is thrown away.
- **Never show a fake result.** Empty example slots say so; test output is labelled.
- **Degrade, don't fail.** If the AI is unavailable, a labelled template takes over.
- **Privacy.** GPS/camera data stripped from photos before anything is stored.
- **Quota meter.** Hugging Face doesn't expose the free balance, so the app counts its
  own GPU use and learns the hidden daily run limit from the refusal message.

---

## 4. What to show (8–10 minute demo)

| # | Screen | What to do | What to say |
|---|---|---|---|
| 1 | Home page | Drag the hero before/after slider | "This is the problem and the result." |
| 2 | Studio | Pick the **navy crop top** sample → Continue → point at ✓/✗ on models → Create | Read the live panel aloud: prepare → check saved → GPU queue → generate → saved |
| 3 | Result | Drag the slider, open full screen, show the 3 download sizes | "Same garment, same lace sleeves, now worn." |
| 4 | Post maker | "Make it a post" → name, ₹799, MRP ₹999 → switch Post/Story/Square and the 3 looks → Write caption (Hinglish) → Download | "Exact text — we draw it, the AI doesn't." |
| 5 | Research | Open a prepared report | Buyers, week plan, the calculated profit warning, upcoming festival |
| 6 | Hindi | Tap **हिन्दी** in the header, revisit studio + report | "Built for sellers who prefer Hindi." |
| 7 | Quota chip | Point at "Free GPU · N photos left" | "We run entirely on a free tier — the app tells you exactly what's left." |
| 8 | /design page + baseline table | Show the skirt lesson | "We measure, and a failure changed the product." |

**The skirt story (tell it — professors like it):** a skirt on a model in a dress scored
11/30 because there was no separate bottom to replace; on a model in a T-shirt and shorts
it scored 29/30. So now the app marks every model ✓/✗ for the garment type and warns before
a wasted generation.

### Before the meeting — checklist

- [ ] Start it: `cd ~/Desktop/haat/haat-studio && npm run build && npm run start:standalone`, open http://localhost:3000.
- [ ] **Don't spend photos beforehand.** The free account allows about **8 photos a day**;
      the count refills 24 h after the first photo of the day. Check the header chip.
- [ ] **Safe demo trick:** the navy crop top sample on the women's standing model was already
      generated, so re-creating it is answered from the saved result — instant and uses **no GPU**.
      Use that in front of the professor; only try a new garment if the chip shows photos left.
- [ ] Have one research report already open in a tab (4 are saved).
- [ ] Internet on (try-on and captions need it); the featured examples on the home page are the fallback.
- [ ] Phone ready to show the same flow at mobile size, if asked.

---

## 5. Effort — what went into it

| | |
|---|---|
| Timeline | Started 2 Oct 2026; phases 1–6, UX pass, Hindi and quota meter done by 26–27 Oct |
| Code | ~8,400 lines of TypeScript across app, libraries and tests |
| Tests | 54 automated tests (no network), plus live checks against the real GPU and Gemini |
| Phases | 1 UI + demo mode · 2 first real results + baseline · 3 quality (partly) · 4 post maker · 5 market research · 6 deployment |
| Docs | Project summary, baseline evaluation, deployment guide, 7-part UX documentation (users, journeys, screens, design system, usability test plan, accessibility audit, design critique) |
| Quality bars | WCAG 2.1 AA accessibility (44 px touch targets, contrast, keyboard), works at phone width, every disabled button explains why |

**Problems found and fixed (shows real engineering, not a tutorial):**
- Anonymous GPU calls refused → token-based access, checked by `npm run engine:check`.
- Re-uploading the same photo wasted GPU → results cached by a hash of the inputs.
- Phone photos carried GPS location → stripped.
- Browser cache showed a test image instead of the real one → separate cache keys for test runs.
- Gemini wrote Hindi hashtags in Devanagari (unsearchable) → rule moved into the system prompt.
- Free tier refused after 8 photos with time still left → discovered a hidden run limit; the quota meter now learns it.

---

## 6. How it scales

**Today:** runs on a laptop or a free Hugging Face Space, ~8 photos/day on one free account.

| Stage | What changes | Rough cost |
|---|---|---|
| Classroom pilot (10–30 sellers) | Hugging Face PRO (40 GPU-min/day, ~80 photos/day) or the institute's GPU; passcode-protected public link (already built) | ~$9/month, or ₹0 on college hardware |
| Real launch (hundreds of sellers) | Run the open-source FASHN model on our own rented GPU, or the paid FASHN API ($0.075 ≈ ₹6 per photo); user accounts + cloud storage | Pay per use — a seller could be charged per post |
| Product | WhatsApp/Instagram integration, live market data, Indian garments (kurti, salwar, saree) and Indian model presets, more regional languages | — |

**Why it can scale:** the try-on engine sits behind one replaceable interface — switching
from the free Space to a paid API or our own GPU is one file. All AI calls go through one
point that already caches, de-duplicates and queues.

**Business angle (if asked):** a free tier with a few photos a day, a paid plan per photo
or per month; the comparison is a model shoot costing thousands of rupees per day.

---

## 7. Honest limits (say them before he asks)

- Tested on Western sample garments so far; kurtis/sarees need real photos (sarees may be beyond this model).
- Output is ~576 px wide, enlarged for full Instagram sizes.
- Research uses the AI's general knowledge, not live web data — the report says so.
- ~8 free photos a day.
- One component of the try-on model is licensed for research only → this is a research demo, not yet a commercial product.
- No user accounts yet. Hindi wording not yet reviewed by a native speaker.

---

## 8. What we need from the professor

1. **GPU access** — the institute's GPU server or lab credits, to run the try-on model
   ourselves and lift the 8-photos-a-day limit (the single biggest blocker).
2. **Real sellers / garments** — introductions to 5–10 local Instagram sellers (or students who
   sell) to collect kurti/salwar photos for Phase 3 and run the usability test in docs/ux/05.
3. **Approval for a small user study** — consent forms/ethics guidance for testing with real sellers.
4. **Feedback on scope** — which to deepen next: try-on quality for Indian wear, or the
   research/post tools, or turning it into a paper (evaluation of virtual try-on on Indian garments).
5. **Guidance on licensing** — the research-only component, before anything commercial.
6. **Next steps** — incubation cell / startup programme introduction if he sees potential,
   and a Hindi-speaking reviewer for the interface wording.

---

## 9. Likely questions — short answers

- **"Did you train the model?"** No. FASHN VTON 1.5 is open source. We built the system,
  the safeguards, the evaluation and the three tools around it.
- **"Why not just use ChatGPT/an image AI?"** Image AIs misspell prices and change the
  garment; we keep the real garment and draw exact text ourselves. And we measured it.
- **"How do you know it's good?"** Baseline evaluation: 4/4 generations succeeded; tops
  28–30/30; the one failure (11/30) was explained and fixed in the product.
- **"What does it cost?"** ₹0 today. Paid path ≈ ₹6 per photo.
- **"What's new here?"** The full photo → post → plan flow for Indian small sellers, in Hindi,
  on a free tier, with verified AI output.

---

## 10. Other models we could have used, and why we didn't

Researched 21 Sept 2026 from each project's own repository, licence and demo page.
We have **not** yet run them side by side on our garments; that's an honest next measurement.

| Option | What it is | Why not (for this project) |
|---|---|---|
| **FASHN VTON 1.5** ✅ chosen | 972M-parameter try-on diffusion transformer | — accepts **flat-lay** garment photos (what sellers actually have), no mask needed, official free ZeroGPU Space works, Apache-2.0 core, small enough (~8 GB VRAM) to self-host later |
| Leffa | Strong fine-detail try-on, MIT core | Close second; its default preprocessing carries separate licence terms. First candidate for a head-to-head test |
| IDM-VTON | Best-known research baseline | CC BY-NC-SA (non-commercial), heavier preprocessing (masks, DensePose) |
| OOTDiffusion | Half/full-body try-on | CC BY-NC-SA, older CUDA setup |
| CatVTON | Lightweight (~8 GB at 1024×768) | CC BY-NC-SA; its official demo was erroring when checked |
| FitDiT | Higher-resolution try-on | CC BY-NC-SA, weights need an access request, mask workflow |
| StableVITON, FastFit | Academic baselines | Non-commercial; need structured inputs rather than a phone photo |
| Kolors Virtual Try-On (Kuaishou) | Popular demo | Closed weights; the hosted API we found was deprecated |
| General image editors (Gemini image, FLUX Kontext, Qwen Image Edit, GPT image) | "Put this shirt on a person" by prompt | Not built for try-on: they tend to redraw the garment (pattern, logo, colour) — fatal for a seller, whose product must stay exactly the same; free quotas are small or none |
| Paid try-on APIs (FASHN API $0.075, Google VTO $0.06, fal $0.04–0.10, Replicate IDM-VTON ~$0.023 per image) | Hosted, reliable | Cost money — project rule was free only. Kept as the scaling path |
| Running a model on the laptop | — | M3 Air has 8 GB *shared* memory and no CUDA; the FASHN pipeline picks CUDA or CPU, not Apple's GPU |

**One sentence:** we picked the only free, working option that takes a flat garment photo, needs no mask,
keeps the product's details, and has a licence close to commercial use.

## 11. What happens on the GPU

**The hardware.** Hugging Face **ZeroGPU** is a shared pool of **NVIDIA RTX Pro 6000 Blackwell** GPUs.
Each call gets, by default, a `large` slice = **half a card, 48 GB of VRAM** (`xlarge` = full card, 96 GB, costs 2× quota).
FASHN needs only ~8 GB, so it fits easily. The GPU is not ours permanently: it's attached for one
function call and released straight after — that's how it can be free.

**How a Space uses it.** The Space is a Python/Gradio app. At start-up the model weights are placed "on
CUDA" in an emulation mode (no real GPU yet). The try-on function is wrapped in `@spaces.GPU`; when a
request arrives, ZeroGPU attaches a real GPU slice, runs the function, and detaches it. The default
reservation is **60 seconds**; FASHN doesn't declare a shorter one, so every call needs 60 s of quota left
to *start*, although it is billed only for the ~25 s it actually uses.

**One try-on, step by step:**

```
Our server (Next.js)                 Hugging Face Space (fashn-ai/fashn-vton-1.5)        GPU slice
1. clean photos (sharp)
2. cache miss → queue lock
3. @gradio/client upload ─────────▶  4. job enters the Space's queue (~3–4 s)
   with HF token (our quota)          5. ZeroGPU attaches half an RTX Pro 6000 ───────▶ (48 GB)
                                      6. DWPose (+YOLOX person detector): body keypoints
                                      7. FASHN Human Parser (SegFormer): body/clothes regions
                                      8. MMDiT denoising, 30 steps (Balanced), guidance 1.5,
                                         seed 42, bfloat16, directly on pixels (no VAE)
                                      9. 576 × 864 image  ◀──────────────────────────── GPU released
10. stream events to the browser ◀── result
11. save, make Instagram sizes, record GPU seconds in the quota ledger
```

**The model itself.** FASHN VTON 1.5 is an **MMDiT** (multimodal diffusion transformer, the same family
as Stable Diffusion 3 / FLUX), **972 million parameters**, trained from scratch on 18 M try-on pairs plus
4 M synthetic examples. Unusually it works **in pixel space**: it cuts the image into 12×12-pixel patches
instead of compressing it with a VAE, which helps keep fine detail such as logo letters. Structure:
4 patch-mixer blocks → 8 double-stream blocks (person and garment attend to each other) →
16 single-stream blocks; hidden size 1280, 10 attention heads. It starts from noise and removes a bit
of it at each of the 30 steps, guided by the person's pose and the garment image.

**Settings we send** (src/lib/tryon/fashn-space.ts): category (tops / bottoms / one-pieces),
photo type (flat-lay or worn), steps 20 / 30 / 50 for Fast / Balanced / Best, guidance 1.5, seed,
segmentation-free on.

**Timings.** FASHN reports ~5 s on an H100. We measure ~13 s warm and ~30 s cold end to end: queue,
upload, pose and parsing, half a GPU rather than a whole H100, and on a cold start loading the
Space onto a GPU node.

**Quota maths.** Free: 5 GPU-minutes a day (PRO 40, then $1 per 10 min), reset 24 h after first use,
plus an unpublished daily run limit (we hit it at 8 photos). Remaining quota also sets queue priority.

## 12. The model layer by layer — and what we changed

**Say this first:** the network is FASHN's and we have not retrained it. Our work is the training
method we reconstructed, the fine-tuning kit, one finding about the parser, and the pipeline around
the model. Full detail with code references: [model-report.md](model-report.md).

### 12.1 The layers (FASHN VTON 1.5)

| # | Layer / stage | What it does | Our change |
|---|---|---|---|
| 1 | Input prep | Resize to fit 864 px, pad to 864 × 576, scale to [−1, 1] | App-side `prepareImage()`: upright, flatten transparency, ≤ 1536 px, strip GPS, white background |
| 2 | Pose — YOLOX-L + DWPose | Skeleton, each limb its own grey level | None. It is why our kit never mirror-flips training images |
| 3 | Human parser — SegFormer, 18 labels | Body and clothing regions | **Finding:** its output is unused in our mode (12.2 §5) |
| 4 | Clothing-agnostic person | Masked: old outfit greyed. Segmentation-free: photo unchanged | We use segmentation-free: better body, free garment length; old outfit can leak |
| 5 | Patch tokenizer (no VAE) | 12 × 12-pixel patches → 3,456 tokens per image | None |
| 6 | Embedders | Person 7 channels (noisy image, photo, pose), garment 4 → 1280 wide; timestep + category condition every block (adaLN) | None. Kit can add new categories (saree, lehenga) |
| 7 | 4 patch-mixer blocks | Self-attention among person patches | LoRA target in the `all` preset |
| 8 | 8 double-stream blocks | Separate weights per stream, one joint attention over 6,912 tokens — where garment detail reaches the body | **Default LoRA target** |
| 9 | 16 single-stream blocks | Shared weights on the merged tokens | **Default LoRA target** |
| 10 | Final layer | Keeps person tokens → 864 × 576 velocity image | None |
| 11 | Sampler | Rectified flow, 30 Euler steps, schedule shift mu 1.5, guidance 1.5 (last step unguided) = 60 forward passes | App exposes 20 / 30 / 50 steps (Fast / Balanced / Best) and the seed ("variation") |

### 12.2 What we added

1. **Reconstructed the training objective.** FASHN released inference code only. From its sampler we
   derived: target velocity = photo − noise; timesteps from a shifted logit-normal (like the sampler);
   all conditions dropped together 10% of the time so guidance still works (`ml/haat_ft/flow.py`).
   **Our own addition:** garment pixels weigh 2× in the loss — errors on the product cost double.
2. **LoRA fine-tuning kit** (`lora.py`, `train.py`): rank-16 adapters on 96 attention + MLP layers, 1.01% of
   parameters, an adapter of tens of MB instead of 2 GB. Starts exactly at the base model; can be
   merged or switched off. Gradient checkpointing; best adapter by validation loss is kept.
3. **Data preparation** matching FASHN's preprocessing: paired masked samples and synthetic triplets
   whose target is always a real photo.
4. **Evaluation**: PSNR, SSIM and L1 on garment pixels, base vs. adapter on the same inputs and seed;
   our 30-point human rubric stays as the final check.
5. **Parser finding.** With segmentation-free mode and a flat-lay garment, both parser outputs are
   thrown away. Skipping it saves time and removes the only research-only licence from our path.
6. **Inference tuning**: `sweep.py` grids steps, guidance, seed and two knobs the public Space hides
   (`time_shift_mu`, `skip_cfg_last_n_steps`) — one reason to run our own Space.

### 12.3 Evidence

| Check | Result | Source |
|---|---|---|
| Objective convention, tiny model | Ours: error 0.80 → 0.005. Reversed: 0.80 → 1.14 | `ml/tests/test_finetune.py` |
| Loss on real weights at t = 0.1 … 0.9 | Ours 0.004–0.012; reversed 4.3–6.4 | `ml/runs/real-check/report.json` |
| Our code vs FASHN's pipeline (4 steps) | Identical (difference 0.0) | same |
| With vs without the parser (4 steps) | Identical (difference 0.0) | same |
| Local 30-step run vs the Space, seed 42 | PSNR 22.4 dB — same garment and pose, not the same pixels (likely different starting noise on Apple vs NVIDIA GPUs) | same |
| Local run on the M3 | 22 min per image, 4 GB memory — not usable for serving | same |
| App try-on baseline | Tops 29–30 / 30, ~13 s warm; bottom on a dress-wearing model 11 / 30 | [eval-2026-10-26-baseline.md](eval-2026-10-26-baseline.md) |

### 12.4 What we cannot claim yet

- **No quality gain from fine-tuning** — no fine-tune has run. It needs 300–500 Indian garment pairs
  (with sellers' consent) and a CUDA GPU with ≥ 16 GB for a few hours.
- **Hyper-parameters are standard defaults** for this model family, not tuned on our data.
- **The inference sweep has not been run** yet, so there are no tuned settings to report.
- **LoRA has only been run as a memorisation test** — 100 steps at half resolution on the laptop (loss on the
  trained samples −27.1%, unseen sample +1.1%). Full resolution does not fit in 8 GB. See `docs/btp-report/`.
