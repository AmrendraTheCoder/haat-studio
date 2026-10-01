import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
/** FASHN generates at 576×864; anything past this is upload time spent on pixels the model discards. */
const MAX_SIDE = 1536;
const MIN_SIDE = 256;
const READABLE = new Set(["jpeg", "png", "webp"]);

/** The image itself is unusable. Shown to the seller verbatim, so it says what to do. */
export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

/**
 * Normalise an upload before it costs any GPU time:
 *
 * - EXIF orientation is applied. A phone photo stored sideways with a rotate
 *   flag otherwise reaches the model sideways.
 * - Transparency is flattened onto white. FASHN converts to RGB with PIL,
 *   which turns a transparent background black — a cut-out product PNG
 *   would arrive as a garment floating in a black void.
 * - Large photos are bounded, so the upload to the Space stays small.
 *
 * Output is always JPEG, so identical pixels give identical bytes and the
 * result cache can key on them.
 */
export async function prepareImage(bytes: Buffer, label: string): Promise<Buffer> {
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new InputError(`The ${label} photo is over 15 MB. Export a smaller JPEG and try again.`);
  }

  let format: string | undefined;
  try {
    format = (await sharp(bytes).metadata()).format;
  } catch {
    throw new InputError(`The ${label} file isn't an image we can read. Use JPEG, PNG or WebP.`);
  }
  if (format === "heif") {
    throw new InputError(`The ${label} photo is HEIC. Export it as JPEG (on iPhone: Settings → Camera → Formats → Most Compatible).`);
  }
  if (!format || !READABLE.has(format)) {
    throw new InputError(`The ${label} photo is ${format ?? "an unknown format"}. Use JPEG, PNG or WebP.`);
  }

  const { data, info } = await sharp(bytes)
    .rotate() // no angle: orient from EXIF
    .flatten({ background: "#ffffff" })
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 92 })
    .toBuffer({ resolveWithObject: true });

  if (Math.min(info.width, info.height) < MIN_SIDE) {
    throw new InputError(
      `The ${label} photo is too small (${info.width}×${info.height}). Use one at least ${MIN_SIDE}px on its short side.`,
    );
  }
  return data;
}

/** Engines return WebP, PNG or JPEG depending on the day; store one format. */
export async function toPng(bytes: Buffer): Promise<Buffer> {
  return sharp(bytes).png().toBuffer();
}
