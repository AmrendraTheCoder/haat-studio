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
| 1 | Prove free generation from code | API reached, queued and quota-gated without a token; first tokened run pending |
| 2 | Demo app: upload, presets, progress, compare, download, gallery | Built; unit-tested |
| 3 | Quality: scored eval set, garment-photo checks, Indian model presets, kurta/saree categories | Next |
| 4 | Social posts: caption, shop name, price, layout rendered as text (not by an image model) | |
| 5 | Business research questionnaire with sourced findings | |
