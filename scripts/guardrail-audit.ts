/**
 * Runs the output guardrails (src/lib/tryon/quality.ts) on every saved real try-on and
 * writes the results for the report: docs/mini-project-report/results/app_guardrails.json.
 *
 *   npx tsx scripts/guardrail-audit.ts [--write]
 *
 * --write also stores the checks in each result's meta.json, so photos saved before the
 * guardrails existed show them too. The cache key and the images are not touched.
 */
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { checkQuality, colourPalettes, LIMITS } from "../src/lib/tryon/quality";

const root = path.resolve(process.env.DATA_DIR ?? "data", "results");
const rows = [];
for (const key of (await readdir(root)).filter((d) => /^[0-9a-f]{32}$/.test(d))) {
  const meta = JSON.parse(await readFile(path.join(root, key, "meta.json"), "utf8"));
  if (meta.engine !== "fashn-space") continue;
  const [result, person, garment] = await Promise.all(["result.png", "person.jpg", "garment.jpg"].map((f) => readFile(path.join(root, key, f))));
  const t0 = performance.now();
  const q = await checkQuality({ result, person, garment, settings: meta.settings });
  if (process.argv.includes("--write")) {
    const file = path.join(root, key, "meta.json");
    await writeFile(`${file}.tmp`, JSON.stringify({ ...meta, quality: q }, null, 2));
    await rename(`${file}.tmp`, file);
  }
  const pal = await colourPalettes({ result, person, garment, settings: meta.settings });
  const sw = (p: typeof pal.want) => p.map((s) => ({ lab: s.lab.map((v) => Math.round(v * 10) / 10), share: Math.round(s.share * 1000) / 1000 }));
  rows.push({ palettes: { garment: sw(pal.want), old: sw(pal.old), result: sw(pal.got) }, key: key.slice(0, 8), category: meta.settings.category, model: meta.personId, ms: Math.round(performance.now() - t0), passed: q.passed, checks: Object.fromEntries(q.checks.map((c) => [c.id, { value: c.value, ok: c.ok, ...(c.detail ?? {}) }])) });
}
const out = path.resolve("docs/mini-project-report/results/app_guardrails.json");
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, JSON.stringify({ limits: LIMITS, results: rows }, null, 2));
console.log(`${rows.length} results → ${out}`);
for (const r of rows) console.log(r.key, r.category, r.model, r.passed, Object.entries(r.checks).map(([k, v]) => `${k}=${v.value}${v.ok ? "" : "!"}`).join(" "));
