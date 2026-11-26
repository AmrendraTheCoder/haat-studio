/**
 * Content engines on real marketplace listings: price band, SEO title, hashtags, positioning and
 * location ("GEO"). A port of the engines in analysis/market.py (the ones the report measured),
 * run on the compact catalogue that script writes with --app-out. Pure functions, no I/O: every
 * number comes from the catalogue and the seller's own answers, never from a language model.
 */

export const MARKET_TYPES = ["tshirt", "top", "saree", "kurta-set"] as const;
export type MarketType = (typeof MARKET_TYPES)[number];
export const MARKET_ATTRS = ["fabric", "neck", "sleeve", "pattern", "fit", "colour"] as const;
export type MarketAttr = (typeof MARKET_ATTRS)[number];

/** What the seller tells us about the product. Attribute values are the catalogue's own spellings. */
export interface ProductFacts {
  type: MarketType;
  attributes: Partial<Record<MarketAttr, string>>;
  /** Cost to make or buy one piece, in rupees; enables margins and the price floor. */
  cost?: number;
  shop?: string;
  city?: string;
}

type Tier = { listings: number; listing_share: number; demand_share: number; price_range: [number, number] | null; mean_rating: number | null };
type AttrRow = { value: string; listings: number; listing_share: number; demand_share: number; lift: number | null; median_price: number };

/** One category of data/market/catalogue.json (analysis/market.py --app-out). */
export interface CatalogueCategory {
  label: string;
  gender: string;
  after_cleaning: number;
  price: { p10: number; p25: number; median: number; p75: number; p90: number };
  mrp_median: number;
  discount: { median: number | null; share_over_50: number };
  rating: { mean: number | null; median_count: number | null; total_ratings: number };
  tiers: Record<"value" | "mid" | "premium", Tier>;
  tier_cuts: [number, number];
  demand_concentration: { top10_brand_share: number; top1_listing_share: number; hhi: number };
  correlations: { price_vs_ratings: number | null; discount_vs_ratings: number | null; price_vs_stars: number | null };
  title_length: { top_quartile_median: number | null; rest_median: number | null };
  attributes: Partial<Record<MarketAttr, AttrRow[]>>;
  seo_keywords: { term: string; score: number }[];
  /** Attribute value tables; items refer to them by index. */
  values: Record<MarketAttr, string[]>;
  /** [price, ratings, stars, discount, fabric, neck, sleeve, pattern, fit, colour] with -1 = unknown. */
  items: number[][];
}

export interface Catalogue {
  version: 1;
  generated: string;
  assumptions: Record<string, unknown>;
  attributes: MarketAttr[];
  categories: Partial<Record<MarketType, CatalogueCategory>>;
}

/** Linear-interpolated quantile, identical to q() in analysis/market.py. */
export function quantile(xs: number[], p: number): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const k = (s.length - 1) * p;
  const lo = Math.floor(k), hi = Math.ceil(k);
  return s[lo] + (s[hi] - s[lo]) * (k - lo);
}

const NOUN: Record<MarketType, string> = { tshirt: "T-shirt", top: "top", saree: "saree", "kurta-set": "kurta set" };
const LABEL: Record<string, string> = {
  "Round/crew": "Round Neck", "Collared/polo": "Polo Collar", "V-neck": "V-Neck", "Turtle/high": "High Neck", "3/4 sleeve": "3/4 Sleeve",
  "Short/half": "Half Sleeve", "Long sleeve": "Full Sleeve", Regular: "Regular Fit", Slim: "Slim Fit", Oversized: "Oversized Fit",
  "Loose/relaxed": "Relaxed Fit", "Graphic/print": "Printed", "Zari/woven": "Zari Woven",
};
export const label = (v: string) => LABEL[v] ?? v;
const ATTR_COL: Record<MarketAttr, number> = { fabric: 4, neck: 5, sleeve: 6, pattern: 7, fit: 8, colour: 9 };

export interface Pricing {
  comparables: number;
  sampleSize: number;
  comparablePrice: { p25: number; median: number; p75: number };
  band: [number, number];
  marginAtBand: [number, number] | null;
  floorFor30: number | null;
  position: "value" | "mid" | "premium";
  categoryMedianDiscount: number | null;
  warning: "thin" | "belowFloor" | null;
}

/** The facts that count for matching: the seller's attributes the catalogue knows (not colour). */
function wanted(c: CatalogueCategory, f: ProductFacts) {
  return (["fabric", "neck", "sleeve", "pattern", "fit"] as const)
    .map((k) => ({ col: ATTR_COL[k], idx: f.attributes[k] ? c.values[k].indexOf(f.attributes[k]!) : -1 }))
    .filter((w) => w.idx >= 0);
}

export function pricing(c: CatalogueCategory, f: ProductFacts): Pricing {
  const want = wanted(c, f);
  const matches = (it: number[]) => want.reduce((n, w) => n + (it[w.col] === w.idx ? 1 : 0), 0);
  const need = Math.min(2, want.length);
  let comp = c.items.filter((it) => matches(it) >= need);
  if (comp.length < 15) comp = [...c.items].sort((a, b) => matches(b) - matches(a)).slice(0, 30);
  const cp = comp.map((it) => it[0]);
  const q = (p: number) => Math.round(quantile(cp, p) ?? 0);
  const band: [number, number] = [q(0.4), q(0.6)];
  const cost = f.cost && f.cost > 0 ? f.cost : null;
  const margin = (p: number) => (cost ? Math.round((100 * (p - cost)) / p) : 0);
  const [t1, t2] = c.tier_cuts;
  const position = band[1] < t1 ? "value" : band[0] > t2 ? "premium" : "mid";
  const floor = cost ? Math.ceil((cost * 10) / 7) : null; // cost / 0.7 without the float error (700 / 0.7 = 1000.0000000000001)
  return {
    comparables: comp.length,
    sampleSize: c.items.length,
    comparablePrice: { p25: q(0.25), median: q(0.5), p75: q(0.75) },
    band,
    marginAtBand: cost ? [margin(band[0]), margin(band[1])] : null,
    floorFor30: floor,
    position,
    categoryMedianDiscount: c.discount.median,
    warning: !cost ? null : floor !== null && band[1] < floor ? "belowFloor" : margin(band[0]) < 30 ? "thin" : null,
  };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const facts = (f: ProductFacts) => (["fabric", "pattern", "neck", "sleeve", "fit"] as const).map((k) => f.attributes[k]).filter((v): v is string => Boolean(v) && v !== "Other").map(label);

export interface Seo {
  title: string;
  chars: number;
  benchmarkChars: number | null;
  /** Demand keywords of the category already in the title. */
  keywordsUsed: string[];
  /** High-demand words the title lacks; the seller adds one only if it is true of the product. */
  keywordsToConsider: string[];
  bullets: string[];
}

export function seo(c: CatalogueCategory, f: ProductFacts): Seo {
  const fx = facts(f);
  const noun = NOUN[f.type];
  const head = [f.shop?.trim(), `${c.gender}'s`, ...fx.slice(0, 2), noun.replace(/\b\w/g, (m) => m.toUpperCase())].filter(Boolean).join(" ");
  const title = [head, fx.slice(2).join(" | ")].filter(Boolean).join(" | ").replace(/\s+/g, " ");
  const lower = title.toLowerCase();
  const single = c.seo_keywords.map((k) => k.term).filter((t) => !t.includes(" "));
  return {
    title,
    chars: title.length,
    benchmarkChars: c.title_length.top_quartile_median,
    keywordsUsed: single.filter((t) => lower.includes(t)).slice(0, 8),
    keywordsToConsider: single.filter((t) => !lower.includes(t)).slice(0, 8),
    bullets: fx,
  };
}

export function hashtags(f: ProductFacts, moments: { tag: string }[] = []): string[] {
  const noun = slug(NOUN[f.type]);
  const fx = facts(f);
  const city = f.city ? slug(f.city) : "";
  const niche = fx.slice(0, 2).map((x) => `#${slug(x + noun)}`);
  const local = city ? [`#${city}`, `#${city}fashion`, `#${city}shopping`] : [];
  const all = [`#${noun}`, `#${noun}s`, "#shopsmall", "#smallbusinessindia", "#instashop", ...niche, ...local, ...moments.slice(0, 2).map((m) => `#${slug(m.tag)}`)];
  return [...new Set(all.filter((t) => t.length > 2))].slice(0, 20);
}

export interface Positioning {
  tier: Pricing["position"];
  statement: string;
  /** Attribute values with more demand than supply (lift > 1), at least 5 listings. */
  underSupplied: { attribute: MarketAttr; value: string; lift: number }[];
  /** The most-demanded value of each attribute. */
  mostDemanded: Partial<Record<MarketAttr, string>>;
}

export function positioning(c: CatalogueCategory, f: ProductFacts, p: Pricing): Positioning {
  const fx = facts(f);
  const under = (Object.entries(c.attributes) as [MarketAttr, AttrRow[]][])
    .flatMap(([k, rows]) => rows.filter((r) => r.lift && r.listings >= 5 && r.value !== "Other" && r.lift > 1).map((r) => ({ attribute: k, value: r.value, lift: r.lift! })))
    .sort((a, b) => b.lift - a.lift)
    .slice(0, 5);
  const most = Object.fromEntries((Object.entries(c.attributes) as [MarketAttr, AttrRow[]][]).filter(([, rows]) => rows.length).map(([k, rows]) => [k, rows[0].value]));
  return {
    tier: p.position,
    statement: `A ${p.position}-tier ${[...fx.slice(0, 2).map((x) => x.toLowerCase()), NOUN[f.type]].join(" ")} at ₹${p.band[0].toLocaleString("en-IN")}–₹${p.band[1].toLocaleString("en-IN")}, where comparable listings sell at a median of ₹${p.comparablePrice.median.toLocaleString("en-IN")}.`,
    underSupplied: under,
    mostDemanded: most,
  };
}

/** Facts about the whole category for the report and for grounding the AI prompt. */
export function categoryFacts(c: CatalogueCategory) {
  return {
    label: c.label,
    listings: c.after_cleaning,
    medianPrice: c.price.median,
    priceRange: [c.price.p25, c.price.p75] as [number, number],
    medianDiscount: c.discount.median,
    shareOver50: c.discount.share_over_50,
    meanStars: c.rating.mean,
    tiers: (["value", "mid", "premium"] as const).map((t) => ({ tier: t, demandShare: c.tiers[t].demand_share, listingShare: c.tiers[t].listing_share, priceRange: c.tiers[t].price_range })),
    top10BrandShare: c.demand_concentration.top10_brand_share,
    priceVsDemand: c.correlations.price_vs_ratings,
    discountVsDemand: c.correlations.discount_vs_ratings,
  };
}

export interface MarketPlan {
  type: MarketType;
  category: ReturnType<typeof categoryFacts>;
  pricing: Pricing;
  seo: Seo;
  hashtags: string[];
  positioning: Positioning;
  generated: string;
}

/** All engines for one product. `moments` are the dated festival days from research/build.ts. */
export function marketPlan(cat: Catalogue, f: ProductFacts, moments: { tag: string }[] = []): MarketPlan | null {
  const c = cat.categories[f.type];
  if (!c || c.items.length === 0) return null;
  const p = pricing(c, f);
  return { type: f.type, category: categoryFacts(c), pricing: p, seo: seo(c, f), hashtags: hashtags(f, moments), positioning: positioning(c, f, p), generated: cat.generated };
}
