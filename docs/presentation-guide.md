# Presentation guide: system, folders, running it, what to open

Your one-page-at-a-time companion for the meeting with the professor. It answers four things:

1. **How the system is engineered**: the parts, how a request moves through them, and why.
2. **How to find your way around the folders**: what lives where.
3. **How to run each part**: the app, the tests, the ML kit and the report.
4. **What to open for which question**, with short answers that are ready to say.

Each number here comes from a file in the repo, and the file is named next to it. Three other
documents go with this one: [research-guide.md](research-guide.md) (the problem, the layers,
the hypotheses and the papers behind them), [professor-briefing.md](professor-briefing.md)
(pitch, demo script, scaling, what to ask for) and [model-report.md](model-report.md) (the
model in depth).

---

## 1. The system in one picture

```
                     ┌──────────────────── Browser (React 19) ────────────────────┐
                     │  /studio        3 steps: Product → Model → Photo            │
                     │  /studio/post   canvas post maker (text drawn by our code)   │
                     │  /research      10-question form → saved report             │
                     └───────┬──────────────────┬───────────────────┬──────────────┘
                 multipart   │ NDJSON stream    │ JSON              │ JSON
                             ▼                  ▼                   ▼
┌──────────────────────── Our server (Next.js 16 route handlers) ──────────────────────────┐
│ POST /api/tryon ─▶ requirePasscode ─▶ zod settings ─▶ prepareImage (sharp)               │
│                                          │                                                │
│                                          ▼                                                │
│                    studio().start()  ← THE ONLY PLACE A TRY-ON HAPPENS                    │
│                      1. cache: key = sha256(garment, person, settings) → data/results/    │
│                      2. in-flight sharing: same key while running → join that job         │
│                      3. GPU lock: one generation at a time (free quota is shared)         │
│                      4. engine chain: try each engine, record every failure               │
│                      5. usage hook → quota ledger (data/gpu-quota.json)                   │
│                                                                                           │
│ POST /api/caption  ─▶ completeJSON (LLM chain + zod) ─▶ price check ─▶ or template        │
│ POST /api/research ─▶ code: profit + dates │ LLM: buyers, trends, plan ─▶ data/research/  │
└──────────────────────────────┬────────────────────────────────┬──────────────────────────┘
                               ▼                                ▼
          FASHN VTON 1.5 on Hugging Face ZeroGPU        Groq (Llama 3.3 70B) / Gemini 2.5 Flash
          (Gradio client, HF_TOKEN, free tier)          (free keys; template if none answer)
```

**Separate from the app:** [ml/](../ml/) is a Python and PyTorch kit that runs the same
model locally and fine-tunes it with LoRA. It doesn't serve the app today. Section 8 of the
model report describes how it would plug in, as a new engine file.

### 1.1 The engineering principles (say these; each is enforced in code)

| Principle | Where it is enforced | Why |
|---|---|---|
| One entry point for every try-on | `createStudio()` in [studio.ts](../src/lib/tryon/studio.ts) | Cache, dedupe, lock and error reports can't be skipped by any route or script |
| Engines are swappable adapters | `Engine` interface in [types.ts](../src/lib/tryon/types.ts), registry `ENGINES` in [index.ts](../src/lib/tryon/index.ts) | Moving from the free Space to a paid API or our own GPU is one file |
| Report every attempt, not just the last | `attempts[]` + `explain()` in [studio.ts](../src/lib/tryon/studio.ts) | The seller sees one sentence; the developer sees each engine's error |
| The cache key *is* the request | `cacheKey()` in [store.ts](../src/lib/tryon/store.ts) | Same inputs → same saved image, zero GPU |
| Maths and dates are code, not AI | `economics()`, `upcomingMoments()` in [research/build.ts](../src/lib/research/build.ts) | Language models get numbers wrong |
| Check the AI, don't trust it | `pricesMentioned()` in [caption.ts](../src/lib/posts/caption.ts); zod schemas | A caption with an invented price is rejected |
| Degrade, don't fail | template fallbacks in caption.ts and build.ts | No AI key or provider down → labelled template |
| Text on images is layout | `renderPost()` in [render.ts](../src/lib/posts/render.ts) | Image models misspell prices |
| Never show an invented result | placeholders on the landing page, echo engine labelled "test engine" | Honesty in a demo |
| Live progress is derived from server events | [Pipeline.tsx](../src/components/studio/Pipeline.tsx) | No fake progress bars |
| Privacy | `prepareImage()` strips EXIF/GPS in [image.ts](../src/lib/tryon/image.ts) | Location data never leaves our server |

### 1.2 Life of one try-on request (follow this when asked "walk me through it")

1. The browser checks the file (type, size, at least 256 px) **before** uploading. The
   rules are in [limits.ts](../src/lib/limits.ts) and the same rules run again on the server.
2. `POST /api/tryon` ([route.ts](../src/app/api/tryon/route.ts)) checks the passcode
   ([guard.ts](../src/lib/guard.ts)), then validates the settings with zod.
3. `prepareImage()` turns the photo upright, flattens transparency onto white, shrinks it to
   at most 1536 px and strips metadata. A photo that is already a clean JPEG passes through
   byte for byte, so its cache key stays the same.
4. `studio().start()` computes the key and emits `accepted` and `prepared`.
5. On a cache hit it emits `checked {hit: true}` and then `done {cached: true}`. **No GPU is
   used.**
6. On a miss it waits for the GPU lock (emitting `waiting` if another job is running), then
   calls the engine: [fashn-space.ts](../src/lib/tryon/fashn-space.ts) sends the job to the
   Space's `/try_on` endpoint through the Gradio client.
7. The Space reports its progress (queue position, running, data), and we pass each event on
   to the browser as a line of NDJSON ([stream.ts](../src/lib/tryon/stream.ts)).
8. The result is converted to PNG and saved to `data/results/<key>/` together with
   `garment.jpg` and `person.jpg`. The GPU seconds go into the quota ledger.
9. The browser shows the before/after slider and offers downloads at Instagram sizes
   (`exportFor()`).
10. If the tab closes mid-job, **the job keeps running** and the result still lands in the cache.
    `/studio?r=<key>` reconnects to it through `GET /api/tryon/[key]`.

Errors are sorted into kinds (`input`, `quota`, `timeout`, `unavailable`, `unknown`). An `input`
error stops the chain; any other kind moves on to the next engine.

---

## 2. Folder map: where everything is

```
haat-studio/
├── README.md               what the app does, setup, scripts (start here if new)
├── CLAUDE.md               the engineering rules + 19 "traps" we hit and how we fixed them
├── .env.example            every setting, explained; copy to .env
├── package.json            all npm commands
├── Dockerfile              production image for Hugging Face Spaces (port 7860)
│
├── src/
│   ├── app/                PAGES and API ROUTES (Next.js file-based routing)
│   │   ├── page.tsx                    landing page  →  /
│   │   ├── studio/page.tsx             try-on studio →  /studio
│   │   ├── studio/post/                post maker    →  /studio/post?r=<key>
│   │   ├── research/ , research/[id]/  questionnaire, saved report
│   │   ├── design/                     "How it's designed" page
│   │   └── api/                        tryon, tryon/[key], results, caption, research, quota, featured
│   │
│   ├── lib/                ALL LOGIC (no UI)
│   │   ├── tryon/          ★ the try-on core
│   │   │   ├── studio.ts       cache → in-flight sharing → GPU lock → engine chain
│   │   │   ├── fashn-space.ts  adapter for the FASHN Space; classify() ZeroGPU errors
│   │   │   ├── image.ts        prepareImage(), exportFor()
│   │   │   ├── store.ts        cacheKey(), disk store
│   │   │   ├── quota-ledger.ts records GPU runs and refusals
│   │   │   ├── types.ts        settings schema, Engine interface, events
│   │   │   ├── echo.ts         fake engine for testing the UI
│   │   │   └── index.ts        engine registry + studio() singleton
│   │   ├── quota.ts        free-GPU quota maths (pure functions)
│   │   ├── llm/index.ts    completeJSON(): the only text-AI call site
│   │   ├── posts/          spec.ts (templates, ₹ formatting), render.ts (canvas), caption.ts
│   │   ├── research/       schema.ts, build.ts (prompt, economics, festival dates)
│   │   ├── i18n/           messages.ts: every English + Hindi string
│   │   ├── guard.ts        passcode check; limits.ts upload rules; presets.ts models
│   │   └── client/         browser helpers (keyboard nav, share, passcode)
│   │
│   └── components/         UI pieces: studio/ (StudioApp state machine, Steps, Pipeline,
│                           ResultStep), posts/PostMaker, research/ResearchForm, shared/, site/
│
├── tests/                  54 Vitest tests, no network (studio, inputs, quota, posts+research)
├── scripts/                setup.ts, engine-check.ts, llm-check.ts, eval.ts
│
├── docs/
│   ├── professor-briefing.md   pitch, demo script, Q&A, scaling, asks
│   ├── model-report.md         the model: architecture, maths, fine-tuning, measurements
│   ├── eval-2026-10-26-baseline.md   scored quality baseline (29–30/30 tops, 11/30 skirt)
│   ├── project-summary.md      plain-language overview
│   ├── deploy.md               putting it online
│   ├── ux/                     7-part UX documentation (users → accessibility audit)
│   └── btp-report/             mini project report (report.html), study + simple guides,
│                               how-to-explain.md, build.py (fills numbers, draws charts)
│
├── ml/                     ★ the model work (Python)
│   ├── haat_ft/            data.py · flow.py (loss) · lora.py · train.py · infer.py · metrics.py
│   ├── scripts/            download_weights, prepare_data, train_lora, evaluate, sample,
│   │                       sweep, check_real_model, lora_microrun
│   ├── tests/test_finetune.py   12 tests on a tiny model
│   ├── runs/               measured results: real-check/report.json, microrun/report.json + logs
│   └── weights/ , .venv/   2.1 GB weights, Python env (not committed)
│
├── data/                   runtime data (not committed): results/<key>/, research/<id>.json,
│                           gpu-quota.json
└── eval/reports/           eval output (not committed)
```

**Rule of thumb:** `src/app` holds *where* things appear, `src/lib` holds *what* actually
happens, and `src/components` holds *how* they look.

---

## 3. How to run everything

Run these in your own terminal from `~/Desktop/haat/haat-studio`.

### 3.1 First time only

```bash
npm install
npm run setup            # downloads the preset model photos + sample garments into public/
cp .env.example .env     # then fill HF_TOKEN (required for try-on) and GEMINI_API_KEY or GROQ_API_KEY
```

### 3.2 Check the outside services before the meeting (uses no GPU quota)

```bash
npm run engine:check     # HF token valid? Space up? Its API still matches what we send?
npm run llm:check        # which text-AI providers answer
```

### 3.3 Start the app

| Situation | Command | Open |
|---|---|---|
| **Demo (recommended)**, production build | `npm run build && npm run start:standalone` | http://localhost:3000 |
| Development, hot reload | `npm run dev -- --port 3100` | http://localhost:3100 |
| **No internet or no token**: fake engine, labelled "test engine" | `TRYON_ENGINES=echo DATA_DIR=/tmp/haat-test npm run dev -- --port 3100` | http://localhost:3100 |
| Show the "quota used up" screen | add `ECHO_FAIL=quota` to the line above | |

Port 3000 is often taken on this Mac; if so, use the dev line with 3100. Two `next dev`
processes can't run at the same time in this project.

### 3.4 Prove it works (live, in front of the professor)

```bash
npm test                 # 54 tests, ~1 s, no network
npm run typecheck        # TypeScript types
```

Don't run `npm run eval` in the meeting: it generates real photos and **spends the free
quota**, which is about 8 photos a day.

> `npm run lint` currently reports errors **only** from the new `ml/.venv/` folder (JavaScript
> bundled inside matplotlib and torch) and `docs/btp-report/build-deck.cjs`. The app code is
> clean. Don't run lint live until those folders are added to `globalIgnores` in
> `eslint.config.mjs`.

### 3.5 The ML kit

```bash
cd ml
.venv/bin/python -m pytest -q tests        # 12 tests, ~26 s, tiny model, no weights needed
```

Real-weights commands. **Don't run these live**: a single 30-step image takes about 22 min on
the M3. Show their saved output instead (§4).

```bash
# one try-on with every knob (incl. mu and skip-cfg, which the public Space hides)
.venv/bin/python scripts/sample.py --person P.jpg --garment G.jpg --category tops --out out.png --steps 30
# equivalence + parser + loss-convention checks on a saved app result
.venv/bin/python scripts/check_real_model.py --result ../data/results/<key> --category tops --out runs/real-check
# LoRA memorisation test at half resolution (fits 8 GB)
.venv/bin/python scripts/lora_microrun.py --train <dir> <dir> --val <dir> --categories tops tops tops --out runs/microrun --steps 100 --scale 0.5
# the full pipeline once data and a CUDA GPU exist
.venv/bin/python scripts/prepare_data.py --csv data/pairs.csv --out data/prepared [--triplets]
.venv/bin/python scripts/train_lora.py --data data/prepared --out runs/indian-v1 --steps 2000
.venv/bin/python scripts/evaluate.py --data data/prepared --lora runs/indian-v1/lora-best.safetensors --out runs/indian-v1/eval
```

### 3.6 The report

```bash
ml/.venv/bin/python docs/btp-report/build.py     # from haat-studio/: fills numbers, draws the charts, prints the PDF
```

It reads `ml/runs/real-check/report.json` and `ml/runs/microrun/report.json`. Keep those files.

---

## 4. What to open for what: the question → file table

Have VS Code open on the repo and these links ready. When a question comes, open the file and
point at the named function.

| If the professor asks… | Open | Point at |
|---|---|---|
| "Show me the architecture" | §1 of this file, or [professor-briefing.md §3](professor-briefing.md) | the diagram |
| "Where does a try-on actually happen?" | [src/lib/tryon/studio.ts](../src/lib/tryon/studio.ts) | `createStudio()`: the 4 numbered steps in its comment |
| "How do you call the model?" | [src/lib/tryon/fashn-space.ts](../src/lib/tryon/fashn-space.ts) | `client.submit("/try_on", {...})`: the exact parameters sent |
| "How do you avoid wasting GPU?" | [src/lib/tryon/store.ts](../src/lib/tryon/store.ts) | `cacheKey()` |
| "What preprocessing do you do?" | [src/lib/tryon/image.ts](../src/lib/tryon/image.ts) | `prepareImage()`, `exportFor()` |
| "How do you know how much quota is left?" | [src/lib/quota.ts](../src/lib/quota.ts) + `data/gpu-quota.json` | `quotaStatus()`, `photosFitting()` |
| "How do you handle AI errors / hallucinations?" | [src/lib/llm/index.ts](../src/lib/llm/index.ts), [src/lib/posts/caption.ts](../src/lib/posts/caption.ts) | `completeJSON()`, `pricesMentioned()` |
| "Is the profit calculated by AI?" | [src/lib/research/build.ts](../src/lib/research/build.ts) | `economics()`, `upcomingMoments()` |
| "How is the post image made?" | [src/lib/posts/render.ts](../src/lib/posts/render.ts) | `renderPost()` |
| "How is Hindi done?" | [src/lib/i18n/messages.ts](../src/lib/i18n/messages.ts) | the `en` / `hi` dictionaries |
| "How do you test it?" | [tests/studio.test.ts](../tests/studio.test.ts), then run `npm test` | cache, dedupe, lock, timeout tests |
| "How good are the results?" | [docs/eval-2026-10-26-baseline.md](eval-2026-10-26-baseline.md) | the 30-point rubric table |
| "Explain the model" | [docs/model-report.md §2](model-report.md) | tokens → blocks → rectified flow |
| "What did *you* do on the model?" | [ml/haat_ft/flow.py](../ml/haat_ft/flow.py), [ml/haat_ft/lora.py](../ml/haat_ft/lora.py) | `flow_loss()`, `LoRALinear` |
| "Prove your training objective is right" | [ml/runs/real-check/report.json](../ml/runs/real-check/report.json), [ml/tests/test_finetune.py](../ml/tests/test_finetune.py) | loss ~0.004 (ours) vs ~5 (reversed) |
| "Did fine-tuning work?" | [ml/runs/microrun/report.json](../ml/runs/microrun/report.json) | −27.1% on trained samples. Say it's a memorisation test |
| "How would you evaluate a fine-tune?" | [ml/haat_ft/metrics.py](../ml/haat_ft/metrics.py), [ml/scripts/evaluate.py](../ml/scripts/evaluate.py) | PSNR, SSIM, garment L1 |
| "How did it fit in 8 GB?" | [ml/haat_ft/infer.py](../ml/haat_ft/infer.py) | `low_memory_attention()` |
| "How does it scale / deploy?" | [docs/deploy.md](deploy.md), [Dockerfile](../Dockerfile), [professor-briefing.md §6](professor-briefing.md) | |
| "What did you learn / what went wrong?" | [CLAUDE.md](../CLAUDE.md) "Traps" | 19 real problems and their fixes |
| "UX / accessibility?" | [docs/ux/](ux/README.md), the `/design` page in the app | |

---

## 5. The mathematics, all in one place

### 5.1 In the app

**Cache key** (`store.ts`)
```
key = sha256( sha256(garment) | sha256(person) | category | photoType | quality | seed [| namespace] )[0:32]
```
The same bytes and the same settings always give the same key, so the saved image is reused.
"Another variation" changes only the seed, so it gets a new key.

**Image preparation** (`image.ts`): apply the EXIF rotation, then composite alpha onto white
(`out = α·pixel + (1−α)·255`), then scale so that the longest side is ≤ 1536 px (aspect kept), then
encode as JPEG at quality 92 with metadata dropped.

**Instagram export** (`exportFor`): the target is 1080×1350 (post), 1080×1080 (square) or
1080×1920 (story). The steps are:
1. Backdrop: resize the photo to *cover* the frame, apply a Gaussian blur (σ = 40), and multiply
   the brightness by 0.85.
2. Photo: resize to fit *inside* the frame. The scale is `s = min(W/w, H/h)`, so nothing is cropped.
3. Paste the photo at the centre of the backdrop and save as JPEG at quality 92.

This is the only colour operation in the app: the 0.85 dimming of the blurred backdrop.
**The garment itself is never colour-altered.**

**Free-GPU quota** (`quota.ts`)
```
window      = 24 h starting at the first run after the previous window ended
used        = Σ run seconds in the window
left        = 300 s − used               (300 s = free daily ZeroGPU time)
perPhoto    = median(last 10 runs)  if ≥ 3 runs, else 27 s
photosByTime = left ≥ 60 ? ⌊(left − 60) / perPhoto⌋ + 1 : 0    (each call reserves 60 s up front)
photosByRuns = runsLimit − runsUsed       (runsLimit learned from the refusal; 8 on this account)
photosLeft  = min(photosByTime, photosByRuns)
```
Example: with 300 s left and 26 s per photo, `⌊240/26⌋ + 1 = 10` photos fit by time, but the
run limit of 8 is lower, so the meter shows 8.

**Post maker** (`posts/spec.ts`): `discount % = round((MRP − price) / MRP × 100)`. For ₹799 on
an MRP of ₹999 that gives 20%. Prices are formatted in the Indian style (₹1,29,999).

**Market research economics** (`research/build.ts`)
```
profit per piece = price − cost            (at the seller's min and max price)
margin %         = round((price − cost) / price × 100)
warning "loss"   if profit at min price ≤ 0
warning "thin"   if margin at min price < 30%
days away        = (festival date − today) in whole days, shown if 0 ≤ days ≤ 75
```

**Caption honesty check** (`caption.ts`): extract every amount written as ₹, Rs, INR or रु
(Devanagari digits are converted first). The caption is accepted only if every amount equals the
seller's price or MRP.

### 5.2 In the model (FASHN VTON 1.5, as worked out in [model-report.md](model-report.md))

**Tokens.** 864 × 576 image, 12 × 12 patches → 72 × 48 = **3,456 tokens** per image; each is
12·12·3 = 432 raw pixel values (no VAE). Person + garment = **6,912 tokens** in joint attention.

**Rectified flow (generation).** Start at noise `x₀ ~ N(0, I)` and take 30 Euler steps:
```
x ← x + Δt · v(x, t)             t goes 0 → 1, steps bunched near t = 0 by the shift mu = 1.5
```

**Classifier-free guidance.** At each step the model runs twice, once with the conditions and once with them zeroed:
```
v = v_uncond + w · (v_cond − v_uncond),   w = 1.5   (last step unguided)
```
30 steps × 2 passes = **60 forward passes** per photo.

**Training objective (our reconstruction, `flow.py`)**
```
t      = sigmoid(z − 1.5),  z ~ N(0,1)           (logit-normal, shifted like the sampler)
ε      ~ N(0, I)
x_t    = (1 − t)·ε + t·x                          (point on the straight noise→photo line)
target = x − ε                                    (the velocity; d x_t / dt)
w      = 0 on padding, 1 on body/background, 2 on garment pixels
loss   = Σ w·(v_θ(x_t, t, cond) − target)² / (Σ w · channels)
```
With probability 0.1 all conditions are dropped together, so guidance still works after
fine-tuning.

**Why we believe the convention is right:** on the real pretrained weights, the loss under our
convention is 0.0037–0.0124, against 4.31–6.43 with time reversed. That is about 1,000× lower,
which means the model was trained this way (`ml/runs/real-check/report.json`).

**LoRA (`lora.py`).** For a frozen layer `W` (out × in):
```
y = W·x + (α / r) · B·A·x,     A: r × in,  B: out × r,  r = 16, α = 16  → scale 1
B starts at 0  ⇒  the adapted model is exactly the base model at step 0
```
96 layers wrapped, which adds 9,830,400 trainable parameters to the 971,813,808 frozen ones
(**1.01%**). The adapter is stored in float32 because small updates vanish in bf16.

**Training schedule (`train.py`):** AdamW (lr 1e-4, weight decay 0.01), linear warm-up over 100
steps, then cosine decay to 10% of lr, an effective batch of 4 (1 × 4 accumulation), and gradient
clipping at 1.0.

**Memory arithmetic (`infer.py`).** One full attention matrix takes
10 heads × 6912² × 2 bytes × 2 (guidance batch) ≈ **1.9 GB**. Computing it two heads at a time
gives the same result with a smaller peak, which is how it ran on the 8 GB Mac.

**Evaluation metrics (`metrics.py`)**
```
PSNR = 10 · log₁₀(1 / MSE)          images in [0, 1]; higher is better (identical → very large)
SSIM = structural similarity (Wang et al. 2004), 1 = identical
L1_garment = mean |a − b| over garment pixels only
```

---

## 6. Measured numbers to quote (and where each comes from)

| Number | Value | Source |
|---|---|---|
| App tests | 54 pass, no network | `npm test` |
| ML tests | 12 pass | `ml/tests/test_finetune.py` |
| Quality, tops | 29–30 / 30 | eval-2026-10-26-baseline.md |
| Quality, skirt on a model in a dress | 11 / 30 → fixed by ✓/✗ model suitability | same |
| Time per photo | ~13 s warm, ~30 s cold; GPU time ~10–28 s | baseline; `data/gpu-quota.json` |
| Free quota | 5 GPU-min/day + hidden run limit of 8 | quota ledger refusal message |
| Our code vs FASHN's pipeline | identical, 0.00 difference | `ml/runs/real-check/report.json` |
| Parser removed | identical, so the parser is unused in our mode | same |
| Local vs Space, seed 42 | PSNR 22.4 dB (same garment and pose, different noise per device) | same |
| One image on the M3 | 1,344 s ≈ 22 min, 4.1 GB | same |
| LoRA micro-run (100 steps, 432×288) | trained loss 0.00510 → 0.00372 (−27.1%); unseen +1.1%; adapter 37.5 MB; ~7 s/step | `ml/runs/microrun/report.json` |

---

## 7. Ready answers for likely questions

**"Did you train the model?"**
No. The network and its weights are FASHN's. I worked out how it is trained from the inference
code, proved that reconstruction on the real weights, and built a LoRA fine-tuning kit for it.
That kit has only been run as a 100-step memorisation test on the laptop. A real fine-tune needs
300–500 Indian garment pairs and a CUDA GPU with at least 16 GB.

**"So what is your contribution?"**
Three things. First, the system around the model: cache, quota protection, error reporting,
verified AI text, and the post and research tools in two languages. Second, the analysis of the
model and the reconstructed training method with the LoRA kit. Third, the finding that the
research-only human parser is unused in our mode.

**"Why FASHN and not IDM-VTON / CatVTON / an image editor?"**
It takes flat-lay photos, which is what sellers have. It needs no mask. Its free Space works. Its
core licence is Apache-2.0. It is small enough to self-host. The full comparison is in
professor-briefing.md §10.

**"Why not let the AI write the price on the image?"**
Image models misspell text. We draw the text on a canvas ourselves, so it is exact every time.

**"How do you stop the AI lying?"**
Every AI reply has to match a zod schema. Captions are rejected if they mention a price the seller
didn't give. Profit and dates are computed in code. If every provider fails, a labelled template
takes over.

**"What happens when the free GPU runs out?"**
The app counts its own GPU use, learns the hidden run limit from the refusal message, shows
"N photos left" with the refill time, and serves earlier results from the cache.

**"What are the limits?"**
- It has been tested on Western sample garments; sarees may be beyond the model's categories.
- The output is about 576 px wide and enlarged for Instagram.
- Research uses the AI's general knowledge, not live data.
- One component (the parser) is licensed for research only.
- There are no user accounts yet.

**"What's next?"**
Our own Space with the parser skipped and a LoRA adapter, data from 5–10 local sellers, the first
fine-tune on kurtis and salwars, a saree category, and super-resolution.

**"What do you need from me?"**
GPU access, introductions to sellers, ethics approval for a small user study, and a decision on
scope (see professor-briefing.md §8).

---

## 8. Before the meeting: checklist

- [ ] `npm run engine:check` and `npm run llm:check` pass (internet on).
- [ ] App started with `npm run build && npm run start:standalone`; http://localhost:3000 opens.
- [ ] Check the header quota chip. **Don't generate photos beforehand.**
- [ ] Safe demo: the **navy crop top** sample on the women's standing model is already cached,
      so it is instant and costs no GPU.
- [ ] One research report open in a tab (4 saved in `data/research/`).
- [ ] VS Code open on the repo with the §4 files ready; a terminal ready for `npm test`.
- [ ] `docs/btp-report/report.html` (or the PDF) open for the written report.
- [ ] Fallback if the internet fails: the featured examples on the home page, the cached results,
      and the echo engine for the UI flow (it is labelled "test engine"; say so).
