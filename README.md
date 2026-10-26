# Haat Studio

**An AI assistant for Indian Instagram sellers: photo, post, plan.**

1. **Try-on studio** — a seller photographs a garment laid flat; the app returns
   it worn by a model, sized for Instagram.
2. **Post maker** — the shop name, ₹ price, MRP and offer are set on that photo as
   real text, and a caption with hashtags is written in English, Hinglish or Hindi.
3. **Market research** — ten answers about the shop give back who buys, what's
   working, what to charge, a week of posts, the selling days coming up and the
   exact profit per piece.

The whole app works in **English or हिन्दी** — one tap in the header switches it,
and research reports and captions come back in Hindi too.

Everything runs on free services. It follows the architecture of
[stiche-v2](https://github.com/AmrendraTheCoder/stiche-v2) without sharing code with it.
For a plain-language overview to present, see [docs/project-summary.md](docs/project-summary.md);
for the UX — users, journeys, screen-by-screen rationale, design system, testing and
accessibility — see [docs/ux/](docs/ux/README.md) (and `/design` in the app);
to put it online, see [docs/deploy.md](docs/deploy.md).

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
| `/studio/post?r=<key>` | Post maker for that photo: Post 4:5 / Square / Story, three templates, three palettes, caption |
| `/research` | The ten-question shop questionnaire |
| `/research/<id>` | The saved report — printable, and used by the post maker for captions |
| `/design` | How it's designed: users, journey, principles, what testing changed, accessibility, the look |

**Post maker (Phase 4).** Text is drawn by our own layout code on a canvas, never
by an image model, so the shop name and price are spelled exactly and look the same
every time. No template puts text across the garment: it goes in a panel, a frame or
a corner badge. The discount is calculated from the MRP. Shop details are remembered
in the browser. Captions come from a free text AI when a key is set, and are checked:
an AI caption that quotes any price the seller didn't give is rejected. Without a key,
the caption is a template built only from the seller's own words, labelled as such.

**Market research (Phase 5).** The AI writes buyers, trends, pricing, content ideas,
a seven-day plan and hashtags, validated against a strict format and labelled as
general knowledge (it has no live web access). The profit per piece, the margin
warnings and the dated selling days (Diwali, Black Friday, Republic Day sales…) are
calculated in code, not by the AI, and marked *calculated*. Without a key, the seller
gets a clearly labelled starter plan instead.

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
cp .env.example .env   # then add HF_TOKEN (required) and GROQ_API_KEY (recommended)
npm run engine:check   # token valid? Space up? API unchanged? Uses no GPU quota
npm run llm:check      # which free text-AI providers answer
npm run dev            # http://localhost:3000  (add -- --port 3100 if 3000 is busy)
```

**`GROQ_API_KEY` is recommended** (free at <https://console.groq.com/keys>, no card).
It makes captions and research AI-written; `GEMINI_API_KEY` from Google AI Studio
works too. Without either, both features still work as labelled templates.

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
| `npm test` | 41 unit tests: engine chain, cache, dedupe, timeouts, image prep, research maths, caption checks, passcode. No network |
| `npm run typecheck` / `npm run lint` | Types and lint |
| `npm run setup` | Downloads preset models and sample garments into `public/` (not committed) |
| `npm run engine:check` | Verifies the token, the Space's status, and that its API still matches what we send |
| `npm run eval` | Runs every sample garment through the real engine and writes a report to score |
| `npm run llm:check` | Says which text-AI providers are configured and still answering |
| `npm run build` then `npm run start:standalone` | Production build and server — what the Docker image runs |

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
| Uploads bounded to 1536 px | The model outputs ~576 px wide; larger photos only add upload time |
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

## Phases

| Phase | Scope | Status |
|---|---|---|
| 1 | Proper UI + demo mode: landing page, guided studio, before/after, Instagram sizes, live pipeline, featured examples | Done |
| 2 | First real results and a scored baseline | Done — [baseline](docs/eval-2026-10-26-baseline.md): tops 29–30/30, ~13 s warm / ~30 s cold |
| 3 | Quality: model suitability per garment type ✓; next: photo checks before generating, sharper output, Indian models, real kurta/saree tests | In progress — needs real garments from sellers |
| 4 | Post maker: shop name, price, MRP, offer as real text; three templates × three sizes; checked AI captions | Done |
| 5 | Market research: questionnaire → buyers, trends, pricing, week plan, hashtags; calculated profit and selling days | Done |
| 6 | Deployment: production build, Docker image, passcode for public links, [deploy guide](docs/deploy.md) | Done — accounts and cloud storage are the next step |
