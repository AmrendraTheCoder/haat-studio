import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { PRESETS } from "@/lib/presets";
import { fashnSpace } from "./fashn-space";
import { diskStore } from "./store";
import { createStudio, type Studio } from "./studio";
import type { Engine } from "./types";

/** Adding an engine is one entry here plus its adapter file. */
const ENGINES: Record<string, () => Engine> = {
  "fashn-space": () => fashnSpace(),
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

export const resultsDir = () => path.join(process.cwd(), env().DATA_DIR, "results");
export const store = () => diskStore(resultsDir());

// One studio per process. On globalThis because `next dev` re-evaluates
// modules on every edit, and a second studio would mean a second GPU lock
// and a second in-flight map — the exact double submission they prevent.
const g = globalThis as { __haatStudio?: Studio };

export function studio(): Studio {
  g.__haatStudio ??= createStudio({ engines: enginesFromEnv, store: store(), timeoutMs: env().TRYON_TIMEOUT_MS });
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
