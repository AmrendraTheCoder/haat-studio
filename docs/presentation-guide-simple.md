# Presentation guide — the easy version

This is the same guide as `presentation-guide.md`, told in simple words.
Nothing new is added. Only the words are easier.

---

## 0. First: how to read the "references" (file links)

The old guide has links like this:

```
[studio.ts](../src/lib/tryon/studio.ts)
```

That looks scary, but it only means: **"the file is over there, go open it."**

- `..` means **"go up one folder"**. The guide lives in `docs/`, so `..` takes you
  back to the main project folder, `haat-studio/`.
- So `../src/lib/tryon/studio.ts` really means:
  **haat-studio → src → lib → tryon → studio.ts**

In this easy guide, every file is written **from the main folder**, like
`src/lib/tryon/studio.ts`. To open one in VS Code, press **Cmd + P** and type
the file name (for example `studio.ts`), then press Enter.

Other words you will see:

| Word | What it means in plain words |
|---|---|
| `§4` | "Section 4" of a document |
| function, like `cacheKey()` | a small named piece of code that does one job. Search for its name inside the file (Cmd + F) |
| API / route | a door on our server that the web page knocks on to ask for something |
| engine | the thing that actually makes the try-on photo |
| GPU | the strong computer chip that makes AI pictures. We borrow it for free, but only a little each day |
| quota | how much free GPU time we are allowed per day |
| cache | a saved copy, so we don't have to make the same photo twice |
| LLM | a text AI (like a chatbot). We use Groq (Llama) or Gemini |
| zod | a checker that makes sure data has the right shape |
| LoRA | a cheap way to teach a big AI model a few new things without changing the whole model |

---

## 1. What the system is, like a story

Think of a shop with three rooms:

1. **The front room (the website in your browser).** It has three pages:
   - `/studio` — the seller picks a **product**, then a **model**, then gets a **photo** of the model wearing the product.
   - `/studio/post` — makes an Instagram post. **Our own code writes the text** on the picture.
   - `/research` — the seller answers 10 questions and gets a saved market report.

2. **The back room (our server).** It takes the request from the front room and does the work:
   - **Try-on:** checks the passcode, checks the settings, cleans the photo, then sends it
     to the try-on engine.
   - **Caption:** asks a text AI to write a caption, then **checks the price in it**. If no AI
     answers, it uses a ready-made template.
   - **Research:** our code does the **money maths and festival dates**. The AI writes the
     ideas (buyers, trends, plan). The report is saved.

3. **The helpers outside the shop (free online services):**
   - **FASHN VTON 1.5** on Hugging Face — this makes the try-on photo, using a free GPU.
   - **Groq (Llama 3.3 70B)** or **Gemini 2.5 Flash** — these write text.

**The one most important idea:** every try-on goes through **one single place**,
`createStudio()` in `src/lib/tryon/studio.ts`. That place does 5 things in order:

1. **Look in the cupboard (cache).** Have we made this exact photo before? Then just give the old one.
2. **Don't do it twice.** If the same photo is being made right now, wait for that one.
3. **One at a time.** Only one photo uses the GPU at a time, because the free time is shared.
4. **Try the engines one by one.** If one fails, try the next, and write down every failure.
5. **Write down GPU time used** in `data/gpu-quota.json`.

**Separate thing:** the `ml/` folder is a Python kit that can run the same model on the
laptop and teach it new things (LoRA). The app does **not** use it today.

### 1.1 Our rules (and where in the code each rule lives)

| Rule, in simple words | File to open | Why |
|---|---|---|
| Every try-on goes through one door | `src/lib/tryon/studio.ts` → `createStudio()` | So nobody can skip the cache, the lock or the error report |
| Engines can be swapped like batteries | `src/lib/tryon/types.ts` (the `Engine` shape), `src/lib/tryon/index.ts` (the `ENGINES` list) | Moving to a paid service or our own GPU means changing just one file |
| Write down every failure, not only the last one | `src/lib/tryon/studio.ts` → `attempts[]` and `explain()` | The seller sees one simple sentence; the developer sees all the errors |
| The cache name is made from the request itself | `src/lib/tryon/store.ts` → `cacheKey()` | Same photos + same settings = same saved picture, no GPU used |
| Maths and dates are done by code, not AI | `src/lib/research/build.ts` → `economics()`, `upcomingMoments()` | AI often gets numbers wrong |
| Check the AI, don't trust it | `src/lib/posts/caption.ts` → `pricesMentioned()` | A caption with a made-up price is thrown away |
| If something breaks, fall back, don't crash | the templates in `caption.ts` and `build.ts` | No AI available → a template, clearly labelled |
| Text on pictures is drawn by our code | `src/lib/posts/render.ts` → `renderPost()` | Picture AIs spell prices wrongly |
| Never show a fake result | the home page and the test engine | The fake engine is clearly called "test engine" |
| The progress bar is real | `src/components/studio/Pipeline.tsx` | It moves only when the server says something happened |
| Privacy | `src/lib/tryon/image.ts` → `prepareImage()` | It removes hidden location (GPS) data from photos |

### 1.2 One try-on, step by step (use this when asked "walk me through it")

1. **The browser checks the photo first** — right type, not too big, at least 256 pixels.
   (Rules: `src/lib/limits.ts`. The server checks again too.)
2. **The server door** `src/app/api/tryon/route.ts` checks the passcode
   (`src/lib/guard.ts`) and the settings.
3. **The photo is cleaned** (`prepareImage()`): turned the right way up, see-through parts made
   white, made smaller (at most 1536 pixels), hidden data removed. A photo that is already
   clean is left exactly as it is, so its cache name doesn't change.
4. **The studio makes the cache name** and tells the browser "got it" and "photo ready".
5. **If the photo was made before:** give the saved one. **No GPU used.**
6. **If not:** wait for our turn on the GPU, then `src/lib/tryon/fashn-space.ts` sends the
   job to the FASHN service.
7. **Live updates:** the service says "you are in the queue", "running", "done", and we pass
   each message to the browser (`src/lib/tryon/stream.ts`).
8. **Save it:** the result is saved in `data/results/<name>/` with the two input photos. The
   GPU time is written down.
9. **Show it:** the browser shows a before/after slider and downloads in Instagram sizes.
10. **If the tab is closed halfway, the job keeps going.** Opening `/studio?r=<name>` again
    picks it back up.

Errors come in 5 kinds: `input` (bad photo), `quota` (free time used up), `timeout` (too
slow), `unavailable` (service down), `unknown`. A **bad photo stops everything**. Any other
error means "try the next engine".

---

## 2. Where things are (folder map)

Easy rule to remember:

- `src/app` = **where** things show up (the pages and server doors)
- `src/lib` = **what** actually happens (all the logic)
- `src/components` = **how** things look (buttons, screens)

| Folder or file | What is inside |
|---|---|
| `README.md` | What the app does and how to set it up. Start here if new |
| `CLAUDE.md` | Our rules + 19 "traps" (problems we hit and how we fixed them) |
| `.env.example` | All settings, explained. Copy it to `.env` |
| `package.json` | All the `npm` commands |
| `Dockerfile` | How to put the app online on Hugging Face |
| `src/app/` | The pages (`/`, `/studio`, `/studio/post`, `/research`, `/design`) and server doors (`api/`) |
| `src/lib/tryon/` | ★ The heart of the try-on: `studio.ts`, `fashn-space.ts`, `image.ts`, `store.ts`, `quota-ledger.ts`, `types.ts`, `echo.ts` (fake engine), `index.ts` |
| `src/lib/quota.ts` | Maths for how many free photos are left |
| `src/lib/llm/index.ts` | The **only** place that talks to the text AI |
| `src/lib/posts/` | Post templates, ₹ formatting, drawing, captions |
| `src/lib/research/` | The research report: questions, money maths, festival dates |
| `src/lib/i18n/messages.ts` | Every English and Hindi sentence in the app |
| `src/components/` | The screens and buttons |
| `tests/` | 54 tests that run without internet |
| `scripts/` | Helper scripts: setup, engine check, AI check, eval |
| `docs/` | All the documents (this one, the professor briefing, the model report, etc.) |
| `ml/` | ★ The Python model work (training kit, tests, saved results) |
| `data/` | Saved photos, saved reports, GPU time log (not uploaded to git) |

---

## 3. How to run things

Open your Terminal and first go to the project:

```bash
cd ~/Desktop/haat/haat-studio
```

### 3.1 Only the very first time

```bash
npm install
npm run setup            # downloads sample model photos and clothes
cp .env.example .env     # then open .env and fill HF_TOKEN, and GEMINI_API_KEY or GROQ_API_KEY
```

### 3.2 Before the meeting: check the outside helpers (uses no free GPU time)

```bash
npm run engine:check     # is the try-on service up and working?
npm run llm:check        # which text AIs answer?
```

### 3.3 Start the app

| When | Type this | Then open |
|---|---|---|
| **For the demo (best)** | `npm run build && npm run start:standalone` | http://localhost:3000 |
| While changing code | `npm run dev -- --port 3100` | http://localhost:3100 |
| **No internet / no token** (fake engine) | `TRYON_ENGINES=echo DATA_DIR=/tmp/haat-test npm run dev -- --port 3100` | http://localhost:3100 |
| To show the "free time used up" screen | add `ECHO_FAIL=quota` to the line above | |

If port 3000 is busy on your Mac, use the 3100 line. Don't run two `npm run dev` at once.

### 3.4 Prove it works, in front of the professor

```bash
npm test                 # 54 tests, about 1 second, no internet
npm run typecheck        # checks the code types
```

⚠️ **Don't** run `npm run eval` in the meeting. It makes real photos and **uses up the free
time** (only about 8 photos a day).

⚠️ **Don't** run `npm run lint` live. It shows errors, but only from the `ml/.venv/` folder and
`docs/btp-report/build-deck.cjs`, not from the app. (Fix: add those folders to
`globalIgnores` in `eslint.config.mjs`.)

### 3.5 The Python model kit

```bash
cd ml
.venv/bin/python -m pytest -q tests        # 12 tests, about 26 seconds, safe to run
```

⚠️ The other `ml` commands (making a real image, training) are **too slow to run live** —
one image takes about **22 minutes** on the laptop. Show their saved results instead (see the
table in section 4). The full list of those commands is in section 3.5 of the original guide.

### 3.6 Build the written report

```bash
ml/.venv/bin/python docs/btp-report/build.py     # run from haat-studio/
```

It needs `ml/runs/real-check/report.json` and `ml/runs/microrun/report.json`. **Don't delete
those two files.**

---

## 4. "If the professor asks X, open Y"

Keep VS Code open. When a question comes, open the file (Cmd + P, type the name), then
search for the name in the last column (Cmd + F).

| If the professor asks… | Open this file | Look for |
|---|---|---|
| "Show me the architecture" | section 1 of this guide, or `docs/professor-briefing.md` section 3 | the picture |
| "Where does a try-on actually happen?" | `src/lib/tryon/studio.ts` | `createStudio()` |
| "How do you call the model?" | `src/lib/tryon/fashn-space.ts` | `client.submit("/try_on"` |
| "How do you avoid wasting GPU?" | `src/lib/tryon/store.ts` | `cacheKey()` |
| "How do you prepare the photos?" | `src/lib/tryon/image.ts` | `prepareImage()`, `exportFor()` |
| "How do you know how much free time is left?" | `src/lib/quota.ts` and `data/gpu-quota.json` | `quotaStatus()`, `photosFitting()` |
| "How do you stop AI mistakes?" | `src/lib/llm/index.ts`, `src/lib/posts/caption.ts` | `completeJSON()`, `pricesMentioned()` |
| "Is the profit worked out by AI?" | `src/lib/research/build.ts` | `economics()`, `upcomingMoments()` — **No, by code** |
| "How is the post picture made?" | `src/lib/posts/render.ts` | `renderPost()` |
| "How is Hindi done?" | `src/lib/i18n/messages.ts` | the `en` and `hi` lists |
| "How do you test it?" | `tests/studio.test.ts`, then run `npm test` | the cache, lock and timeout tests |
| "How good are the results?" | `docs/eval-2026-10-26-baseline.md` | the 30-point score table |
| "Explain the model" | `docs/model-report.md` section 2 | |
| "What did *you* do on the model?" | `ml/haat_ft/flow.py`, `ml/haat_ft/lora.py` | `flow_loss()`, `LoRALinear` |
| "Prove your training method is right" | `ml/runs/real-check/report.json`, `ml/tests/test_finetune.py` | loss ~0.004 (ours) vs ~5 (backwards) |
| "Did the teaching (fine-tuning) work?" | `ml/runs/microrun/report.json` | −27.1%. **Say it was only a small memory test** |
| "How would you measure a fine-tune?" | `ml/haat_ft/metrics.py`, `ml/scripts/evaluate.py` | PSNR, SSIM, garment L1 |
| "How did it fit in 8 GB?" | `ml/haat_ft/infer.py` | `low_memory_attention()` |
| "How would it grow / go online?" | `docs/deploy.md`, `Dockerfile`, `docs/professor-briefing.md` section 6 | |
| "What went wrong / what did you learn?" | `CLAUDE.md` | the "Traps" part — 19 real problems |
| "UX / accessibility?" | `docs/ux/README.md`, and the `/design` page in the app | |

---

## 5. The maths, explained simply

### 5.1 Inside the app

**Cache name** (`store.ts`): we mix the garment photo, the person photo and the settings
into one long code (using sha256, a "fingerprint" maker). **Same inputs → same fingerprint →
reuse the saved picture.** "Another variation" only changes the seed (a random number), so it
gets a new fingerprint.

**Cleaning a photo** (`image.ts`): turn it upright → paint see-through parts white → shrink so
the longest side is at most 1536 pixels → save as JPEG (quality 92) without hidden data.

**Instagram sizes** (`exportFor`): post 1080×1350, square 1080×1080, story 1080×1920.
1. Make a blurry, slightly darker (×0.85) copy of the photo to fill the background.
2. Put the real photo in the middle, shrunk so **nothing is cut off**.
3. Save.

The only colour change in the whole app is darkening that blurry background.
**The clothes are never re-coloured.**

**Free GPU time** (`quota.ts`):
- We get **300 seconds (5 minutes) of GPU per day**.
- Each photo takes about 26–27 seconds (we use the middle value of the last 10 photos).
- Each call holds back 60 seconds at the start.
- There is also a hidden limit of **8 photos** on this account.
- We show whichever is smaller.

Example: 300 seconds left, 26 seconds per photo → time allows 10 photos, but the limit is 8,
so the screen shows **8**.

**Discount** (`posts/spec.ts`): `discount % = (MRP − price) ÷ MRP × 100`, rounded.
₹799 on an MRP of ₹999 → **20%**. Prices are written the Indian way (₹1,29,999).

**Research money maths** (`research/build.ts`):
- profit per piece = price − cost
- margin % = (price − cost) ÷ price × 100
- warn **"loss"** if profit at the lowest price is 0 or less
- warn **"thin"** if margin at the lowest price is below 30%
- show a festival only if it is 0 to 75 days away

**Caption price check** (`caption.ts`): find every price in the caption (₹, Rs, INR or रु,
including Hindi digits). **If any price is not the seller's price or MRP, throw the caption
away.**

### 5.2 Inside the model (FASHN VTON 1.5)

Full details are in `docs/model-report.md`. Simple version:

- **Tiles (tokens):** the picture (864×576) is cut into small 12×12 squares → **3,456 tiles**.
  Person + garment together = **6,912 tiles**, all looked at together.
- **Making the photo (rectified flow):** start from random noise and take **30 small steps**
  in a straight line towards a real photo.
- **Guidance:** at each step the model runs twice — once with the photos, once without — and
  pushes the answer towards "with the photos" (strength 1.5). So 30 × 2 = **60 runs per photo**.
- **How it was trained (our reconstruction, `flow.py`):** mix a real photo with noise, and ask
  the model to guess the direction from noise to photo. Garment pixels count **double**.
  10% of the time, all hints are hidden, so guidance still works later.
- **Why we believe we got it right:** on the real model, our way gives an error of about
  **0.004–0.012**, and the backwards way gives **4.3–6.4**. About **1,000× smaller**, so this
  must be how it was trained.
- **LoRA (`lora.py`):** we add small extra parts to 96 layers. That is 9.8 million new numbers
  next to 972 million frozen ones — only **1.01%**. At the start the extra parts are zero, so
  the model is exactly the original. They are stored in float32 because tiny changes disappear
  in the smaller bf16 format.
- **Training settings (`train.py`):** AdamW, learning rate 1e-4, slow warm-up for 100 steps, then
  slowly lower to 10%, batch of 4, gradient clipping at 1.0.
- **Memory trick (`infer.py`):** one full "attention" table needs about **1.9 GB**. Doing it two
  parts at a time gives the same answer with less memory — that's how it ran on the 8 GB Mac.
- **Scores (`metrics.py`):** **PSNR** (higher = closer to the real photo), **SSIM** (1 = identical),
  **garment L1** (average difference on the clothes only; lower is better).

---

## 6. Numbers to say (and where they come from)

| What | Number | Where it comes from |
|---|---|---|
| App tests | 54 pass, no internet | `npm test` |
| Model kit tests | 12 pass | `ml/tests/test_finetune.py` |
| Quality on tops | 29–30 out of 30 | `docs/eval-2026-10-26-baseline.md` |
| Skirt on a model wearing a dress | 11 out of 30 → fixed by showing ✓/✗ for which model suits | same file |
| Time per photo | ~13 s when warm, ~30 s when cold | baseline file, `data/gpu-quota.json` |
| Free time | 5 GPU minutes a day + hidden limit of 8 photos | the refusal message in the log |
| Our code vs FASHN's | exactly the same, 0.00 difference | `ml/runs/real-check/report.json` |
| Body-parser removed | same result, so it isn't used in our mode | same file |
| Laptop vs online, same seed | PSNR 22.4 dB (same look, slightly different noise) | same file |
| One image on the laptop | about 22 minutes, 4.1 GB memory | same file |
| LoRA small test (100 steps) | error went down 27.1% on trained photos; +1.1% on new ones; 37.5 MB file | `ml/runs/microrun/report.json` |

---

## 7. Ready answers

**"Did you train the model?"**
No. The model belongs to FASHN. I figured out *how* it was trained by reading its code, proved
it on the real model, and built a kit to teach it new things (LoRA). I only ran that kit as a
small 100-step test on my laptop. Real teaching needs 300–500 Indian clothing photo pairs and a
GPU with at least 16 GB.

**"What is your contribution?"**
Three things:
1. The system around the model — cache, saving free GPU time, clear errors, checked AI text,
   and the post and research tools in English and Hindi.
2. Understanding the model, rebuilding its training method, and the LoRA kit.
3. Finding out that the research-only body-parser isn't needed in our mode.

**"Why FASHN and not other models?"**
It works with flat clothes photos (what sellers have), needs no mask, has a free working online
version, has an open licence (Apache-2.0), and is small enough to run ourselves.
(Full comparison: `docs/professor-briefing.md` section 10.)

**"Why not let the AI write the price on the picture?"**
Picture AIs spell text wrongly. We draw the text ourselves, so it's always right.

**"How do you stop the AI lying?"**
Every AI answer must pass a checker (zod). A caption with a price the seller didn't give is
thrown away. Profit and dates are done by code. If every AI fails, a labelled template is used.

**"What if the free GPU runs out?"**
The app counts its own use, learns the hidden limit, shows "N photos left" and when it refills,
and still shows old saved results.

**"What are the limits?"**
- Tested on Western sample clothes; sarees may not work.
- The output is only about 576 pixels wide and is enlarged for Instagram.
- Research uses the AI's general knowledge, not live data.
- The body-parser part is for research use only.
- No user accounts yet.

**"What's next?"**
Our own online version without the parser and with a LoRA, photos from 5–10 local sellers, the
first teaching run on kurtis and salwars, a saree category, and sharper (super-resolution) output.

**"What do you need from me?"**
GPU access, introductions to sellers, ethics approval for a small user study, and a decision on
scope (`docs/professor-briefing.md` section 8).

---

## 8. Checklist before the meeting

- [ ] Run `npm run engine:check` and `npm run llm:check` (internet on). Both should pass.
- [ ] Start the app with `npm run build && npm run start:standalone`. Open http://localhost:3000.
- [ ] Look at the free-time chip at the top. **Don't make photos before the meeting.**
- [ ] Safe demo: the **navy crop top** on the standing woman model is already saved, so it is
      instant and uses no GPU.
- [ ] Keep one research report open in a tab (4 are saved in `data/research/`).
- [ ] VS Code open with the section 4 files ready, and a terminal ready for `npm test`.
- [ ] Open `docs/btp-report/report.html` (or the PDF).
- [ ] If the internet fails: use the examples on the home page, the saved results, and the
      fake engine (it says "test engine" — tell the professor that).
