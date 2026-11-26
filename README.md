# Haat Studio

**An AI assistant for Indian Instagram sellers: photo, post, plan.**

A small seller photographs a garment laid flat. Haat Studio returns it worn by a model,
puts the shop name and ₹ price on it as a ready-to-post image, writes the caption, and
plans the week's posts. The whole app works in **English or हिन्दी**, and everything
runs on free services.

| | Feature | What the seller gets |
|---|---|---|
| 1 | **Try-on studio** | Garment photo in, on-model photo out, sized for an Instagram post, square or story |
| 2 | **Post maker** | Shop name, price, MRP and offer drawn on the photo as real text, plus a caption and hashtags in English, Hinglish or Hindi |
| 3 | **Market research** | Ten questions about the shop give back who buys, trends, what to charge, a 7-day post plan, upcoming selling days and the exact profit per piece |

---

## Contents

- [Quick start](#quick-start)
- [Keys and the `.env` file](#keys-and-the-env-file)
- [Commands](#commands)
- [How it works](#how-it-works)
- [Pages](#pages)
- [Project structure](#project-structure)
- [Testing without a GPU token](#testing-without-a-gpu-token)
- [Measuring quality](#measuring-quality)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Licensing](#licensing)
- [Project status](#project-status)

---

## Quick start

**You need:** Node.js 22 or newer ([nodejs.org](https://nodejs.org)) and git.

```bash
git clone https://github.com/AmrendraTheCoder/haat-studio.git
cd haat-studio
./run.sh
```

The first run creates `.env` and tells you which keys are missing. Paste them in
(see [Keys](#keys-and-the-env-file)) and run `./run.sh` again. The app opens at
**<http://localhost:3100>**. Stop it with `Ctrl+C`.

### What `./run.sh` does

| Step | Command it runs | What it does |
|---|---|---|
| 1 | `node -v`, `npm -v` | Checks Node 22 or newer is installed; stops with a message if not |
| 2 | `npm ci` | Installs the exact package versions in `package-lock.json`. Skipped when already up to date |
| 3 | `cp .env.example .env` | Creates `.env` only if it doesn't exist, then says which keys are set (values are never printed) |
| 4 | `npm run setup` | Downloads the preset model photos and sample garments into `public/`. Files already there are kept |
| 5 | `npm test` · `npm run typecheck` · `npm run lint` | 54 unit tests (no internet), TypeScript types, code style. Stops at the first failure |
| 6 | `npm run dev -- --port 3100` | Starts the app |

Every step can safely run again. Options:

```bash
./run.sh --no-checks     # skip step 5 for a faster start
./run.sh --prod          # production build + standalone server instead of dev
PORT=3300 ./run.sh       # use another port (3000 is often taken)
./run.sh --help
```

<details>
<summary>Doing it by hand instead</summary>

```bash
npm ci                       # install
cp .env.example .env         # then fill in your keys
npm run setup                # preset photos and sample garments
npm test                     # unit tests
npm run engine:check         # token valid? GPU Space up? Uses no GPU quota
npm run llm:check            # which text-AI providers answer
npm run dev -- --port 3100   # start
```
</details>

---

## Keys and the `.env` file

All config lives in one file, `.env`, copied from [`.env.example`](.env.example). It is
gitignored and never committed. Every key is free and needs no card.

| Key | Needed? | Where to get it | What it unlocks |
|---|---|---|---|
| `HF_TOKEN` | **Yes**, for try-ons | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens), *read* access | Making photos on Hugging Face's free GPU. Without it, the GPU Space refuses the job |
| `GEMINI_API_KEY` | One text-AI key recommended | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | AI-written captions and research |
| `GROQ_API_KEY` | (either works) | [console.groq.com/keys](https://console.groq.com/keys) | Same, and it's tried first |
| `STUDIO_PASSCODE` | **Yes on a public link** | Choose one (4+ characters) | Creating anything needs it, so strangers can't spend your free quota |

Other settings, all optional:

| Key | Default | What it does |
|---|---|---|
| `LLM_CHAIN` | `groq/llama-3.3-70b-versatile,gemini/gemini-2.5-flash` | Text-AI providers, tried in order. Ones without a key are skipped |
| `TRYON_ENGINES` | `fashn-space` | Try-on engines, tried in order. `echo` is a test engine |
| `TRYON_TIMEOUT_MS` | `240000` | Give up on one photo after this long, queue included |
| `DATA_DIR` | `data` | Where results, research reports and the quota ledger are saved |
| `ZEROGPU_DAILY_SECONDS` | `300` | Daily GPU seconds shown on the quota meter (PRO accounts: `2400`) |
| `ZEROGPU_DAILY_RUNS` | learned | Daily photo limit, if you know it. Otherwise learned from the first refusal |
| `CURATION` | on in dev, off in prod | Shows *Feature on home page* on finished photos |

**Without keys** the app still runs. Without `HF_TOKEN`, everything works except making
new photos, and the app says so up front. Without a text-AI key, captions and research
come from templates built only from the seller's own answers, clearly labelled as such.

### What "free" means

A free Hugging Face account gets **5 minutes of GPU time a day** plus an unpublished
daily limit on runs. On 2026-10-26 this account was refused after 8 photos. Each photo
uses about 25 s but reserves 60 s up front. The header's quota meter shows time used,
photos left and the refill time; it learns the run limit from Hugging Face's refusal
message. Earlier results stay in the gallery for demos. A PRO account raises the allowance.

---

## Commands

| Command | Network? | What it does |
|---|---|---|
| `./run.sh` | Yes | Install → `.env` → photos → checks → start ([details](#what-runsh-does)) |
| `npm run dev` | – | Development server (port 3000; add `-- --port 3100` if busy) |
| `npm test` | No | 54 unit tests: engine chain, cache, dedupe, timeouts, image prep, quota maths, research maths, caption checks, passcode, translations |
| `npm run typecheck` | No | TypeScript, including the check that every English string has a Hindi one |
| `npm run lint` | No | ESLint |
| `npm run setup` | Yes | Downloads preset models and sample garments into `public/` (not committed) |
| `npm run engine:check` | Yes | Checks the token, the GPU Space's status, and that its API still matches. Uses no GPU quota |
| `npm run llm:check` | Yes | Says which text-AI providers are configured and still answering |
| `npm run eval` | Yes, **spends GPU quota** | Runs every sample garment through the real engine and writes a report to score |
| `npm run build` then `npm run start:standalone` | – | Production build and server (what Docker runs) |

---

## How it works

### Try-on: one photo

```
browser ──multipart──▶ POST /api/tryon        (passcode checked first)
                          │
                          ├─ prepareImage   upright · transparency → white · ≤1536 px · metadata stripped
                          │
                          └─ studio.start   ← the only place a try-on happens
                               1. result cache        same inputs → saved image, no GPU
                               2. in-flight sharing   a double-click joins the running job
                               3. one job at a time   the free GPU quota is shared
                               4. engine chain        try each engine, keep every error
                                      │
                                      ▼
                         FASHN VTON 1.5 on Hugging Face ZeroGPU (free, needs HF_TOKEN)
                                      │                     └─▶ GPU time recorded in the quota ledger
browser ◀──NDJSON progress── queued → running → done  (saved to data/results/<key>/)
```

- **Engine:** [FASHN VTON 1.5](https://huggingface.co/fashn-ai/fashn-vton-1.5) (Apache-2.0),
  called through its [official Space](https://huggingface.co/spaces/fashn-ai/fashn-vton-1.5)
  with the Gradio client. It needs a person photo and a garment photo. The app supplies
  the person from presets, so the seller only uploads the product.
- **Progress** streams as one JSON event per line: queue position, GPU start, result.
  The live panel is computed from those events, never from timers.
- **Results are content-addressed.** The key is a hash of both images and the settings,
  so asking again costs no GPU time. *Another variation* uses a new seed.
- **A job outlives the request.** Close the tab and the result still lands in the gallery;
  `/studio?r=<key>` reconnects to it.

### Text AI: captions and research

```
POST /api/caption  ─┐                           ┌─▶ Groq   (Llama 3.3 70B)   1st
                    ├─▶ completeJSON(schema) ───┤
POST /api/research ─┘   the only text-AI call   └─▶ Gemini (2.5 Flash)       2nd
                         · reply parsed as JSON, validated with zod
                         · wrong shape = failure → next provider
                         · nobody answers → labelled template
```

- **Captions** that quote any rupee amount the seller didn't give are rejected.
  Hashtags are always in Roman letters (`#cottonkurti`), even for Hindi captions.
- **Research:** the AI writes buyers, trends, pricing, content ideas, a 7-day plan and
  hashtags. **Profit per piece, margin warnings and festival dates are calculated in
  code**, not by the AI, and marked *calculated*.
- **Post text** (shop name, price, offer) is drawn on a canvas by our own layout code,
  never by an image model, so it's spelled right every time. No text goes across the garment.

### Guards

- **Passcode:** every route that creates something calls `requirePasscode` first.
  Reads stay open.
- **Uploads:** wrong file types, HEIC, oversized and tiny photos are refused in the
  browser and again on the server.
- **Honest UI:** every disabled button says why. Failures say what to do next (quota
  spent with the refill time, bad photo, lost connection). The landing page never shows
  invented results, and test-engine output is labelled and can't be featured.

---

## Pages

| Page | What it does |
|---|---|
| `/` | Landing: before/after hero, how it works, featured examples, cost, roadmap |
| `/studio` | Three guided steps: **Product → Model → Photo** |
| `/studio?r=<key>` | One photo; reconnects if it's still being made |
| `/studio/post?r=<key>` | Post maker: Post 4:5 / Square / Story, three templates, three palettes, caption |
| `/research` | The ten-question shop questionnaire |
| `/research/<id>` | The saved report, printable, and used by the post maker for captions |
| `/design` | How it's designed: users, journeys, principles, testing, accessibility |

| API | Method | What it does |
|---|---|---|
| `/api/tryon` | POST | Start a try-on, streams progress (passcode) |
| `/api/tryon/[key]` | GET | Re-attach to a running job, or get its saved result |
| `/api/results/[key]/[file]` | GET | `result.png`, inputs, and `post` / `square` / `story.jpg` exports |
| `/api/caption` | POST | Write a caption (passcode) |
| `/api/research` | POST | Create a research report (passcode) |
| `/api/quota` | GET | Free GPU quota left today |
| `/api/featured` | GET / POST | List or set featured photos (POST needs `CURATION=on`) |

---

## Project structure

```
src/
  app/                  pages and API routes (Next.js 16 App Router)
  components/           site, studio, posts, research, shared UI
  lib/
    tryon/              studio.ts (cache → sharing → lock → engines), fashn-space.ts,
                        image.ts, store.ts, stream.ts, quota-ledger.ts, echo.ts
    llm/                completeJSON: provider chain + JSON validation
    posts/              post spec, canvas renderer, captions
    research/           questionnaire schema, report builder (maths + dates in code)
    i18n/               English + Hindi dictionaries
    quota.ts            free GPU quota maths
    guard.ts            passcode check
    env.ts              .env schema
scripts/                setup, engine-check, llm-check, eval
tests/                  vitest unit tests, no network
ml/                     Python: run, tune and LoRA fine-tune the try-on model (see ml/README.md)
docs/                   project summary, UX docs, deploy guide, model report, eval baseline
run.sh                  install + verify + start
Dockerfile              production image for Hugging Face Spaces
```

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · zod · sharp ·
@gradio/client · vitest.

Not committed (gitignored): `.env`, `data/`, `public/presets/`, `public/samples/`,
`eval/reports/`. `npm run setup` re-creates the photo folders.

---

## Testing without a GPU token

`TRYON_ENGINES=echo` swaps in a test engine that goes through the same queue and
progress events and returns the model photo **unchanged** (no try-on). Its results are
labelled "test engine" everywhere and can't be featured. Use a throwaway `DATA_DIR` so
they stay out of your real results:

```bash
TRYON_ENGINES=echo DATA_DIR=/tmp/haat-test npm run dev
TRYON_ENGINES=echo ECHO_FAIL=quota DATA_DIR=/tmp/haat-test npm run dev   # quota-spent screens
TRYON_ENGINES=echo ECHO_FAIL=error DATA_DIR=/tmp/haat-test npm run dev   # error screens
```

---

## Measuring quality

`npm run eval` writes `eval/reports/<time>-<quality>/report.md`: product photo, model,
result, timings, and empty columns for colour, print, neckline/waist, sleeves/length,
shape and artifacts. Score each 1–5. A result that looks good but changes the product
counts as a failure, because sellers post it as their product.

The eval uses the app's cache, so re-running it is free for unchanged pairs. The first
scored baseline is in [docs/eval-2026-10-26-baseline.md](docs/eval-2026-10-26-baseline.md):
tops scored 29–30/30, ~13 s warm and ~30 s cold.

### What's improved over the stock pipeline

| Change | Why |
|---|---|
| EXIF orientation applied | Phone photos stored sideways reached the model sideways |
| Transparency flattened onto white | FASHN's RGB conversion turns transparent cut-outs black |
| Uploads capped at 1536 px | The model outputs ~576 px wide; bigger photos only add upload time |
| Camera metadata stripped | Phone EXIF (often GPS location) never reaches the GPU host |
| Clean JPEGs passed through untouched | Re-used photos hit the cache instead of re-encoding into new bytes |
| Content-addressed result cache | Repeats cost no GPU quota |
| In-flight sharing + one job at a time | No double submissions; no two jobs racing for one quota |
| Timeout that cancels the Space job | A stuck request stops spending quota |
| ZeroGPU errors classified | "Quota used up, refills in 14 min" instead of a stack trace |
| `engine:check` contract test | Catches an upstream API change before a demo does |

---

## Deployment

The try-on runs on Hugging Face's GPUs, so the server only needs a small CPU.
[docs/deploy.md](docs/deploy.md) covers three options, all free:

1. **Your laptop**: `./run.sh` (most reliable for a demo).
2. **Hugging Face Space (Docker)**: the [`Dockerfile`](Dockerfile) serves on port 7860
   and saves to `/data`. Add the keys as Space *Secrets*, including `STUDIO_PASSCODE`.
3. **Any Docker host**: Render, Railway, a college server.

Locally, `./run.sh --prod` builds and starts the same standalone server that Docker runs.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `port 3100 is already in use` | Stop the other server, or `PORT=3300 ./run.sh` |
| `Node … is too old` | Install Node 22 or newer |
| "exceeded your ZeroGPU runs limit" | `HF_TOKEN` is missing or wrong in `.env`; or today's free quota is spent (the meter shows when it refills) |
| Captions say "Template" | No working text-AI key. Add `GEMINI_API_KEY` or `GROQ_API_KEY`, then `npm run llm:check` |
| Photos failed to download in step 4 | No internet at that moment; the app still runs. Run `./run.sh` again later |
| Changed `.env` but nothing changed | Keys are re-read on each request; for `TRYON_ENGINES` or the studio's own options, restart the server |

---

## Licensing

- FASHN VTON 1.5 code and weights: Apache-2.0.
- Its default pipeline also loads the FASHN Human Parser, whose model card points to
  NVIDIA's SegFormer licence (non-commercial research and evaluation only). This project
  is a college research demo. A commercial launch would need that dependency replaced
  or licensed.
- Preset model photos and sample garments come from FASHN's Space examples. `npm run
  setup` downloads them; this repo doesn't redistribute them.

---

## Project status

| Phase | Scope | Status |
|---|---|---|
| 1 | UI + demo mode: landing, guided studio, before/after, Instagram sizes, live pipeline, featured examples | Done |
| 2 | First real results and a scored baseline | Done ([baseline](docs/eval-2026-10-26-baseline.md)) |
| 3 | Quality: model suitability per garment type done; next are photo checks, sharper output, Indian models, kurta/saree tests | In progress (needs real garments from sellers) |
| 4 | Post maker: real text on the photo, three templates × three sizes, checked AI captions | Done |
| 5 | Market research: questionnaire → report with calculated profit and selling days | Done |
| 6 | Deployment: production build, Docker image, passcode, [deploy guide](docs/deploy.md) | Done; accounts and cloud storage are next |
| – | Hindi: header toggle across every screen, the post canvas, captions and reports | Done; wording not yet reviewed by a native speaker |

More reading: [docs/project-summary.md](docs/project-summary.md) (plain-language overview) ·
[docs/ux/](docs/ux/README.md) (users, journeys, design system, accessibility) ·
[ml/README.md](ml/README.md) (model fine-tuning) · [docs/model-report.md](docs/model-report.md).
