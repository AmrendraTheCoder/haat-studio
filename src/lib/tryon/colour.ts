/**
 * Colour measurement for the output guardrails.
 *
 * A camera records light × the cloth's reflectance as three numbers (sRGB). Equal steps in RGB
 * are not equal steps to the eye, so colours are compared in CIE L*a*b* with the CIEDE2000
 * difference (ΔE00), which corrects CIELAB's known errors in blues, in saturated colours and
 * in lightness. Lightness is the least reliable part of a photographed garment (folds, shine,
 * exposure), so the guardrail weights it down with kL = 2.
 *
 * A garment is rarely one colour: a red saree with a green border averages to brown, which is
 * neither. So each image region is summarised as a small palette (k-means in Lab, with the
 * share of pixels each colour covers) and palettes are compared colour by colour.
 */

export type Lab = [number, number, number];
export interface Swatch {
  lab: Lab;
  /** fraction of the region's pixels closest to this colour */
  share: number;
}

export function rgbToLab(r: number, g: number, b: number): Lab {
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

/** CIE76: straight-line distance in Lab. Kept for comparison with older numbers. */
export const deltaE76 = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const rad = Math.PI / 180;

/** CIEDE2000 colour difference (Sharma, Wu & Dalal, 2005). kL > 1 makes lightness count less. */
export function deltaE2000(x: Lab, y: Lab, kL = 1, kC = 1, kH = 1): number {
  const [L1, a1, b1] = x;
  const [L2, a2, b2] = y;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cm7 = ((C1 + C2) / 2) ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cm7 / (Cm7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hue = (b: number, a: number) => {
    if (a === 0 && b === 0) return 0;
    const h = Math.atan2(b, a) / rad;
    return h < 0 ? h + 360 : h;
  };
  const h1p = hue(b1, a1p);
  const h2p = hue(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);

  const Lpm = (L1 + L2) / 2;
  const Cpm = (C1p + C2p) / 2;
  let hpm = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hpm = (h1p + h2p) / 2;
    else hpm = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  }
  const T = 1 - 0.17 * Math.cos((hpm - 30) * rad) + 0.24 * Math.cos(2 * hpm * rad) + 0.32 * Math.cos((3 * hpm + 6) * rad) - 0.2 * Math.cos((4 * hpm - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hpm - 275) / 25) ** 2));
  const Cpm7 = Cpm ** 7;
  const RC = 2 * Math.sqrt(Cpm7 / (Cpm7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lpm - 50) ** 2) / Math.sqrt(20 + (Lpm - 50) ** 2);
  const SC = 1 + 0.045 * Cpm;
  const SH = 1 + 0.015 * Cpm * T;
  const RT = -Math.sin(2 * dTheta * rad) * RC;
  const l = dLp / (kL * SL);
  const c = dCp / (kC * SC);
  const h = dHp / (kH * SH);
  return Math.sqrt(l * l + c * c + h * h + RT * c * h);
}

/** Hue angle in degrees (0 = red, 90 = yellow, 180 = green, 270 = blue) and chroma. */
export function hueChroma([, a, b]: Lab): { hue: number; chroma: number } {
  const h = Math.atan2(b, a) / rad;
  return { hue: h < 0 ? h + 360 : h, chroma: Math.hypot(a, b) };
}

/** Below this chroma a colour reads as white, grey or black: hue is noise there. */
export const NEUTRAL_CHROMA = 10;

/** Smallest difference between two hue angles, 0–180°. */
export const hueGap = (h1: number, h2: number) => {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
};

/**
 * k-means in Lab (k-means++-style deterministic seeding: start from the most common
 * colour, then repeatedly add the pixel farthest from every centre). Returns at most
 * k swatches, largest share first; swatches under 5 % are merged into their nearest.
 */
export function palette(pixels: Lab[], k = 3, iterations = 12): Swatch[] {
  if (pixels.length === 0) return [];
  const centres: Lab[] = [pixels[Math.floor(pixels.length / 2)].slice() as Lab];
  while (centres.length < Math.min(k, pixels.length)) {
    let best = 0, far = -1;
    for (let i = 0; i < pixels.length; i++) {
      const d = Math.min(...centres.map((c) => deltaE76(c, pixels[i])));
      if (d > far) { far = d; best = i; }
    }
    if (far < 1) break;
    centres.push(pixels[best].slice() as Lab);
  }
  const owner = new Array<number>(pixels.length).fill(0);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < pixels.length; i++) {
      let bi = 0, bd = Infinity;
      for (let c = 0; c < centres.length; c++) {
        const d = deltaE76(centres[c], pixels[i]);
        if (d < bd) { bd = d; bi = c; }
      }
      owner[i] = bi;
    }
    const sum = centres.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < pixels.length; i++) {
      const s = sum[owner[i]];
      s[0] += pixels[i][0]; s[1] += pixels[i][1]; s[2] += pixels[i][2]; s[3]++;
    }
    sum.forEach((s, c) => { if (s[3]) centres[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  const counts = centres.map((_, c) => owner.filter((o) => o === c).length);
  let sw: Swatch[] = centres.map((lab, c) => ({ lab, share: counts[c] / pixels.length })).filter((s) => s.share > 0);
  const small = sw.filter((s) => s.share < 0.05);
  sw = sw.filter((s) => s.share >= 0.05);
  for (const s of small) {
    if (!sw.length) { sw.push(s); continue; }
    const near = sw.reduce((a, b) => (deltaE76(a.lab, s.lab) <= deltaE76(b.lab, s.lab) ? a : b));
    near.share += s.share;
  }
  return sw.sort((a, b) => b.share - a.share);
}

/**
 * How far palette `got` is from palette `want`: every colour of `want` finds its closest
 * colour in `got`, and these ΔE00 values are averaged with `want`'s coverage as weights.
 * So the garment's main colour decides most of the score, and a small border still counts.
 */
export function paletteDistance(want: Swatch[], got: Swatch[], kL = 2): number {
  if (!want.length || !got.length) return Infinity;
  let s = 0, w = 0;
  for (const a of want) {
    s += a.share * Math.min(...got.map((b) => deltaE2000(a.lab, b.lab, kL)));
    w += a.share;
  }
  return s / w;
}

/** Same colour family: both neutral, or both chromatic with hues within `maxGap` degrees. */
export function sameFamily(a: Lab, b: Lab, maxGap = 35): boolean {
  const x = hueChroma(a), y = hueChroma(b);
  const nx = x.chroma < NEUTRAL_CHROMA, ny = y.chroma < NEUTRAL_CHROMA;
  if (nx || ny) return nx === ny || Math.abs(x.chroma - y.chroma) < 8;
  return hueGap(x.hue, y.hue) <= maxGap;
}
