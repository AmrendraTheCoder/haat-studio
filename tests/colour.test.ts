import { describe, expect, it } from "vitest";
import { deltaE2000, hueGap, palette, paletteDistance, rgbToLab, sameFamily, type Lab } from "@/lib/tryon/colour";

describe("CIEDE2000 (Sharma, Wu & Dalal 2005 test data)", () => {
  // pairs 1, 7, 13, 17, 19, 25 and 34 of the published 34-pair table, with their expected ΔE00
  const cases: [Lab, Lab, number][] = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.5, 0], [56, -27, -3], 31.903],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[50, 2.5, 0], [50, 3.1736, 0.5854], 1.0],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
  ];
  it.each(cases)("%j vs %j = %f", (a, b, want) => {
    expect(deltaE2000(a, b)).toBeCloseTo(want, 3);
  });
  it("is symmetric and zero for equal colours", () => {
    const a: Lab = [40, 30, -20], b: Lab = [45, 20, 10];
    expect(deltaE2000(a, a)).toBe(0);
    expect(deltaE2000(a, b)).toBeCloseTo(deltaE2000(b, a), 9);
  });
  it("kL > 1 makes a lightness-only difference count less", () => {
    const a: Lab = [40, 20, 20], b: Lab = [55, 20, 20];
    expect(deltaE2000(a, b, 2)).toBeLessThan(deltaE2000(a, b) * 0.6);
  });
});

describe("palettes and colour families", () => {
  const red = rgbToLab(200, 20, 30), green = rgbToLab(20, 140, 50);
  it("keeps a red saree with a green border as two colours, not brown", () => {
    const px = [...Array(80).fill(red), ...Array(20).fill(green)];
    const p = palette(px, 3);
    expect(p).toHaveLength(2);
    expect(p[0].share).toBeCloseTo(0.8, 2);
    expect(deltaE2000(p[0].lab, red)).toBeLessThan(0.5);
    expect(deltaE2000(p[1].lab, green)).toBeLessThan(0.5);
  });
  it("weights palette distance by coverage", () => {
    const want = [{ lab: red, share: 0.8 }, { lab: green, share: 0.2 }];
    const allRed = [{ lab: red, share: 1 }];
    const both = [{ lab: red, share: 0.7 }, { lab: green, share: 0.3 }];
    expect(paletteDistance(want, both)).toBeCloseTo(0, 5);
    expect(paletteDistance(want, allRed)).toBeGreaterThan(5);
  });
  it("groups colours into families by hue, and neutrals together", () => {
    expect(sameFamily(rgbToLab(200, 20, 30), rgbToLab(160, 10, 40))).toBe(true); // red, maroon
    expect(sameFamily(rgbToLab(200, 20, 30), rgbToLab(30, 60, 200))).toBe(false); // red, blue
    expect(sameFamily(rgbToLab(240, 240, 240), rgbToLab(40, 40, 40))).toBe(true); // white, black: both neutral
    expect(sameFamily(rgbToLab(240, 240, 240), rgbToLab(200, 20, 30))).toBe(false);
    expect(hueGap(350, 10)).toBe(20);
  });
});
