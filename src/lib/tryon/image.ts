import sharp, { type Metadata } from "sharp";
import { EXPORT_SIZES, HEIC_HINT, MAX_SIDE, MAX_UPLOAD_BYTES, MIN_SIDE, type ExportSize } from "@/lib/limits";

export { EXPORT_SIZES, type ExportSize };
import type { PrepInfo } from "./types";

const READABLE = new Set(["jpeg", "png", "webp"]);

/** The image itself is unusable. Shown to the seller verbatim, so it says what to do. */
export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

export interface Prepared {
  bytes: Buffer;
  info: PrepInfo;
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
 * - Camera metadata is dropped. Phone photos carry EXIF, often with GPS
 *   coordinates; it is never forwarded to the engine's host.
 *
 * Output is always a metadata-free JPEG. One that is already exactly that —
 * like a result's saved garment.jpg — passes through byte for byte, so
 * re-using it hits the result cache instead of re-encoding into new bytes.
 * `info` records what was changed, so the studio can show it instead of
 * claiming work it did not do.
 */
export async function prepareImage(input: Buffer, label: string): Promise<Prepared> {
  if (input.length > MAX_UPLOAD_BYTES) {
    throw new InputError(`The ${label} photo is over 15 MB. Export a smaller JPEG and try again.`);
  }

  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new InputError(`The ${label} file isn't an image we can read. Use JPEG, PNG or WebP.`);
  }
  if (meta.format === "heif") throw new InputError(`The ${label} photo is HEIC. ${HEIC_HINT}`);
  if (!meta.format || !READABLE.has(meta.format)) {
    throw new InputError(`The ${label} photo is ${meta.format ?? "an unknown format"}. Use JPEG, PNG or WebP.`);
  }

  const rotated = (meta.orientation ?? 1) > 1;
  // Orientations 5–8 swap the axes; report the size the seller actually sees.
  const swap = (meta.orientation ?? 1) >= 5;
  const width = (swap ? meta.height : meta.width) ?? 0;
  const height = (swap ? meta.width : meta.height) ?? 0;
  const flattened = Boolean(meta.hasAlpha) && !(await sharp(input).stats()).isOpaque;
  const stripped = Boolean(meta.exif || meta.xmp || meta.iptc);
  const oversize = Math.max(width, height) > MAX_SIDE;

  if (meta.format === "jpeg" && !rotated && !meta.hasAlpha && !stripped && !oversize && !meta.icc) {
    if (Math.min(width, height) < MIN_SIDE) throw tooSmall(label, width, height);
    return { bytes: input, info: { width, height, outWidth: width, outHeight: height, rotated, flattened, resized: false, stripped } };
  }

  const { data, info } = await sharp(input)
    .rotate() // no angle: orient from EXIF
    .flatten({ background: "#ffffff" })
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 92 })
    .toBuffer({ resolveWithObject: true });

  if (Math.min(info.width, info.height) < MIN_SIDE) throw tooSmall(label, info.width, info.height);
  return {
    bytes: data,
    info: { width, height, outWidth: info.width, outHeight: info.height, rotated, flattened, resized: info.width !== width, stripped },
  };
}

const tooSmall = (label: string, w: number, h: number) =>
  new InputError(`The ${label} photo is too small (${w}×${h}). Use one at least ${MIN_SIDE}px on its short side.`);

/** Engines return WebP, PNG or JPEG depending on the day; store one format. */
export async function toPng(bytes: Buffer): Promise<Buffer> {
  return sharp(bytes).png().toBuffer();
}

/**
 * Fits the result into an Instagram frame without cropping it — cropping a
 * 2:3 photo to 4:5 or 1:1 would cut off feet, hems or heads, which is the
 * product. The margins are filled with a blurred, dimmed copy of the photo.
 */
export async function exportFor(result: Buffer, size: ExportSize): Promise<Buffer> {
  const { width, height } = EXPORT_SIZES[size];
  const backdrop = await sharp(result)
    .resize(width, height, { fit: "cover" })
    .blur(40)
    .modulate({ brightness: 0.85 })
    .toBuffer();
  const photo = await sharp(result).resize(width, height, { fit: "inside" }).toBuffer();
  return sharp(backdrop)
    .composite([{ input: photo, gravity: "centre" }])
    .jpeg({ quality: 92 })
    .toBuffer();
}
