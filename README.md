# Haat Studio

**Garment photo in, on-model photo out.** A seller uploads a photo of a piece of
clothing; the app returns that garment worn by a model.

This is part 1 of Haat, an AI assistant for Indian Instagram sellers. Later
parts will add a questionnaire-driven market research step and ready-to-post
social media creatives. It follows the architecture of
[stiche-v2](https://github.com/AmrendraTheCoder/stiche-v2) without sharing code
with it.

## How it works

```
browser ──multipart──▶ POST /api/tryon
                          │
                          ├─ prepareImage   upright · transparency → white · ≤1536px · JPEG
                          │
                          └─ studio.start   ← the only place a try-on happens
                               1. result cache        same inputs → saved image, no GPU
                               2. in-flight sharing   double-click joins the running job
                               3. one job at a time   the free GPU quota is shared
                               4. engine chain        try each engine, keep every error
                                      │
                                      ▼
                         FASHN VTON 1.5 on Hugging Face ZeroGPU (free, needs HF token)
                                      │
browser ◀──NDJSON progress── queued → running → done  (saved to data/results/<key>/)
```

- **Engine:** [FASHN VTON 1.5](https://huggingface.co/fashn-ai/fashn-vton-1.5)
  (Apache-2.0), called through its [official Space](https://huggingface.co/spaces/fashn-ai/fashn-vton-1.5)
  with the Gradio client. It takes a person photo and a garment photo; the app
  supplies the person from a set of presets, so the seller only uploads the product.
- **Progress** streams as one JSON event per line: queue position, then GPU start, then the result.
- **Results** are content-addressed: the key is a hash of both images and the settings.
  Asking for the same thing again costs no GPU time; *Another variation* uses a new seed.
- A job outlives the request. Close the tab and the result still lands in the gallery.

## The app

| Page | What it does |
|---|---|
| `/` | Landing page: before/after hero, how it works, featured examples, what it costs, roadmap |
| `/studio` | Three guided steps — **Product → Model → Photo** |
| `/studio?r=<key>` | Opens one photo. Works while it is still being made: reload or share the link and it reconnects |

**Studio flow.** Upload a product photo (or pick a sample), say what kind of garment
it is (required — a wrong category wastes a generation) and how it was photographed.
Pick a preset model or upload your own. Create. A live panel shows each stage as the
server reports it: upload, preparation (what was changed — rotated, background added,
resized, camera/location data removed), the cache check, the GPU queue, generation,
saving. The finished photo has a before/after slider, full-screen view, and downloads
for an Instagram post (4:5), square (1:1) and story (9:16) — fitted on a blurred
backdrop, never cropped — plus the original PNG.

**Guards.** Each button stays disabled with the reason shown until its step is
complete. Wrong file types, HEIC, oversized and tiny photos are refused in the browser
before uploading, and again on the server. Steps lock while a photo is being made;
the job survives closing the tab. Failures say what to do next: quota spent (with the
refill time), bad photo (back to the right step), lost connection (reconnect), dead link.

**Demo mode.** Without `HF_TOKEN` everything works except creating new photos, and
the app says so up front. The landing page never shows invented results: until real
ones are featured, each slot is a labelled placeholder.

**Featured examples.** On a finished photo, choose *Feature on home page* (only shown
when `CURATION` is on — the default in development, off in production builds, because
there is no login yet). Featured photos appear on the landing page and open instantly
in a demo, with no GPU.

## Setup

Requires Node 22+.

```bash
npm install
npm run setup          # downloads the preset model photos and sample garments
cp .env.example .env   # then add HF_TOKEN
npm run engine:check   # token valid? Space up? API unchanged? Uses no GPU quota
npm run dev            # http://localhost:3000  (add -- --port 3100 if 3000 is busy)
```

**`HF_TOKEN` is required.** Create a free token with *read* access at
<https://huggingface.co/settings/tokens>. Without one, the Space queues the job and
then refuses it: *"You have exceeded your ZeroGPU runs limit. Authenticate with a
Hugging Face token for more quota"* (observed 2026-10-02).

### What "free" means here

Hugging Face gives a free account a few minutes of ZeroGPU time per day
([current limits](https://huggingface.co/docs/hub/spaces-zerogpu)). The Space
estimated about 24 seconds for one try-on at 30 steps, so plan on a handful of
generations a day. `npm run eval` records the real timings. When the quota runs out the app says so, with the
refill time when the Space reports one; the gallery keeps every earlier result
for demos. A Hugging Face PRO account raises the daily allowance.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Unit tests: engine chain, cache, dedupe, timeouts, image prep, error parsing. No network |
| `npm run typecheck` / `npm run lint` | Types and lint |
| `npm run setup` | Downloads preset models and sample garments into `public/` (not committed) |
| `npm run engine:check` | Verifies the token, the Space's status, and that its API still matches what we send |
| `npm run eval` | Runs every sample garment through the real engine and writes a report to score |

### Testing the UI without a token

`TRYON_ENGINES=echo` swaps in a test engine that walks through the same queue and
progress events and returns the model photo **unchanged** — no try-on. Its results
are labelled "test engine" everywhere and the server refuses to feature them. Keep
them out of your real results with a throwaway `DATA_DIR`:

```bash
TRYON_ENGINES=echo DATA_DIR=/tmp/haat-test npm run dev
TRYON_ENGINES=echo ECHO_FAIL=quota DATA_DIR=/tmp/haat-test npm run dev   # the quota-spent screens
```

## Measuring quality

`npm run eval` writes `eval/reports/<time>-<quality>/report.md`: product photo,
model, result, timings, and empty columns for colour, print, neckline/waist,
sleeves/length, shape and artifacts. Score them 1–5. A result that looks good but
changes the product is a failure: sellers post it as their product.

The eval uses the same cache as the app, so re-running it is free for unchanged
pairs. Change a setting or the preprocessing and you get fresh, comparable output.

## What is improved over the stock pipeline

| Change | Why |
|---|---|
| EXIF orientation applied | Phone photos stored sideways reached the model sideways |
| Transparency flattened onto white | FASHN's RGB conversion turns transparent product cut-outs black |
| Uploads bounded to 1536 px | The model works at 576×864; larger photos only add upload time |
| Camera metadata stripped | Phone EXIF (often GPS location) never reaches the GPU host |
| Clean JPEGs pass through untouched | Re-using a saved photo hits the cache instead of re-encoding into new bytes |
| Content-addressed result cache | Repeats cost no GPU quota |
| In-flight sharing + one job at a time | No double submissions; no two jobs racing for one quota |
| Timeout that cancels the Space job | A stuck request stops spending quota |
| ZeroGPU errors classified | "Quota used up, refills in 14 min" instead of a stack trace |
| `engine:check` contract test | Detects an upstream API change before a demo does |

## Licensing

- FASHN VTON 1.5 code and weights: Apache-2.0.
- Its default pipeline also loads the FASHN Human Parser, whose model card points to
  NVIDIA's SegFormer licence, which limits use to non-commercial research and
  evaluation. This project is a college research demo. A commercial launch would
  need that dependency replaced or licensed.
- Preset model photos and sample garments come from FASHN's Space examples. `npm run
  setup` downloads them; this repo does not redistribute them.

## Roadmap

| Stage | Scope | Status |
|---|---|---|
| 1 | Proper UI + demo mode: landing page, guided studio, before/after, Instagram sizes, live pipeline, featured examples | Done — every screen exercised with the echo test engine |
| 2 | First real results: connect the free token, generate the sample set, score a baseline | Waiting on `HF_TOKEN` |
| 3 | Quality: photo checks before generating, background cleanup, upscaling, Indian model presets, kurta tests | Next |
| 4 | Social posts: caption, shop name, price, layout rendered as text (not by an image model) | |
| 5 | Business research questionnaire with sourced findings | |
