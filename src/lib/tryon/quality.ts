import sharp from "sharp";
import { type Lab, palette, paletteDistance, rgbToLab, sameFamily } from "./colour";
import type { OutputQuality, QualityCheck, TryOnSettings } from "./types";

/**
 * Output guardrails: cheap checks on every generated photo, before it is saved or shown.
 *
 * The try-on model can fail silently: a blank frame, the model photo returned unchanged,
 * an image of the wrong shape, a garment in the wrong colour, or a changed face. Two of
 * these are certain failures and stop the result ("fail"); three are heuristics and only
 * add a note the seller can act on ("warn"). Thresholds were set on the project's real
 * generations (docs/mini-project-report, section 3.x) so that none of the good results warns.
 *
 * Everything runs on small thumbnails with sharp: ~20 ms per result, no GPU.
 */

export const LIMITS = {
  /** mean per-channel standard deviation below this = one flat colour */
  blank: 6,
  /** relative aspect-ratio difference to the model photo */
  size: 0.08,
  /** mean absolute pixel difference (0–255) to the model photo below this = nothing changed */
  changed: 3,
  /** colour: palette distance (CIEDE2000, lightness weighted ½) from the garment's colours to the
   *  result's garment area. At or under 12 it is "the same shade" for a photograph: folds, shine,
   *  white balance and JPEG move a correct colour by several units. The check warns when
   *   - the area is closer to the old outfit than to the garment (the old clothes still show), or
   *   - the area is over 12 from the garment and in another colour family (wrong colour), or
   *   - the garment and the old outfit are themselves under `alike` apart: then colour cannot
   *     tell whether anything changed (a white skirt on a model in a cream dress), so the
   *     seller is asked to look. */
  colour: 12,
  alike: 8,
  /** mean absolute pixel difference (0–255) in the head region: the face should stay */
  person: 45,
};

const W = 96;
const H = 128;

async function thumb(bytes: Buffer) {
  const { data, info } = await sharp(bytes).rotate().flatten({ background: "#ffffff" }).removeAlpha().resize(W, H, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

type Img = { data: Buffer; w: number; h: number };

/** Lab pixels of a box given in fractions of the image; `skipWhite` drops a flat-lay backdrop. */
function boxPixels(img: Img, x0: number, y0: number, x1: number, y1: number, skipWhite = false): Lab[] {
  const px: Lab[] = [];
  for (let y = Math.floor(y0 * img.h); y < Math.ceil(y1 * img.h); y++) {
    for (let x = Math.floor(x0 * img.w); x < Math.ceil(x1 * img.w); x++) {
      const i = (y * img.w + x) * 3;
      const [r, g, b] = [img.data[i], img.data[i + 1], img.data[i + 2]];
      if (skipWhite && r > 235 && g > 235 && b > 235) continue;
      px.push(rgbToLab(r, g, b));
    }
  }
  return px;
}

export { rgbToLab };

function meanAbsDiff(a: { data: Buffer }, b: { data: Buffer }, y0 = 0, y1 = 1, x0 = 0, x1 = 1) {
  let s = 0, n = 0;
  for (let y = Math.floor(y0 * H); y < Math.ceil(y1 * H); y++) {
    for (let x = Math.floor(x0 * W); x < Math.ceil(x1 * W); x++) {
      for (let c = 0; c < 3; c++) {
        const i = (y * W + x) * 3 + c;
        s += Math.abs(a.data[i] - b.data[i]);
        n++;
      }
    }
  }
  return s / n;
}

/** Where the garment sits on the person, in fractions of the image (x0, y0, x1, y1). */
const REGION: Record<TryOnSettings["category"], [number, number, number, number]> = {
  tops: [0.4, 0.26, 0.6, 0.38],
  bottoms: [0.4, 0.58, 0.6, 0.72],
  "one-pieces": [0.4, 0.3, 0.6, 0.55],
};

/** Palettes of the garment, the old outfit and the result's garment area, and the distances between them. */
function measureColour(res: Img, per: Img, gar: Img, settings: TryOnSettings) {
  const [x0, y0, x1, y1] = REGION[settings.category];
  const want = palette(settings.photoType === "flat-lay" ? boxPixels(gar, 0.2, 0.2, 0.8, 0.8, true) : boxPixels(gar, x0, y0, x1, y1));
  const got = palette(boxPixels(res, x0, y0, x1, y1));
  const old = palette(boxPixels(per, x0, y0, x1, y1));
  // the result colour closest to the garment's main colour, for the colour-family check
  const main = want[0]?.lab;
  const one = (lab: Lab) => [{ lab, share: 1 }];
  const match: Lab | undefined = main && got.length ? got.reduce((a, b) => (paletteDistance(one(main), [a]) <= paletteDistance(one(main), [b]) ? a : b)).lab : undefined;
  return { want, got, old, colour: paletteDistance(want, got), toOld: paletteDistance(old, got), garmentVsOld: paletteDistance(want, old), family: main && match ? sameFamily(main, match) : true };
}

/** The colour measurement on its own, for the audit script and the report's palette figure. */
export async function colourPalettes(input: { result: Buffer; person: Buffer; garment: Buffer; settings: TryOnSettings }) {
  const [res, per, gar] = await Promise.all([thumb(input.result), thumb(input.person), thumb(input.garment)]);
  return measureColour(res, per, gar, input.settings);
}

export async function checkQuality(input: { result: Buffer; person: Buffer; garment: Buffer; settings: TryOnSettings }): Promise<OutputQuality> {
  const [res, per, gar] = await Promise.all([thumb(input.result), thumb(input.person), thumb(input.garment)]);
  const [rm, pm] = await Promise.all([sharp(input.result).metadata(), sharp(input.person).metadata()]);

  const stats = await sharp(input.result).removeAlpha().stats();
  const spread = stats.channels.slice(0, 3).reduce((s, c) => s + c.stdev, 0) / 3;
  const aspect = (m: { width?: number; height?: number }) => (m.width ?? 1) / (m.height ?? 1);
  const sizeDiff = Math.abs(aspect(rm) - aspect(pm)) / aspect(pm);
  const changed = meanAbsDiff(res, per);
  const { colour, toOld, garmentVsOld, family } = measureColour(res, per, gar, input.settings);
  const alike = garmentVsOld < LIMITS.alike;
  const colourOk = !alike && toOld >= colour && (colour <= LIMITS.colour || family);
  const head = meanAbsDiff(res, per, 0.02, 0.2, 0.3, 0.7);

  const round = (v: number) => Math.round(v * 100) / 100;
  const checks: QualityCheck[] = [
    { id: "blank", severity: "fail", value: round(spread), limit: LIMITS.blank, ok: spread >= LIMITS.blank },
    { id: "changed", severity: "fail", value: round(changed), limit: LIMITS.changed, ok: changed >= LIMITS.changed },
    { id: "size", severity: "warn", value: round(sizeDiff), limit: LIMITS.size, ok: sizeDiff <= LIMITS.size },
    { id: "colour", severity: "warn", value: round(colour), limit: LIMITS.colour, ok: colourOk, detail: { toOld: round(toOld), garmentVsOld: round(garmentVsOld) } },
    { id: "person", severity: "warn", value: round(head), limit: LIMITS.person, ok: head <= LIMITS.person },
  ];
  return { passed: checks.every((c) => c.ok || c.severity === "warn"), checks };
}
