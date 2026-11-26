import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadCatalogue, marketOptions } from "@/lib/market/catalogue";
import { hashtags, marketPlan, pricing, quantile, seo, type Catalogue, type CatalogueCategory } from "@/lib/market/engines";

// A synthetic kurta-set catalogue: embroidered round-neck sets cost more than solid V-neck ones.
const values = { fabric: [], neck: ["Round/crew", "V-neck"], sleeve: ["3/4 sleeve", "Short/half"], pattern: ["Embroidered", "Solid", "Other"], fit: [], colour: ["Blue", "Pink"] };
const items: number[][] = [];
for (let i = 0; i < 60; i++) items.push([1400 + i * 5, 10 + i, 4.1, 60, -1, 0, 0, 0, -1, i % 2]); // embroidered, round, 3/4
for (let i = 0; i < 60; i++) items.push([600 + i * 5, 5 + i, 3.9, 70, -1, 1, 1, 1, -1, i % 2]); // solid, v-neck, short
const cat: CatalogueCategory = {
  label: "Kurta sets (test)", gender: "Women", after_cleaning: 120,
  price: { p10: 650, p25: 750, median: 1000, p75: 1550, p90: 1650 }, mrp_median: 3000,
  discount: { median: 65, share_over_50: 0.9 }, rating: { mean: 4, median_count: 30, total_ratings: 5000 },
  tiers: { value: { listings: 40, listing_share: 0.33, demand_share: 0.3, price_range: [600, 800], mean_rating: 3.9 }, mid: { listings: 40, listing_share: 0.33, demand_share: 0.3, price_range: [800, 1400], mean_rating: 4 }, premium: { listings: 40, listing_share: 0.34, demand_share: 0.4, price_range: [1400, 1700], mean_rating: 4.1 } },
  tier_cuts: [800, 1400],
  demand_concentration: { top10_brand_share: 0.5, top1_listing_share: 0.05, hhi: 300 },
  correlations: { price_vs_ratings: 0.1, discount_vs_ratings: -0.05, price_vs_stars: 0.2 },
  title_length: { top_quartile_median: 90, rest_median: 70 },
  attributes: { pattern: [{ value: "Embroidered", listings: 60, listing_share: 0.5, demand_share: 0.6, lift: 1.2, median_price: 1550 }, { value: "Solid", listings: 60, listing_share: 0.5, demand_share: 0.4, lift: 0.8, median_price: 750 }] },
  seo_keywords: [{ term: "embroidered", score: 50 }, { term: "dupatta", score: 40 }, { term: "kurta set", score: 30 }, { term: "trousers", score: 20 }],
  values, items,
};
const catalogue: Catalogue = { version: 1, generated: "2026-11-26", assumptions: {}, attributes: ["fabric", "neck", "sleeve", "pattern", "fit", "colour"], categories: { "kurta-set": cat } };
const facts = { type: "kurta-set" as const, attributes: { pattern: "Embroidered", neck: "Round/crew", sleeve: "3/4 sleeve" }, cost: 700, shop: "Kadam Studio", city: "Jaipur" };

describe("market engines (port of analysis/market.py)", () => {
  it("interpolates quantiles exactly like the Python q()", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([10, 20, 30], 0.25)).toBe(15);
    expect(quantile([], 0.5)).toBeNull();
  });

  it("prices against listings that share the product's attributes", () => {
    const p = pricing(cat, facts);
    expect(p.comparables).toBe(60); // only the embroidered round-neck sets
    expect(p.band[0]).toBeGreaterThanOrEqual(1400);
    expect(p.band[0]).toBeLessThan(p.band[1]);
    expect(p.floorFor30).toBe(1000); // ceil(700 / 0.7)
    expect(p.marginAtBand![0]).toBe(Math.round((100 * (p.band[0] - 700)) / p.band[0]));
    expect(p.position).toBe("premium");
    expect(p.warning).toBeNull();
  });

  it("warns when the market price cannot cover the cost", () => {
    const p = pricing(cat, { ...facts, attributes: { pattern: "Solid", neck: "V-neck" }, cost: 700 });
    expect(p.band[1]).toBeLessThan(1000);
    expect(p.warning).toBe("belowFloor");
  });

  it("builds a title only from the seller's real attributes and lists missing demand words", () => {
    const s = seo(cat, facts);
    expect(s.title).toBe("Kadam Studio Women's Embroidered Round Neck Kurta Set | 3/4 Sleeve");
    expect(s.keywordsUsed).toContain("embroidered");
    expect(s.keywordsToConsider).toEqual(["dupatta", "trousers"]);
  });

  it("makes hashtags in English letters: broad, niche, local, occasion", () => {
    const tags = hashtags(facts, [{ tag: "Christmas" }]);
    expect(tags).toEqual(expect.arrayContaining(["#kurtaset", "#embroideredkurtaset", "#jaipur", "#jaipurfashion", "#christmas"]));
    expect(tags.every((t) => /^#[a-z0-9]+$/.test(t))).toBe(true);
    expect(new Set(tags).size).toBe(tags.length);
  });

  it("returns the whole plan, or null for a type the catalogue lacks", () => {
    const plan = marketPlan(catalogue, facts);
    expect(plan?.positioning.statement).toMatch(/premium-tier embroidered round neck kurta set/);
    expect(plan?.positioning.underSupplied[0]).toMatchObject({ attribute: "pattern", value: "Embroidered" });
    expect(marketPlan(catalogue, { ...facts, type: "saree" })).toBeNull();
  });

  it("loads the catalogue file and offers its product types, without 'Other'", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mk-"));
    const file = path.join(dir, "c.json");
    writeFileSync(file, JSON.stringify(catalogue));
    const loaded = await loadCatalogue(file);
    expect(marketOptions(loaded)).toEqual([{ type: "kurta-set", label: "Kurta sets (test)", listings: 120, values: { neck: ["Round/crew", "V-neck"], sleeve: ["3/4 sleeve", "Short/half"], pattern: ["Embroidered", "Solid"], colour: ["Blue", "Pink"] } }]);
    expect(await loadCatalogue(path.join(dir, "missing.json"))).toBeNull();
  });
});

describe("market engines in research reports", () => {
  const answers = {
    shopName: "Kadam Studio", product: "embroidered kurta sets", category: "ethnic-women" as const, city: "Jaipur", channels: ["instagram" as const],
    priceMin: 1200, priceMax: 1800, costPerPiece: 700, ages: ["25-34" as const], gender: "women" as const, goal: "first-sales" as const, language: "en" as const,
    market: { type: "kurta-set" as const, pattern: "Embroidered", neck: "Round/crew", sleeve: "3/4 sleeve" },
  };

  it("accepts the product type in the answers and rejects unknown types", async () => {
    const { answersSchema } = await import("@/lib/research/schema");
    expect(answersSchema.safeParse(answers).success).toBe(true);
    expect(answersSchema.safeParse({ ...answers, market: { type: "lehenga" } }).success).toBe(false);
    expect(answersSchema.safeParse({ ...answers, market: undefined }).success).toBe(true);
  });

  it("puts the listings plan in the report and the real numbers in the AI prompt", async () => {
    const { createReport, planFor, researchPrompt, upcomingMoments } = await import("@/lib/research/build");
    const moments = upcomingMoments(new Date("2026-11-26T00:00:00Z"));
    const plan = planFor(answers, catalogue, moments)!;
    expect(plan.pricing.comparables).toBe(60);
    const prompt = researchPrompt(answers, moments, plan);
    expect(prompt).toContain(`recommended band is ₹${plan.pricing.band[0]}–₹${plan.pricing.band[1]}`);
    expect(prompt).toContain("never contradict them");
    const report = await createReport(answers, [], new Date("2026-11-26T00:00:00Z"), catalogue);
    expect(report.via).toBe("template");
    expect(report.market?.seo.title).toMatch(/^Kadam Studio Women's Embroidered/);
    expect(report.findings.hashtags.local).toEqual(expect.arrayContaining(["#jaipur"]));
    const without = await createReport({ ...answers, market: undefined }, [], new Date(), catalogue);
    expect(without.market).toBeUndefined();
  });
});
