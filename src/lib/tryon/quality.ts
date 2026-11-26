import sharp from "sharp";
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
  /** colour warns when the garment area is closer (CIE76 ΔE) to the old outfit than to the
   *  garment, by more than this margin, and is also more than `colourFloor` from the garment */
  colour: 0,
  colourFloor: 15,
  /** mean absolute pixel difference (0–255) in the head region: the face should stay */
  person: 45,
};

const W = 96;
const H = 128;

async function thumb(bytes: Buffer) {
  const { data, info } = await sharp(bytes).rotate().flatten({ background: "#ffffff" }).removeAlpha().resize(W, H, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/** Mean colour of a box given in fractions of the image, as CIE L*a*b*. */
function boxLab(img: { data: Buffer; w: number; h: number }, x0: number, y0: number, x1: number, y1: number): [number, number, number] {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = Math.floor(y0 * img.h); y < Math.ceil(y1 * img.h); y++) {
    for (let x = Math.floor(x0 * img.w); x < Math.ceil(x1 * img.w); x++) {
      const i = (y * img.w + x) * 3;
      r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
    }
  }
  return rgbToLab(r / n, g / n, b / n);
}

/** Median colour of the non-background pixels of a flat-lay garment photo, as Lab. */
function garmentLab(img: { data: Buffer; w: number; h: number }): [number, number, number] {
  const px: [number, number, number][] = [];
  for (let y = Math.floor(0.2 * img.h); y < Math.ceil(0.8 * img.h); y++) {
    for (let x = Math.floor(0.2 * img.w); x < Math.ceil(0.8 * img.w); x++) {
      const i = (y * img.w + x) * 3;
      const [r, g, b] = [img.data[i], img.data[i + 1], img.data[i + 2]];
      if (!(r > 235 && g > 235 && b > 235)) px.push([r, g, b]); // skip a white backdrop
    }
  }
  if (px.length === 0) return rgbToLab(255, 255, 255);
  const med = (k: 0 | 1 | 2) => px.map((p) => p[k]).sort((a, b) => a - b)[Math.floor(px.length / 2)];
  return rgbToLab(med(0), med(1), med(2));
}

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => {
    c /= 255;
    return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

const deltaE = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

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

export async function checkQuality(input: { result: Buffer; person: Buffer; garment: Buffer; settings: TryOnSettings }): Promise<OutputQuality> {
  const [res, per, gar] = await Promise.all([thumb(input.result), thumb(input.person), thumb(input.garment)]);
  const [rm, pm] = await Promise.all([sharp(input.result).metadata(), sharp(input.person).metadata()]);

  const stats = await sharp(input.result).removeAlpha().stats();
  const spread = stats.channels.slice(0, 3).reduce((s, c) => s + c.stdev, 0) / 3;
  const aspect = (m: { width?: number; height?: number }) => (m.width ?? 1) / (m.height ?? 1);
  const sizeDiff = Math.abs(aspect(rm) - aspect(pm)) / aspect(pm);
  const changed = meanAbsDiff(res, per);
  const [x0, y0, x1, y1] = REGION[input.settings.category];
  const want = input.settings.photoType === "flat-lay" ? garmentLab(gar) : boxLab(gar, x0, y0, x1, y1);
  const got = boxLab(res, x0, y0, x1, y1);
  const toGarment = deltaE(want, got);
  const toOld = deltaE(boxLab(per, x0, y0, x1, y1), got);
  // positive = the garment area still looks more like what the model wore before
  const colour = toGarment - toOld;
  const head = meanAbsDiff(res, per, 0.02, 0.2, 0.3, 0.7);

  const round = (v: number) => Math.round(v * 100) / 100;
  const checks: QualityCheck[] = [
    { id: "blank", severity: "fail", value: round(spread), limit: LIMITS.blank, ok: spread >= LIMITS.blank },
    { id: "changed", severity: "fail", value: round(changed), limit: LIMITS.changed, ok: changed >= LIMITS.changed },
    { id: "size", severity: "warn", value: round(sizeDiff), limit: LIMITS.size, ok: sizeDiff <= LIMITS.size },
    { id: "colour", severity: "warn", value: round(colour), limit: LIMITS.colour, ok: colour <= LIMITS.colour || toGarment <= LIMITS.colourFloor },
    { id: "person", severity: "warn", value: round(head), limit: LIMITS.person, ok: head <= LIMITS.person },
  ];
  return { passed: checks.every((c) => c.ok || c.severity === "warn"), checks };
}
