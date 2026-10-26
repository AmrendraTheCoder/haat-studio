import { z } from "zod";

/**
 * Phase 4 — social posts. Pure data and validation, shared by the browser
 * (live preview, form errors) and the server (caption route).
 *
 * Text on a post is drawn as real text by our own layout code, never by an
 * image model: a seller's shop name and price must be spelled exactly, and
 * look the same tomorrow (the poster rule from stiche-v2).
 */

export const FORMATS = {
  post: { width: 1080, height: 1350, label: "Post", ratio: "4:5" },
  square: { width: 1080, height: 1080, label: "Square", ratio: "1:1" },
  story: { width: 1080, height: 1920, label: "Story", ratio: "9:16" },
} as const;
export type PostFormat = keyof typeof FORMATS;

export const TEMPLATES = {
  panel: { label: "Panel", hint: "Photo on top, details below" },
  badge: { label: "Offer", hint: "Adds a discount badge" },
  frame: { label: "Frame", hint: "Quiet, magazine-style border" },
} as const;
export type Template = keyof typeof TEMPLATES;

export const PALETTES = {
  paper: { label: "Haat cream", bg: "#efe7d2", panel: "#f7f1e1", ink: "#1d1914", soft: "#5c5246", accent: "#c8234a", onAccent: "#fff7ea" },
  ink: { label: "Ink", bg: "#17130f", panel: "#221d17", ink: "#f4ecd9", soft: "#b9ad97", accent: "#e9b949", onAccent: "#17130f" },
  festive: { label: "Festive", bg: "#4a0f22", panel: "#5c1529", ink: "#fbe9c6", soft: "#e2c08a", accent: "#e7b75f", onAccent: "#4a0f22" },
} as const;
export type Palette = keyof typeof PALETTES;

export const CTAS = {
  dm: "DM to order",
  whatsapp: "WhatsApp to order",
  link: "Link in bio",
} as const;
export type Cta = keyof typeof CTAS;

const optionalRupees = z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number().int("Whole rupees only").min(1).max(1_000_000).optional());

export const postSchema = z
  .object({
    shopName: z.string().trim().max(30, "Keep the shop name under 30 characters").default(""),
    handle: z
      .string()
      .trim()
      .transform((h) => h.replace(/^@+/, ""))
      .pipe(z.string().max(30, "Instagram handles are 30 characters at most").regex(/^[A-Za-z0-9._]*$/, "A handle uses only letters, numbers, . and _")),
    product: z.string().trim().min(2, "Name the product, e.g. “Cotton A-line kurti”").max(40, "Keep the product name under 40 characters"),
    price: z.coerce.number({ message: "Enter the price" }).int("Whole rupees only").min(1, "Enter the price").max(1_000_000),
    mrp: optionalRupees,
    offer: z.string().trim().max(22, "Keep the offer line under 22 characters").default(""),
    cta: z.enum(Object.keys(CTAS) as [Cta, ...Cta[]]),
  })
  .refine((p) => p.mrp === undefined || p.mrp > p.price, { path: ["mrp"], message: "MRP must be higher than the selling price (or leave it empty)" });

export type PostInput = z.input<typeof postSchema>;
export type PostData = z.output<typeof postSchema>;

/** ₹1,299 — Indian digit grouping (₹1,29,999 for lakhs). */
export const inr = (rupees: number) => `₹${rupees.toLocaleString("en-IN")}`;

/** Whole-number discount, or null when there is no MRP to compare against. */
export const discountPct = (p: Pick<PostData, "price" | "mrp">) => (p.mrp ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : null);

/* ── Captions ── */

export const TONES = { friendly: "Friendly", premium: "Premium", festive: "Festive" } as const;
export const LANGUAGES = { english: "English", hinglish: "Hinglish", hindi: "Hindi" } as const;

export const captionRequestSchema = z.object({
  post: postSchema,
  category: z.enum(["tops", "bottoms", "one-pieces"]),
  tone: z.enum(Object.keys(TONES) as [keyof typeof TONES, ...(keyof typeof TONES)[]]),
  language: z.enum(Object.keys(LANGUAGES) as [keyof typeof LANGUAGES, ...(keyof typeof LANGUAGES)[]]),
  /** A Phase 5 report to ground the caption in, when the seller has one. */
  researchId: z.string().regex(/^[0-9a-f]{12}$/).optional(),
});
export type CaptionRequest = z.infer<typeof captionRequestSchema>;

/** Instagram allows 2,200 characters and 30 hashtags. */
export const captionSchema = z.object({
  caption: z.string().trim().min(10).max(1800),
  hashtags: z.array(z.string().trim().min(2).max(40)).min(3).max(30),
});
export type Caption = z.infer<typeof captionSchema>;
