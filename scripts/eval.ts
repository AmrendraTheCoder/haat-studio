/**
 * Runs every sample garment through the real engine and writes a report to
 * score by eye.
 *
 *   npm run eval                    # balanced quality, seed 42
 *   npm run eval -- --quality fast
 *
 * Goes through the same `studio()` as the app, so it shares the result
 * cache: re-running costs nothing for pairs already generated, and new
 * results show up in the app's gallery. Change a setting or the
 * preprocessing and the keys change, so you get fresh, comparable output.
 *
 * Free quota is small (minutes of GPU a day). Three garments at "balanced"
 * is a sensible daily run.
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { PRESETS, SAMPLE_GARMENTS } from "../src/lib/presets";
import { readPreset, resultsDir, studio } from "../src/lib/tryon";
import { prepareImage } from "../src/lib/tryon/image";
import type { Quality, StreamEvent } from "../src/lib/tryon/types";

const { values } = parseArgs({ options: { quality: { type: "string", default: "balanced" }, seed: { type: "string", default: "42" } } });
const quality = values.quality as Quality;
if (!["fast", "balanced", "best"].includes(quality)) throw new Error("--quality must be fast, balanced or best");
const seed = Number(values.seed);

const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const outDir = path.join(process.cwd(), "eval", "reports", `${stamp}-${quality}`);
await mkdir(outDir, { recursive: true });

const rows: string[] = [];
for (const sample of SAMPLE_GARMENTS) {
  const garmentRaw = await readFile(path.join(process.cwd(), "public", "samples", sample.file)).catch(() => null);
  const personRaw = await readPreset(sample.preset);
  if (!garmentRaw || !personRaw) {
    console.error("Samples or presets missing — run npm run setup first.");
    process.exit(1);
  }

  const settings = { category: sample.category, photoType: sample.photoType, quality, seed };
  const job = studio().start({
    garment: await prepareImage(garmentRaw, "garment"),
    person: await prepareImage(personRaw, "model"),
    personId: sample.preset,
    settings,
  });
  process.stdout.write(`${sample.id.padEnd(18)} `);
  job.subscribe((e: StreamEvent) => {
    if (e.type === "queued") process.stdout.write("q");
    if (e.type === "running") process.stdout.write("r");
  });
  const end = await job.done;

  const model = PRESETS.find((p) => p.id === sample.preset)?.label ?? sample.preset;
  if (end.type === "done") {
    const r = end.result;
    const image = `${sample.id}.png`;
    await copyFile(path.join(resultsDir(), r.key, "result.png"), path.join(outDir, image));
    await copyFile(path.join(resultsDir(), r.key, "garment.jpg"), path.join(outDir, `${sample.id}-garment.jpg`));
    console.log(` ${end.cached ? "cached" : `${(r.totalMs / 1000).toFixed(1)}s (${(r.queueMs / 1000).toFixed(1)}s queued)`}`);
    rows.push(
      `| ${sample.label}<br><img src="${sample.id}-garment.jpg" width="120"> | ${model} | <img src="${image}" width="200"> | ${end.cached ? "cached" : (r.totalMs / 1000).toFixed(1)} | ${end.cached ? "–" : (r.queueMs / 1000).toFixed(1)} |  |  |  |  |  |  |`,
    );
  } else if (end.type === "error") {
    console.log(` FAILED: ${end.message}`);
    rows.push(`| ${sample.label} | ${model} | **failed:** ${end.message.replace(/\|/g, "/")} | – | – |  |  |  |  |  |  |`);
  }
}

const report = `# Try-on eval · ${stamp} · ${quality}

Engine chain: \`${process.env.TRYON_ENGINES ?? "fashn-space"}\` · seed ${seed}

Score each column 1–5 by comparing the result with the product photo. A result
that looks good but changes the product is a failure: sellers post this as
their product.

| Product | Model | Result | Total s | Queue s | Colour | Print / pattern | Neckline / waist | Sleeves / length | Shape & fit | No artifacts |
|---|---|---|---|---|---|---|---|---|---|---|
${rows.join("\n")}

Artifacts to look for: leftover original clothing, warped hands or face,
text or logos garbled, garment cut off, skin where fabric should be.
`;
await writeFile(path.join(outDir, "report.md"), report);
console.log(`\nReport: ${path.relative(process.cwd(), path.join(outDir, "report.md"))}`);
process.exit(0);
