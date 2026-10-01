@AGENTS.md

# Haat Studio — garment photo in, on-model photo out

Part 1 of Haat (AI assistant for Indian Instagram sellers). Built one part at a
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
scripts/            setup, engine-check, eval
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
- **Text on images is a layout problem.** When posts arrive (stage 4), render
  captions, prices and shop names as real text, not with an image model.

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
8. **Next 16:** route handlers use Web `Request`/`Response`; `connection()` marks a
   page as per-request. Read `node_modules/next/dist/docs/` before using a Next API.

## State

| Stage | Status |
|---|---|
| 0. Prove free generation from code | Space reached, upload + queue verified; refused without token |
| 1. Proper UI + demo mode | Done. Landing, studio, reconnect, cache hit, quota/missing/input errors, exports, lightbox, phone layout all exercised in the browser with the echo engine |
| 2. First real results + baseline | Waiting on HF_TOKEN |
| 3. Quality (eval scores, Indian presets, more categories) | Not started |
| 4. Social posts | Not started |
| 5. Research questionnaire | Not started |

Do not call generation "working" until a real result has come back through the UI.
