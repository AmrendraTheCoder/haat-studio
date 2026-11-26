import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { checkQuality, rgbToLab } from "@/lib/tryon/quality";
import type { TryOnSettings } from "@/lib/tryon/types";

const settings: TryOnSettings = { category: "tops", photoType: "flat-lay", quality: "balanced", seed: 42 };
const solid = (w: number, h: number, c: { r: number; g: number; b: number }) => sharp({ create: { width: w, height: h, channels: 3, background: c } }).jpeg().toBuffer();
/** A person-like photo: grey background, a skin-coloured head, a torso in `shirt`. */
async function person(shirt: { r: number; g: number; b: number }, w = 300, h = 400) {
  const head = await solid(Math.round(w * 0.2), Math.round(h * 0.15), { r: 220, g: 180, b: 150 });
  const torso = await solid(Math.round(w * 0.4), Math.round(h * 0.35), shirt);
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 120, g: 130, b: 140 } } })
    .composite([{ input: head, left: Math.round(w * 0.4), top: Math.round(h * 0.03) }, { input: torso, left: Math.round(w * 0.3), top: Math.round(h * 0.22) }])
    .jpeg()
    .toBuffer();
}
const garment = async (c: { r: number; g: number; b: number }) =>
  sharp({ create: { width: 300, height: 300, channels: 3, background: { r: 255, g: 255, b: 255 } } }).composite([{ input: await solid(180, 180, c), left: 60, top: 60 }]).jpeg().toBuffer();

const RED = { r: 200, g: 30, b: 40 };
const BLUE = { r: 30, g: 60, b: 200 };
const byId = (q: Awaited<ReturnType<typeof checkQuality>>, id: string) => q.checks.find((c) => c.id === id)!;

describe("output guardrails (quality.ts)", () => {
  it("passes a plausible try-on: shirt changed to the garment's colour, face kept", async () => {
    const q = await checkQuality({ result: await person(RED), person: await person(BLUE), garment: await garment(RED), settings });
    expect(q.passed).toBe(true);
    expect(q.checks.every((c) => c.ok)).toBe(true);
  });

  it("fails a blank result", async () => {
    const q = await checkQuality({ result: await solid(300, 400, { r: 0, g: 0, b: 0 }), person: await person(BLUE), garment: await garment(RED), settings });
    expect(q.passed).toBe(false);
    expect(byId(q, "blank").ok).toBe(false);
  });

  it("fails a result identical to the model photo (nothing was tried on)", async () => {
    const p = await person(BLUE);
    const q = await checkQuality({ result: p, person: p, garment: await garment(RED), settings });
    expect(q.passed).toBe(false);
    expect(byId(q, "changed").ok).toBe(false);
  });

  it("warns, without failing, when the garment area still looks like the old outfit", async () => {
    const old = { r: 40, g: 70, b: 190 };
    const q = await checkQuality({ result: await person({ r: 45, g: 75, b: 185 }), person: await person(old), garment: await garment(RED), settings });
    expect(byId(q, "colour").ok).toBe(false);
    expect(byId(q, "colour").severity).toBe("warn");
  });

  it("warns when the garment and the old outfit are the same colour (colour cannot confirm the change)", async () => {
    const cream = { r: 235, g: 225, b: 205 };
    const q = await checkQuality({ result: await person({ r: 240, g: 236, b: 225 }), person: await person(cream), garment: await garment({ r: 245, g: 242, b: 232 }), settings });
    expect(byId(q, "colour").ok).toBe(false);
    expect(byId(q, "colour").detail?.garmentVsOld).toBeLessThan(8);
  });

  it("does not warn on a correct colour with a different lightness (shade or exposure)", async () => {
    const q = await checkQuality({ result: await person({ r: 160, g: 25, b: 35 }), person: await person(BLUE), garment: await garment(RED), settings });
    expect(byId(q, "colour").ok).toBe(true);
    expect(byId(q, "colour").value).toBeLessThanOrEqual(12);
  });

  it("warns when the aspect ratio does not match the model photo", async () => {
    const q = await checkQuality({ result: await person(RED, 400, 300), person: await person(BLUE), garment: await garment(RED), settings });
    expect(byId(q, "size").ok).toBe(false);
  });

  it("converts sRGB to CIE Lab (white, black, red)", () => {
    expect(rgbToLab(255, 255, 255)[0]).toBeCloseTo(100, 0);
    expect(rgbToLab(0, 0, 0)[0]).toBeCloseTo(0, 0);
    const [l, a] = rgbToLab(255, 0, 0);
    expect(l).toBeCloseTo(53.2, 0);
    expect(a).toBeGreaterThan(70);
  });
});
