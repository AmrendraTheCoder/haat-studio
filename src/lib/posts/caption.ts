import { completeJSON, LlmUnavailable, type Candidate } from "@/lib/llm";
import type { Report } from "@/lib/research/schema";
import { CTAS, captionSchema, discountPct, inr, type Caption, type CaptionRequest } from "./spec";

const SYSTEM = `You write Instagram captions for small Indian clothing sellers.
Answer ONLY with one JSON object: {"caption": "...", "hashtags": ["#...", ...]}.
Use the exact product name, prices and call to action you are given — never change a number or invent an offer, a material, a size, stock levels or a delivery promise.
Caption: 2-5 short lines, a hook first, emojis sparingly.
Hashtags: 8-15, mixing broad and specific. They must describe only this product, the occasion or the city given — no fabric, size, scarcity ("limited stock") or other products.`;

const CATEGORY = { tops: "top", bottoms: "bottom wear", "one-pieces": "outfit" } as const;

export function captionPrompt(r: CaptionRequest, research: Report | null): string {
  const p = r.post;
  const off = discountPct(p);
  return `Product: ${p.product} (${CATEGORY[r.category]})
Price: ${inr(p.price)}${p.mrp ? ` (MRP ${inr(p.mrp)}, ${off}% off)` : ""}
Offer line: ${p.offer || "none"}
Shop: ${p.shopName || "(not given)"}${p.handle ? ` @${p.handle}` : ""}
Call to action: ${CTAS[p.cta]}
Tone: ${r.tone}. Language: ${
    r.language === "hinglish"
      ? "Hinglish — mostly Hindi written in Roman script, with English words where natural, as Indian shoppers write on Instagram (e.g. “Naya stock aa gaya”, “abhi DM karein”, “festive look ke liye perfect”)"
      : "simple English"
  }.
${
  research
    ? `Audience (from the seller's research): ${research.findings.audience.persona}
They value: ${research.findings.audience.whatTheyValue.join(", ")}
Local hashtags for their city: ${research.findings.hashtags.local.join(" ") || "none"}`
    : ""
}`;
}

const tag = (t: string) => `#${t.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "")}`;

/** Lower-cases, de-duplicates, and caps at Instagram's 30. */
export function cleanHashtags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags.map(tag)) {
    const k = t.toLowerCase();
    if (t.length > 1 && !seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
  }
  return out.slice(0, 30);
}

/** Built from the seller's own fields only — nothing claimed that they didn't say. */
export function templateCaption(r: CaptionRequest, research: Report | null): Caption {
  const p = r.post;
  const off = discountPct(p);
  const price = `${inr(p.price)}${p.mrp ? ` (MRP ${inr(p.mrp)} — ${off}% off)` : ""}`;
  const hinglish = r.language === "hinglish";
  const opener =
    r.tone === "festive"
      ? hinglish ? `Festive season ke liye ready? ✨` : `Ready for the festive season? ✨`
      : r.tone === "premium"
        ? `${p.product}.`
        : hinglish ? `Naya ${p.product} aa gaya! 💛` : `Say hello to our ${p.product} 💛`;
  const cta = hinglish
    ? { dm: "Order ke liye DM karein 📩", whatsapp: "Order ke liye WhatsApp karein 📲", link: "Order karne ke liye link bio mein 🔗" }[p.cta]
    : { dm: "DM us to order 📩", whatsapp: "WhatsApp us to order 📲", link: "Tap the link in bio to order 🔗" }[p.cta];
  const lines = [opener, p.offer ? `${p.offer} — ${price}` : price, cta, p.handle ? `@${p.handle}` : ""].filter(Boolean);

  // The whole product name and its last word (the garment: "tee", "kurti", "saree").
  // Research tags are about the shop, so only its local and broad ones carry
  // over — its niche tags may describe a different product.
  const words = p.product.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean);
  const fromResearch = research ? [...research.findings.hashtags.local, ...research.findings.hashtags.broad] : [];
  const hashtags = cleanHashtags([words.join(""), words.at(-1) ?? "", ...fromResearch, "shopsmall", "smallbusinessindia", "instashop", "ootd"]);
  return { caption: lines.join("\n"), hashtags: hashtags.length >= 3 ? hashtags : cleanHashtags([...hashtags, "shopsmall", "instashop", "ootd"]) };
}

/** Every rupee amount written as ₹1,299 / Rs 1299 / INR 1,299. */
export function pricesMentioned(text: string): number[] {
  return [...text.matchAll(/(?:₹|\brs\.?|\binr)\s*([\d,]+)/gi)].map((m) => Number(m[1].replace(/,/g, ""))).filter((n) => n > 0);
}

export async function writeCaption(
  r: CaptionRequest,
  research: Report | null,
  candidates?: Candidate[],
): Promise<Caption & { via: string; attempts?: { id: string; error: string }[] }> {
  // The model is told not to change prices; check rather than trust. An
  // answer quoting any rupee amount the seller didn't give is rejected, and
  // the next provider (or the template) gets a turn.
  const honest = captionSchema.refine((c) => pricesMentioned(c.caption).every((n) => n === r.post.price || n === r.post.mrp), {
    message: "mentions a price the seller didn't give",
  });
  try {
    const out = await completeJSON(honest, { system: SYSTEM, prompt: captionPrompt(r, research), maxTokens: 600, temperature: 0.8 }, candidates);
    const caption = pricesMentioned(out.data.caption).includes(r.post.price) ? out.data.caption : `${out.data.caption}\n${inr(r.post.price)}`;
    return { caption, hashtags: cleanHashtags(out.data.hashtags), via: out.via };
  } catch (err) {
    if (!(err instanceof LlmUnavailable)) throw err;
    return { ...templateCaption(r, research), via: "template", attempts: err.attempts };
  }
}
