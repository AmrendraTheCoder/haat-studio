import { access } from "node:fs/promises";
import path from "node:path";
import { connection } from "next/server";
import { Studio, type Setup } from "@/components/Studio";
import { PRESETS, SAMPLE_GARMENTS } from "@/lib/presets";
import { enginesFromEnv, store } from "@/lib/tryon";

const exists = (p: string) => access(p).then(
  () => true,
  () => false,
);

/** Reads setup state from disk and env on every request, so fixing setup only needs a reload. */
export default async function Page() {
  await connection();
  const pub = path.join(process.cwd(), "public");

  let engine: Setup["engine"];
  try {
    const engines = enginesFromEnv();
    const ready = engines.find((e) => e.configured);
    engine = ready
      ? { label: ready.label, configured: true }
      : { label: engines[0]?.label ?? "none", configured: false, missing: engines[0]?.missing ?? "TRYON_ENGINES is empty" };
  } catch (err) {
    engine = { label: "misconfigured", configured: false, missing: (err as Error).message };
  }

  const [presets, samples, results] = await Promise.all([
    Promise.all(PRESETS.map(async (p) => ((await exists(path.join(pub, "presets", p.file))) ? p.id : null))),
    Promise.all(SAMPLE_GARMENTS.map(async (s) => ((await exists(path.join(pub, "samples", s.file))) ? s.id : null))),
    store().list(30),
  ]);

  return (
    <Studio
      setup={{ engine, presets: presets.filter((id) => id !== null), samples: samples.filter((id) => id !== null) }}
      initialResults={results}
    />
  );
}
