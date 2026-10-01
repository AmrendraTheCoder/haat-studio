/**
 * Downloads the preset model photos and sample garments into public/.
 * They are FASHN's own Space examples (Apache-2.0) and are not committed.
 *
 *   npm run setup
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PRESETS, SAMPLE_GARMENTS } from "../src/lib/presets";

const pub = path.join(process.cwd(), "public");
const exists = (p: string) => access(p).then(() => true, () => false);

async function fetchTo(url: string, dest: string) {
  if (await exists(dest)) return "kept";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  // Same bounds as an upload, so a preset costs no more upload time than a seller's photo.
  const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: 1536, height: 1536, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 92 })
    .toBuffer();
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, jpeg);
  return "downloaded";
}

const jobs = [
  ...PRESETS.map((p) => ({ name: `model  ${p.id}`, url: p.sourceUrl, dest: path.join(pub, "presets", p.file) })),
  ...SAMPLE_GARMENTS.map((s) => ({ name: `sample ${s.id}`, url: s.sourceUrl, dest: path.join(pub, "samples", s.file) })),
];

let failed = 0;
for (const job of jobs) {
  try {
    console.log(`  ${(await fetchTo(job.url, job.dest)).padEnd(10)} ${job.name}`);
  } catch (err) {
    failed++;
    console.error(`  failed     ${job.name}: ${(err as Error).message}`);
  }
}
process.exit(failed ? 1 : 0);
