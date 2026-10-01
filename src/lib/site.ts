import { access } from "node:fs/promises";
import path from "node:path";
import { TEST_ENGINES } from "@/lib/engines";
import { env } from "@/lib/env";
import { PRESETS, SAMPLE_GARMENTS } from "@/lib/presets";
import { enginesFromEnv, store } from "@/lib/tryon";
import type { ResultMeta } from "@/lib/tryon/types";

/** Everything the pages need to know about this installation. Pure data, passed to client components. */
export interface Setup {
  engine: { id: string; label: string; configured: boolean; missing?: string };
  /** Preset/sample ids whose photos are actually on disk. */
  presets: string[];
  samples: string[];
  curation: boolean;
}

const exists = (p: string) =>
  access(p).then(
    () => true,
    () => false,
  );

export async function readSetup(): Promise<Setup> {
  const pub = path.join(process.cwd(), "public");

  let engine: Setup["engine"];
  let curation = false;
  try {
    curation = env().CURATION === "on";
    const engines = enginesFromEnv();
    const ready = engines.find((e) => e.configured);
    engine = ready
      ? { id: ready.id, label: ready.label, configured: true }
      : { id: engines[0]?.id ?? "none", label: engines[0]?.label ?? "none", configured: false, missing: engines[0]?.missing ?? "TRYON_ENGINES is empty" };
  } catch (err) {
    engine = { id: "none", label: "misconfigured", configured: false, missing: (err as Error).message };
  }

  const [presets, samples] = await Promise.all([
    Promise.all(PRESETS.map(async (p) => ((await exists(path.join(pub, "presets", p.file))) ? p.id : null))),
    Promise.all(SAMPLE_GARMENTS.map(async (s) => ((await exists(path.join(pub, "samples", s.file))) ? s.id : null))),
  ]);
  return {
    engine,
    presets: presets.filter((id) => id !== null),
    samples: samples.filter((id) => id !== null),
    curation,
  };
}

export async function readFeatured(): Promise<ResultMeta[]> {
  const s = store();
  const metas = await Promise.all((await s.featured()).map((k) => s.find(k)));
  return metas.filter((m): m is ResultMeta => m !== null && !TEST_ENGINES.has(m.engine));
}

export const readRecent = (limit = 24) => store().list(limit);
