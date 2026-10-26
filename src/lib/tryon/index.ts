import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { PRESETS } from "@/lib/presets";
import { echo } from "./echo";
import { fashnSpace } from "./fashn-space";
import { diskStore } from "./store";
import { TEST_ENGINES } from "@/lib/engines";
import { gpuLedger } from "./quota-ledger";
import { createStudio, type Studio } from "./studio";
import type { Engine } from "./types";

/** Adding an engine is one entry here plus its adapter file. */
const ENGINES: Record<string, () => Engine> = {
  "fashn-space": () => fashnSpace(),
  echo: () => echo(),
};

export function enginesFromEnv(): Engine[] {
  return env()
    .TRYON_ENGINES.split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => {
      const make = ENGINES[id];
      if (!make) throw new Error(`Unknown engine "${id}" in TRYON_ENGINES. Known: ${Object.keys(ENGINES).join(", ")}`);
      return make();
    });
}

// resolve, not join: an absolute DATA_DIR must stay absolute rather than nest under the project.
export const resultsDir = () => path.resolve(process.cwd(), env().DATA_DIR, "results");
export const store = () => diskStore(resultsDir());

/** What's left of the free GPU quota — null when no quota-spending engine is set up (demo or test engine). */
export async function readQuota() {
  const ready = enginesFromEnv().find((e) => e.configured);
  if (!ready || TEST_ENGINES.has(ready.id)) return null;
  return gpuLedger(store()).status();
}

// One studio per process. On globalThis because `next dev` re-evaluates
// modules on every edit, and a second studio would mean a second GPU lock
// and a second in-flight map — the exact double submission they prevent.
const g = globalThis as { __haatStudio?: Studio };

export function studio(): Studio {
  g.__haatStudio ??= createStudio({ engines: enginesFromEnv, store: store(), timeoutMs: env().TRYON_TIMEOUT_MS, usage: gpuLedger(store()) });
  return g.__haatStudio;
}

export async function readPreset(id: string): Promise<Buffer | null> {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) return null;
  try {
    return await readFile(path.join(process.cwd(), "public", "presets", preset.file));
  } catch {
    return null;
  }
}
