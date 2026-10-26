import { readFile, rename, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { TEST_ENGINES } from "@/lib/engines";
import { env } from "@/lib/env";
import { DAY_MS, learnFromRefusal, parseRefusal, quotaStatus, type Ledger, type QuotaStatus } from "@/lib/quota";
import type { ResultStore } from "./store";

/**
 * GPU time this studio has spent, in `DATA_DIR/gpu-quota.json`. Only engines
 * that spend ZeroGPU quota are recorded — never test engines or cache hits.
 */
const file = () => path.resolve(process.cwd(), env().DATA_DIR, "gpu-quota.json");

/** Two days is enough to find the current 24-hour window. */
const prune = (l: Ledger, now: number): Ledger => ({ ...l, runs: l.runs.filter((r) => r.at > now - 2 * DAY_MS) });

/** First use: rebuild the recent runs from saved results, so photos made before the ledger existed still count. */
async function seed(store: ResultStore, now: number): Promise<Ledger> {
  const metas = await store.list(500);
  const runs = metas
    .filter((m) => !TEST_ENGINES.has(m.engine))
    .map((m) => ({ ms: m.totalMs - m.queueMs, at: Date.parse(m.createdAt) - (m.totalMs - m.queueMs) }))
    .filter((r) => r.ms > 0 && r.at > now - 2 * DAY_MS)
    .sort((a, b) => a.at - b.at);
  return { runs };
}

async function read(store: ResultStore, now: number): Promise<Ledger> {
  try {
    const l = JSON.parse(await readFile(file(), "utf8")) as Ledger;
    // Refusals saved before `kind` existed: re-read their message.
    return l.refusal && !l.refusal.kind ? learnFromRefusal(l, parseRefusal(l.refusal.message, l.refusal.at)) : l;
  } catch {
    const seeded = await seed(store, now);
    await write(seeded);
    return seeded;
  }
}

async function write(l: Ledger) {
  await mkdir(path.dirname(file()), { recursive: true });
  await writeFile(`${file()}.tmp`, JSON.stringify(l, null, 2));
  await rename(`${file()}.tmp`, file());
}

// One writer at a time, so two quick updates can't overwrite each other.
let queue: Promise<unknown> = Promise.resolve();
function update(store: ResultStore, fn: (l: Ledger, now: number) => Ledger) {
  const next = queue.then(async () => {
    const now = Date.now();
    await write(prune(fn(await read(store, now), now), now));
  });
  queue = next.catch(() => {});
  return next;
}

export function gpuLedger(store: ResultStore) {
  return {
    /** A run that reached the GPU — finished or not, it spent quota. */
    run(engine: string, at: number, ms: number) {
      if (TEST_ENGINES.has(engine) || ms <= 0) return Promise.resolve();
      return update(store, (l) => ({ ...l, runs: [...l.runs, { at, ms }] }));
    },
    /** ZeroGPU said no; its message is the only exact balance there is. */
    refused(engine: string, message: string) {
      if (TEST_ENGINES.has(engine)) return Promise.resolve();
      console.warn(`[quota] ${engine} refused: ${message}`);
      return update(store, (l, now) => learnFromRefusal(l, parseRefusal(message, now)));
    },
    async status(): Promise<QuotaStatus> {
      await queue;
      const now = Date.now();
      return quotaStatus(await read(store, now), now, env().ZEROGPU_DAILY_SECONDS, env().ZEROGPU_DAILY_RUNS);
    },
  };
}
