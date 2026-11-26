/**
 * One real try-on with the LoRA-tuned model, through studio().start() like every other try-on.
 * Spends no shared GPU quota when the tuned engine is local-lora (it runs on this computer).
 *
 *   TRYON_ENGINES=local-lora npx tsx --env-file-if-exists=.env scripts/tuned-check.ts [garment.jpg] [preset]
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { modelAvailability, readPreset, studio } from "../src/lib/tryon";
import { prepareImage } from "../src/lib/tryon/image";

const garmentFile = process.argv[2] ?? path.join("public", "samples", "black-tee.jpg");
const presetId = process.argv[3] ?? "standing-men";
const avail = modelAvailability();
console.log("models:", JSON.stringify(avail));
if (!avail.tuned.available) {
  console.error("The tuned model is not set up:", avail.tuned.reason);
  process.exit(1);
}
const person = await readPreset(presetId);
if (!person) throw new Error(`preset ${presetId} missing; run npm run setup`);
const [g, p] = await Promise.all([prepareImage(await readFile(garmentFile), "garment"), prepareImage(person, "model")]);
const t0 = Date.now();
const job = studio().start({ garment: g.bytes, person: p.bytes, personId: presetId, settings: { category: "tops", photoType: "flat-lay", quality: "fast", seed: 42 }, model: "tuned" });
job.subscribe((e) => console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`, JSON.stringify(e).slice(0, 300)));
const end = await job.done;
process.exit(end.type === "done" ? 0 : 1);
