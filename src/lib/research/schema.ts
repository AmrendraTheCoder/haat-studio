import { z } from "zod";

/**
 * Phase 5 — market research. Pure data and validation: imported by the
 * browser (form checks) and the server (the real gate).
 */

export const CATEGORIES = {
  "ethnic-women": "Women's ethnic wear (kurtis, suits, sarees)",
  "western-women": "Women's western wear (tops, dresses, jeans)",
  menswear: "Menswear (shirts, tees, kurtas)",
  kidswear: "Kidswear",
  accessories: "Accessories & jewellery",
  other: "Something else",
} as const;

export const CHANNELS = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  marketplace: "Meesho / Amazon / Flipkart",
  website: "Own website",
  offline: "Shop / exhibitions",
} as const;

export const AGES = ["13-17", "18-24", "25-34", "35-44", "45+"] as const;

export const GOALS = {
  "first-sales": "Get my first regular sales",
  "more-followers": "Grow followers and reach",
  "higher-prices": "Sell at better prices",
  "festive-push": "Sell more this festive season",
} as const;

const key = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const rupees = z.coerce.number().int("Use whole rupees").min(1, "Enter a price in rupees").max(1_000_000, "That's more than ₹10,00,000");

export const answersSchema = z
  .object({
    shopName: z.string().trim().max(40).optional().default(""),
    product: z.string().trim().min(2, "Say what you sell, e.g. “cotton kurtis”").max(80),
    category: z.enum(key(CATEGORIES)),
    city: z.string().trim().min(2, "Which city or region are you in?").max(60),
    channels: z.array(z.enum(key(CHANNELS))).min(1, "Pick at least one place you sell"),
    priceMin: rupees,
    priceMax: rupees,
    costPerPiece: z.preprocess((v) => (v === "" || v === null ? undefined : v), rupees.optional()),
    ages: z.array(z.enum(AGES)).min(1, "Pick at least one age group"),
    gender: z.enum(["women", "men", "all"]),
    goal: z.enum(key(GOALS)),
    /** The language the report is written in — the seller's app language when they asked. */
    language: z.enum(["en", "hi"]).default("en"),
  })
  .refine((a) => a.priceMax >= a.priceMin, { path: ["priceMax"], message: "The highest price can't be below the lowest" });

export type Answers = z.infer<typeof answersSchema>;

const FORMATS = ["reel", "carousel", "post", "story"] as const;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const text = (max: number) => z.string().trim().min(1).max(max);

/** What the AI must return. Kept small so even a modest free model can fill it. */
export const findingsSchema = z.object({
  summary: text(700),
  audience: z.object({
    persona: text(400),
    whereTheyAre: text(300),
    whatTheyValue: z.array(text(80)).min(2).max(5),
  }),
  trends: z.array(z.object({ name: text(80), why: text(300), action: text(300) })).min(2).max(5),
  pricing: z.object({ minRupees: z.coerce.number().int().positive(), maxRupees: z.coerce.number().int().positive(), reasoning: text(500) }),
  contentIdeas: z.array(z.object({ title: text(90), format: z.enum(FORMATS), hook: text(160) })).min(3).max(7),
  weekPlan: z.array(z.object({ day: z.enum(DAYS), format: z.enum(FORMATS), idea: text(160) })).min(5).max(7),
  hashtags: z.object({ broad: z.array(text(40)).max(8), niche: z.array(text(40)).max(8), local: z.array(text(40)).max(6) }),
  watchOuts: z.array(text(240)).max(4),
});
export type Findings = z.infer<typeof findingsSchema>;

/** Codes, not sentences, so the report page can say them in either language. */
export type EconomicsWarning = { code: "noCost" } | { code: "loss" } | { code: "thin"; pct: number };

export interface Economics {
  /** Only when the seller gave a cost per piece. */
  perPiece: { atMin: number; atMax: number; marginMinPct: number; marginMaxPct: number } | null;
  /** Plain strings come from reports saved before warnings became codes. */
  warnings: (EconomicsWarning | string)[];
}

export interface Moment {
  date: string; // YYYY-MM-DD
  name: string;
  note: string;
  /** Absent on reports saved before the Hindi version. */
  nameHi?: string;
  noteHi?: string;
  daysAway: number;
}

export interface Report {
  id: string;
  createdAt: string;
  answers: Answers;
  findings: Findings;
  /** `groq/llama-…` when an AI wrote it; "template" when no AI answered. */
  via: string;
  economics: Economics;
  moments: Moment[];
}

export const REPORT_ID = /^[0-9a-f]{12}$/;
