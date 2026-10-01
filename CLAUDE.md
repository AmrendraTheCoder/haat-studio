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
  image.ts        prepareImage(): EXIF orient, flatten alpha onto white, ≤1536px, JPEG
  store.ts        cacheKey(), diskStore() (data/results/<key>/), memoryStore() for tests
  types.ts        settings schema, Engine interface, StreamEvent
  index.ts        engine registry, studio() singleton, readPreset()
src/lib/presets.ts  preset models + sample garments (pure data, client-safe)
src/app/api/tryon   POST multipart → NDJSON stream
src/app/api/results list + serve stored images
src/components/     Studio (state), Output, Gallery, ModelPicker, controls
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
5. **Next 16:** route handlers use Web `Request`/`Response`; `connection()` marks a
   page as per-request. Read `node_modules/next/dist/docs/` before using a Next API.

## State

| Stage | Status |
|---|---|
| 1. Prove free generation | Space reached, upload + queue verified; refused without token. First tokened generation pending |
| 2. Demo app | Built; unit tests, typecheck, lint pass; error paths verified against the dev server |
| 3. Quality (eval scores, Indian presets, more categories) | Not started |
| 4. Social posts | Not started |
| 5. Research questionnaire | Not started |

Do not call generation "working" until a real result has come back through the UI.
