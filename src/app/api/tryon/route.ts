import { createHash } from "node:crypto";
import { readPreset, studio } from "@/lib/tryon";
import { InputError, prepareImage } from "@/lib/tryon/image";
import { streamJob } from "@/lib/tryon/stream";
import { settingsSchema } from "@/lib/tryon/types";

// A cold Space plus a queue can take minutes. Honoured by hosts that read it.
export const maxDuration = 300;

const bad = (message: string, status = 400) => Response.json({ error: message }, { status });

const fileBytes = async (value: FormDataEntryValue | null) =>
  value instanceof File && value.size > 0 ? Buffer.from(await value.arrayBuffer()) : null;

/**
 * POST multipart: garment (file), preset (id) or person (file), category,
 * photoType, quality, seed.
 *
 * Responds with NDJSON — one StreamEvent per line, ending with `done` or
 * `error`. Problems with the request itself come back as a plain 4xx JSON
 * body before any streaming starts, so the browser can tell "fix your
 * input" from "the engine failed".
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("Send the photos as multipart form data.");
  }

  const settings = settingsSchema.safeParse({
    category: form.get("category"),
    photoType: form.get("photoType"),
    quality: form.get("quality"),
    seed: form.get("seed") ?? 42,
  });
  if (!settings.success) {
    return bad(`Invalid settings: ${settings.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(", ")}`);
  }

  const garmentRaw = await fileBytes(form.get("garment"));
  if (!garmentRaw) return bad("Add a photo of the garment.");

  const uploadedPerson = await fileBytes(form.get("person"));
  const presetId = form.get("preset");
  let personRaw: Buffer | null = uploadedPerson;
  if (!personRaw) {
    if (typeof presetId !== "string" || !presetId) return bad("Choose a model, or upload a photo of one.");
    personRaw = await readPreset(presetId);
    if (!personRaw) return bad(`The "${presetId}" model photo isn't installed. Run npm run setup.`, 409);
  }

  let garment, person;
  try {
    [garment, person] = await Promise.all([prepareImage(garmentRaw, "garment"), prepareImage(personRaw, "model")]);
  } catch (err) {
    if (err instanceof InputError) return bad(err.message);
    throw err;
  }

  const personId = uploadedPerson
    ? `upload:${createHash("sha256").update(person.bytes).digest("hex").slice(0, 8)}`
    : (presetId as string);

  const job = studio().start({
    garment: garment.bytes,
    person: person.bytes,
    personId,
    settings: settings.data,
    prep: { garment: garment.info, person: person.info },
  });
  return streamJob(job);
}
