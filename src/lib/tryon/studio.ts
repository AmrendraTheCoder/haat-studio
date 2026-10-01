import { toPng } from "./image";
import { cacheKey, type ResultStore } from "./store";
import { EngineError, type Attempt, type Engine, type Prep, type ResultMeta, type StreamEvent, type TryOnSettings } from "./types";

export interface TryOnRequest {
  /** Both already through `prepareImage`. */
  garment: Buffer;
  person: Buffer;
  personId: string;
  settings: TryOnSettings;
  /** What preprocessing changed; replayed to anyone who reconnects. */
  prep?: Prep;
}

export interface Job {
  readonly key: string;
  /** Replays every event so far, then follows live ones. Returns an unsubscribe. */
  subscribe(listener: (e: StreamEvent) => void): () => void;
  /** Resolves with the terminal event. Never rejects. */
  readonly done: Promise<StreamEvent>;
}

export interface StudioOptions {
  /** Read per job, so editing .env takes effect without a restart. */
  engines: () => Engine[];
  store: ResultStore;
  timeoutMs: number;
  now?: () => number;
}

export interface Studio {
  start(req: TryOnRequest): Job;
  /** The running job for `key`, if any — lets a reloaded page pick the stream back up. */
  get(key: string): Job | undefined;
}

/**
 * The single place a try-on happens. Every route, script and eval goes
 * through `start`, which owns, in order:
 *
 *   1. the result cache — a repeat request costs no GPU time;
 *   2. in-flight sharing — a double click, or a second tab, joins the
 *      running job instead of submitting the same work twice;
 *   3. one generation at a time — the free quota is shared, so jobs queue
 *      here rather than racing each other into the Space;
 *   4. the engine chain — each engine is tried in order, and every failure
 *      is kept so the error a seller sees names all of them, not just the last.
 *
 * A job outlives the request that started it: closing the tab does not waste
 * the GPU time already spent — the result still lands in the cache.
 */
export function createStudio(opts: StudioOptions): Studio {
  const now = opts.now ?? Date.now;
  const inflight = new Map<string, Job>();
  let gpu: Promise<void> = Promise.resolve();
  let holders = 0;

  async function exclusive<T>(fn: () => Promise<T>, onWait: () => void): Promise<T> {
    if (holders > 0) onWait();
    holders++;
    const previous = gpu;
    let release!: () => void;
    gpu = new Promise((resolve) => (release = resolve));
    try {
      await previous;
      return await fn();
    } finally {
      holders--;
      release();
    }
  }

  async function generate(req: TryOnRequest, key: string, emit: (e: StreamEvent) => void): Promise<StreamEvent> {
    const attempts: Attempt[] = [];
    const input = { garment: req.garment, person: req.person, settings: req.settings };

    for (const engine of opts.engines()) {
      if (!engine.configured) {
        attempts.push({ engine: engine.id, kind: "skipped", message: engine.missing ?? "not configured" });
        continue;
      }

      const submitted = now();
      let started: number | null = null;
      const signal = AbortSignal.timeout(opts.timeoutMs);
      try {
        const bytes = await engine.run(
          input,
          (e) => {
            if (e.type === "running") started ??= now();
            emit({ ...e, engine: engine.id });
          },
          signal,
        );
        const result = await toPng(bytes).catch(() => {
          throw new EngineError("the engine returned something that isn't an image", "unknown");
        });
        const finished = now();
        const meta: ResultMeta = {
          key,
          engine: engine.id,
          settings: req.settings,
          personId: req.personId,
          createdAt: new Date(finished).toISOString(),
          totalMs: finished - submitted,
          queueMs: (started ?? submitted) - submitted,
          ...(req.prep && { prep: req.prep }),
        };
        await opts.store.save(meta, { "result.png": result, "garment.jpg": req.garment, "person.jpg": req.person });
        const done: StreamEvent = { type: "done", result: meta, cached: false };
        emit(done);
        return done;
      } catch (err) {
        const e = asEngineError(err, signal, opts.timeoutMs);
        attempts.push({ engine: engine.id, kind: e.kind, message: e.message, retryAfterSeconds: e.retryAfterSeconds });
        if (e.kind === "input") break;
      }
    }

    const failed: StreamEvent = { type: "error", message: explain(attempts), attempts };
    emit(failed);
    return failed;
  }

  async function run(req: TryOnRequest, key: string, emit: (e: StreamEvent) => void): Promise<StreamEvent> {
    const hit = await opts.store.find(key);
    emit({ type: "checked", hit: hit !== null });
    if (hit) {
      const done: StreamEvent = { type: "done", result: hit, cached: true };
      emit(done);
      return done;
    }
    return exclusive(() => generate(req, key, emit), () => emit({ type: "waiting" }));
  }

  return {
    get: (key) => inflight.get(key),

    start(req) {
      const key = cacheKey(req.garment, req.person, req.settings);
      const existing = inflight.get(key);
      if (existing) return existing;

      const events: StreamEvent[] = [];
      const listeners = new Set<(e: StreamEvent) => void>();
      const emit = (event: StreamEvent) => {
        const e = { ...event, at: now() };
        events.push(e);
        for (const listener of listeners) listener(e);
      };

      emit({ type: "accepted", key });
      if (req.prep) emit({ type: "prepared", prep: req.prep });
      const done = run(req, key, emit)
        .catch((err: unknown) => {
          const failed: StreamEvent = { type: "error", message: `Unexpected failure: ${(err as Error).message}`, attempts: [] };
          emit(failed);
          return failed;
        })
        .finally(() => inflight.delete(key));

      const job: Job = {
        key,
        done,
        subscribe(listener) {
          for (const e of events) listener(e);
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };
      inflight.set(key, job);
      return job;
    },
  };
}

function asEngineError(err: unknown, signal: AbortSignal, timeoutMs: number): EngineError {
  // Whatever the engine threw on the way out, a fired timeout is the cause.
  if (signal.aborted) return new EngineError(`no result within ${Math.round(timeoutMs / 1000)}s`, "timeout");
  if (err instanceof EngineError) return err;
  return new EngineError((err as Error)?.message ?? String(err), "unknown");
}

/** One sentence a seller can act on. The per-engine detail travels alongside in `attempts`. */
export function explain(attempts: Attempt[]): string {
  const tried = attempts.filter((a) => a.kind !== "skipped");
  if (tried.length === 0) {
    return "No try-on engine is set up. Add a free Hugging Face token as HF_TOKEN in .env, then try again.";
  }
  const input = tried.find((a) => a.kind === "input");
  if (input) return input.message;
  if (tried.every((a) => a.kind === "quota")) {
    const wait = Math.min(...tried.map((a) => a.retryAfterSeconds ?? Infinity));
    const when = Number.isFinite(wait) ? ` It refills in about ${formatWait(wait)}.` : "";
    return `Today's free GPU quota is used up.${when} Photos made earlier are still saved and open instantly.`;
  }
  if (tried.every((a) => a.kind === "timeout")) {
    return "The GPU queue is too long right now. Try again in a few minutes.";
  }
  return `Generation failed — ${tried.map((a) => `${a.engine}: ${a.message}`).join("; ")}`;
}

function formatWait(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}
