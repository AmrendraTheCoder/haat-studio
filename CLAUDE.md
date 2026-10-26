@AGENTS.md

# Haat Studio — photo, post, plan for Indian Instagram sellers

Try-on studio (Phases 1–3), post maker (4), market research (5), deployment (6). Built one part at a
time: make it work, measure it, optimise it, then move on. Free services only.
`../stiche-v2` is the reference architecture; never edit it.

## Layout

```
src/lib/tryon/
  studio.ts       createStudio(): cache → in-flight sharing → GPU lock → engine chain
  fashn-space.ts  FASHN VTON 1.5 adapter over the Gradio client; classify() for ZeroGPU errors
  image.ts        prepareImage(): orient, flatten alpha, ≤1536px, strip metadata; exportFor() Instagram sizes
  store.ts        cacheKey(), diskStore() (data/results/<key>/), memoryStore() for tests
  types.ts        settings schema, Engine interface, StreamEvent
  index.ts        engine registry, studio() singleton, readPreset()
  stream.ts       streamJob(): NDJSON response for a live or finished job
  echo.ts         test engine — returns the model photo, no try-on
src/lib/presets.ts  preset models + sample garments (pure data, client-safe)
src/lib/limits.ts   upload rules + export sizes shared by browser and server
src/lib/engines.ts  engine display names; TEST_ENGINES (labelled, never featured)
src/lib/site.ts     readSetup / readFeatured / readRecent for the pages
src/app/page.tsx              landing
src/app/studio/page.tsx       studio (?r=<key> re-attaches)
src/app/api/tryon             POST multipart → NDJSON stream
src/app/api/tryon/[key]       GET: re-attach to a running job, or its saved result
src/app/api/results/[key]/[file]  result.png garment.jpg person.jpg + post/square/story.jpg exports
src/app/api/featured          GET list, POST {key,on} (CURATION=on only)
src/components/site/          wordmark, nav, footer, scallop, ticker (Haat look from stiche-v2)
src/components/shared/        BeforeAfter slider, Placeholder
src/components/studio/        StudioApp (state machine), Steps, ResultStep, Pipeline, parts
src/lib/llm/        completeJSON(): the only text-AI call site — provider chain, JSON extraction, zod validation
src/lib/posts/      spec.ts (shared schema, templates, palettes), render.ts (canvas, browser-only), caption.ts
src/lib/research/   schema.ts (shared), build.ts (prompt, calculated economics + moments, template fallback, storage)
src/lib/guard.ts    requirePasscode() for every creating route (STUDIO_PASSCODE)
src/lib/client/roving.ts  radioKeyDown/rovingTabIndex — every role="radio" group uses them
src/lib/client/share.ts   Web Share (files) for phones; feature-detected
src/lib/i18n/       messages.ts (en + hi dictionaries), server.ts getMessages(), client.tsx useI18n()/LanguageToggle
src/app/design            "How it's designed" page; docs/ux/ is the long form
src/app/studio/post           post maker (?r=<key>)
src/app/research, research/[id]  questionnaire and saved report
src/app/api/caption, api/research  POST, passcode-gated
scripts/            setup, engine-check, llm-check, eval
Dockerfile          standalone Next server on :7860 as uid 1000 (Hugging Face Spaces); DATA_DIR=/data
tests/              vitest, no network
```

## Rules

- **Every try-on goes through `studio().start()`.** Routes, scripts and evals alike.
  It owns the cache, deduplication, the one-at-a-time lock and the error report.
  Never call an engine directly.
- **Engines are adapters behind `Engine`.** Adding one is a file plus one line in
  the `ENGINES` registry in `src/lib/tryon/index.ts`; `TRYON_ENGINES` orders them.
  Throw `EngineError` with the right `kind`: `input` stops the chain, everything
  else falls through to the next engine.
- **Report every attempt.** The seller sees one sentence from `explain()`; the
  per-engine detail travels in `attempts`. stiche-v2 lost days to a fallback
  chain that only reported its last error.
- **The cache key is the request.** Hash of both normalised images + settings
  (seed included). Changing `prepareImage` changes keys — intended: new
  preprocessing means new results.
- **One config file: `.env`.** Next.js loads it; scripts get `--env-file-if-exists=.env`.
  `env()` re-parses on each call so a new token works after a reload.
- **Don't commit photos.** `public/presets`, `public/samples`, `data/` and
  `eval/reports` are gitignored; `npm run setup` recreates the first two.
- **Never show an invented result.** Landing slots without a real featured photo
  are labelled placeholders. Echo-engine output is labelled "test engine" and
  `setFeatured` refuses it.
- **The live panel is derived, not animated.** `Pipeline` computes each stage from
  the events the server sent (server-timestamped via `at`). Don't add timers that
  advance stages on their own.
- **Every disabled button shows why.** Steps pass a `reason` to `ActionBar`.
- **Accessibility is a rule, not a pass:** controls ≥ 44 px (`min-h-11`), text
  from tokens only (no raw colours; nothing below `text-2xs`, 11 px), option
  groups use `radioKeyDown` + `rovingTabIndex`, field errors set `aria-invalid`
  and `aria-describedby`. docs/ux/06-accessibility.md has the audit method.
- **Text on images is a layout problem.** Post text is drawn on a canvas by
  `render.ts`, never by an image model, and never across the garment.
- **Every text-AI call goes through `completeJSON`,** and every caller has a
  labelled template fallback. Captions quoting a price the seller didn't give
  are rejected (`pricesMentioned`). Maths and dates in research are code.
- **Creating routes call `requirePasscode` first.** Reads stay open.
- **Every word a seller sees comes from `src/lib/i18n/messages.ts`** — `getMessages()` in
  server components, `useI18n()` in client ones. Add the English and the Hindi together;
  the `Messages` type rejects a missing key and a test rejects an untranslated one.
  Data that is saved (research warnings) stores codes, not sentences, so it renders in
  either language. Hashtags stay in Roman letters in every language.

## Verifying

```bash
npm test               # no network
npm run typecheck && npm run lint
npm run engine:check   # token, Space status, API contract — no GPU quota
npm run eval           # real generations; spends quota
```

## Traps

1. **Anonymous ZeroGPU calls are refused.** The Space queues the job and then
   errors with "exceeded your ZeroGPU runs limit". `HF_TOKEN` is required.
2. **Node's fetch inside the Claude sandbox can't reach the internet** (no proxy
   support, keychain certs). `setup`, `engine:check`, `eval` and the Gradio
   client must run unsandboxed. curl works in the sandbox; Node does not.
3. **Port 3000 is often taken on this machine.** `.claude/launch.json` uses 3100.
4. **The studio is a `globalThis` singleton** so `next dev` reloads don't create a
   second GPU lock. Changing `createStudio` options needs a server restart.
5. **`DATA_DIR` must go through `path.resolve`.** `path.join(cwd, "/abs/dir")`
   nests the absolute path inside the project — test output once landed in
   `./private/tmp/...` that way.
6. **Re-encoding a JPEG changes its bytes**, which changes the cache key.
   `prepareImage` passes clean JPEGs through untouched for that reason; keep it.
7. **Testing the UI without a token:** `TRYON_ENGINES=echo DATA_DIR=<tmp> next dev`
   (`ECHO_FAIL=quota|error` for failure screens). Stop the preview server first —
   two `next dev` processes can't share the project.
8. **Result URLs are cached as immutable.** Anything that could put different
   bytes under the same key (like a test engine) must get its own key space —
   `cacheKey(..., namespace)`; studio passes `test:<ids>` for test engines.
9. **Bottoms need a model wearing separates.** On a model in a dress, a skirt
   blends into the dress. Presets carry `wearing` and `suits`; keep them honest.
10. **`next build` can't bind its CSS worker port from the Bash tool**, sandboxed
    or not. Build through the `haat-studio-prod` launch config (port 3200).
11. **Don't redraw the post canvas with requestAnimationFrame** — frames pause in
    background tabs and embedded previews, leaving it blank. A short timer is used,
    and download redraws first.
12. **Browser-storage hydration:** read localStorage in an effect, and don't save
    on the first pass (it still holds the empty form) — that wiped saved shop details once.
13. **HF text-AI credit is tiny and silently exhausted**, so `hf/` isn't in the default
    `LLM_CHAIN`; otherwise the UI says "AI on" while every call falls back.
14. **Gemini 2.5 Flash spends max_tokens on hidden "thinking"** and returns an
    empty answer for short requests. The llm layer sends `reasoning_effort: "none"`
    for Gemini Flash only (Groq rejects the field).
15. **The standalone server chdirs into `.next/standalone`.** A relative DATA_DIR
    then points at a build-time copy that the next build wipes. `start:standalone`
    passes an absolute DATA_DIR and loads the real `.env`; `outputFileTracingExcludes`
    keeps `data/` out of the build. Docker uses `/data`, unaffected.
16. **Next 16:** route handlers use Web `Request`/`Response`; `connection()` marks a
   page as per-request. Read `node_modules/next/dist/docs/` before using a Next API.
17. **The language lives in a cookie (`haat-lang`), not localStorage,** so server-rendered
    pages come out in the right language; the toggle sets it and calls `router.refresh()`.
    Every page reading it is per-request — that's why `/design` is no longer static.
18. **Gemini writes Devanagari hashtags for a Hindi caption** unless the system prompt
    itself says Roman letters (`caption.ts` SYSTEM + HASHTAG_RULE). A rule only in the
    user prompt was ignored.

## State

| Phase | Status |
|---|---|
| 1. Proper UI + demo mode | Done |
| 2. First real results + baseline | Done 2026-10-26 — docs/eval-2026-10-26-baseline.md |
| 3. Quality | Partly: preset suitability. Needs real Indian garments from sellers |
| 4. Post maker | Done. Templates verified in the browser; AI captions verified live with Gemini 2.5 Flash (exact prices, Hinglish) |
| 5. Market research | Done. Verified live with Gemini 2.5 Flash (~9 s per report) and on the template path |
| 6. Deployment | Production build + standalone server verified locally (all routes, sharp exports). Docker image not built here (Docker Desktop wasn't running); Space not created (needs the user's write token) |
| Hindi | Done 2026-10-26. Header toggle; every screen, the post canvas, captions (English / Hinglish / हिन्दी) and research reports. Verified live with Gemini 2.5 Flash. Wording not yet reviewed by a native speaker |
