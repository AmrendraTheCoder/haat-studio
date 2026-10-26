import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { completeJSON, LlmUnavailable, type Candidate } from "@/lib/llm";
import { CATEGORIES, CHANNELS, GOALS, REPORT_ID, findingsSchema, type Answers, type Economics, type Findings, type Moment, type Report } from "./schema";

/* ── Deterministic parts: maths and dates are never left to a language model ── */

export function economics(a: Answers): Economics {
  const warnings: string[] = [];
  if (a.costPerPiece === undefined) {
    return { perPiece: null, warnings: ["Add your cost per piece to see profit and margin."] };
  }
  const at = (price: number) => price - a.costPerPiece!;
  const pct = (price: number) => Math.round(((price - a.costPerPiece!) / price) * 100);
  const perPiece = { atMin: at(a.priceMin), atMax: at(a.priceMax), marginMinPct: pct(a.priceMin), marginMaxPct: pct(a.priceMax) };
  if (perPiece.atMin <= 0) warnings.push("At your lowest price you lose money on every piece.");
  else if (perPiece.marginMinPct < 30) {
    warnings.push(`At your lowest price you keep only ${perPiece.marginMinPct}% — packaging, shipping and payment fees still have to come out of that.`);
  }
  return { perPiece, warnings };
}

/**
 * Selling moments with dates we can state with confidence: fixed-date days,
 * plus Diwali 2026. Lunar festivals move every year, so they're left to the
 * AI's notes rather than printed as dates we haven't checked.
 */
const MOMENTS: { date: string; name: string; note: string }[] = [
  { date: "2026-11-08", name: "Diwali", note: "Biggest gifting and new-clothes moment of the year. Post festive looks 2–3 weeks before." },
  { date: "2026-11-14", name: "Children's Day", note: "Good hook for kidswear and family posts." },
  { date: "2026-11-27", name: "Black Friday", note: "Many Indian shoppers now expect online deals this weekend." },
  { date: "2026-12-25", name: "Christmas", note: "Party wear and gifting." },
  { date: "2026-12-31", name: "New Year's Eve", note: "Party and going-out outfits." },
  { date: "2027-01-13", name: "Lohri", note: "Festive wear in Punjab and the north." },
  { date: "2027-01-14", name: "Makar Sankranti / Pongal (around)", note: "Regional festive wear; exact day varies by region." },
  { date: "2027-01-26", name: "Republic Day sales", note: "Big marketplace sale weekend." },
  { date: "2027-02-14", name: "Valentine's Day", note: "Date-night outfits and gifting." },
  { date: "2027-03-08", name: "Women's Day", note: "Celebrate women makers and customers." },
];

export function upcomingMoments(today: Date, withinDays = 75): Moment[] {
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return MOMENTS.map((m) => ({ ...m, daysAway: Math.round((Date.parse(`${m.date}T00:00:00Z`) - start) / 86_400_000) })).filter(
    (m) => m.daysAway >= 0 && m.daysAway <= withinDays,
  );
}

/* ── The AI part ── */

const SYSTEM = `You are a practical marketing advisor for small Indian businesses that sell on Instagram.
Answer ONLY with one JSON object matching the requested shape. No markdown, no commentary.
Be specific to the seller's product, city, prices and audience. Prices are whole Indian rupees.
You have no live internet access: describe tendencies you are confident about, never invent statistics, follower counts, brand names or exact figures.`;

const SHAPE = `{
  "summary": "3-4 sentences: the opportunity and the single most important next step",
  "audience": { "persona": "who buys, in one short paragraph", "whereTheyAre": "where/when they discover products", "whatTheyValue": ["2-5 short phrases"] },
  "trends": [ { "name": "short", "why": "why it matters for this seller", "action": "one concrete thing to do this week" } ],  // 2-5
  "pricing": { "minRupees": 0, "maxRupees": 0, "reasoning": "how this range fits the audience and the seller's current range" },
  "contentIdeas": [ { "title": "short", "format": "reel|carousel|post|story", "hook": "first line or first 2 seconds" } ],  // 3-7
  "weekPlan": [ { "day": "Mon|Tue|Wed|Thu|Fri|Sat|Sun", "format": "reel|carousel|post|story", "idea": "what to post" } ],  // 7, one per day
  "hashtags": { "broad": ["#..."], "niche": ["#..."], "local": ["#..."] },
  "watchOuts": ["0-4 risks or mistakes to avoid"]
}`;

export function researchPrompt(a: Answers, moments: Moment[]): string {
  return `Seller:
- Shop: ${a.shopName || "(unnamed)"}
- Sells: ${a.product} — category: ${CATEGORIES[a.category]}
- Based in: ${a.city}
- Sells through: ${a.channels.map((c) => CHANNELS[c]).join(", ")}
- Current price range: ₹${a.priceMin}–₹${a.priceMax}${a.costPerPiece ? `; costs ₹${a.costPerPiece} per piece to make or buy` : ""}
- Buyers: ${a.gender === "all" ? "everyone" : a.gender}, aged ${a.ages.join(", ")}
- Main goal: ${GOALS[a.goal]}
- Today: ${new Date().toISOString().slice(0, 10)}. Upcoming selling moments: ${moments.map((m) => `${m.name} (${m.date})`).join(", ") || "none in the next few weeks"}

Return this JSON shape:
${SHAPE}`;
}

/** Tidies what a model returned: hashtags get their #, prices come in order, the week starts on Monday. */
export function normalise(f: Findings): Findings {
  const tag = (t: string) => `#${t.replace(/^#+/, "").replace(/\s+/g, "")}`.slice(0, 40);
  const uniq = (xs: string[]) => [...new Set(xs.map(tag))].filter((t) => t.length > 1);
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const [lo, hi] = [f.pricing.minRupees, f.pricing.maxRupees].sort((x, y) => x - y);
  return {
    ...f,
    pricing: { ...f.pricing, minRupees: lo, maxRupees: hi },
    weekPlan: [...f.weekPlan].sort((x, y) => order.indexOf(x.day) - order.indexOf(y.day)),
    hashtags: { broad: uniq(f.hashtags.broad), niche: uniq(f.hashtags.niche), local: uniq(f.hashtags.local) },
  };
}

/**
 * Without any AI, the seller still gets a usable starter plan built from
 * their own answers — clearly labelled as a template, with no claims about
 * the market that nobody checked.
 */
export function templateFindings(a: Answers): Findings {
  const who = `${a.gender === "all" ? "Shoppers" : a.gender === "women" ? "Women" : "Men"} aged ${a.ages.join(" and ")}`;
  const words = a.product.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter((w) => w.length > 2);
  const city = a.city.toLowerCase().replace(/[^a-z]/g, "");
  return {
    summary: `This is a starter plan built from your answers, not market research — no AI is connected yet. It gives you a week of posts for your ${a.product} and the basics to check. Connect a free AI key for research tailored to ${a.city} and your buyers.`,
    audience: {
      persona: `${who} who buy ${a.product} through ${a.channels.map((c) => CHANNELS[c]).join(" and ")}.`,
      whereTheyAre: "Instagram Reels, Stories and saved posts; WhatsApp forwards from friends.",
      whatTheyValue: ["Clear photos of the real product", "Honest prices up front", "Quick replies to DMs"],
    },
    trends: [
      { name: "Show it worn", why: "Shoppers decide faster when they see the fit on a person.", action: "Make an on-model photo of your best-seller in Haat Studio and post it." },
      { name: "Price in the post", why: "“DM for price” loses buyers who don't want to ask.", action: "Put the price on your next three posts." },
    ],
    pricing: { minRupees: a.priceMin, maxRupees: a.priceMax, reasoning: "Your current range. Research to check it against your market needs the AI connected." },
    contentIdeas: [
      { title: "Fabric close-up", format: "reel", hook: "Look how this moves 👀" },
      { title: "One piece, three looks", format: "carousel", hook: `3 ways to wear our ${a.product}` },
      { title: "Packing an order", format: "reel", hook: "Packing your order with love 📦" },
      { title: "Customer photo or review", format: "post", hook: "This made our day 💛" },
      { title: "Price reveal", format: "story", hook: "Guess the price? 🤔" },
    ],
    weekPlan: [
      { day: "Mon", format: "post", idea: `On-model photo of your best ${a.product}, price in the caption` },
      { day: "Tue", format: "story", idea: "Poll: which colour should we restock?" },
      { day: "Wed", format: "reel", idea: "Fabric close-up with trending audio" },
      { day: "Thu", format: "carousel", idea: "One piece, three ways to style it" },
      { day: "Fri", format: "story", idea: "Behind the scenes: packing orders" },
      { day: "Sat", format: "post", idea: "Customer review or photo" },
      { day: "Sun", format: "story", idea: "This week's best-sellers with prices" },
    ],
    hashtags: {
      broad: ["#shopsmall", "#instashop", "#ootd"],
      niche: words.slice(0, 4).map((w) => `#${w}`),
      local: city ? [`#${city}`, `#${city}fashion`] : [],
    },
    watchOuts: ["Generated photos must match the real product — check colour and print before posting."],
  };
}

/* ── Storage: one JSON file per report ── */

const dir = () => path.resolve(process.cwd(), env().DATA_DIR, "research");

export async function saveReport(r: Report) {
  await mkdir(dir(), { recursive: true });
  const file = path.join(dir(), `${r.id}.json`);
  await writeFile(`${file}.tmp`, JSON.stringify(r, null, 2));
  await rename(`${file}.tmp`, file);
}

export async function readReport(id: string): Promise<Report | null> {
  if (!REPORT_ID.test(id)) return null;
  try {
    return JSON.parse(await readFile(path.join(dir(), `${id}.json`), "utf8")) as Report;
  } catch {
    return null;
  }
}

export async function createReport(a: Answers, candidates?: Candidate[], now = new Date()): Promise<Report & { attempts?: { id: string; error: string }[] }> {
  const moments = upcomingMoments(now);
  let findings: Findings;
  let via = "template";
  let attempts: { id: string; error: string }[] | undefined;
  try {
    const out = await completeJSON(findingsSchema, { system: SYSTEM, prompt: researchPrompt(a, moments), maxTokens: 2200, temperature: 0.5 }, candidates);
    findings = normalise(out.data);
    via = out.via;
  } catch (err) {
    if (!(err instanceof LlmUnavailable)) throw err;
    attempts = err.attempts;
    findings = templateFindings(a);
  }
  const report: Report = {
    id: randomBytes(6).toString("hex"),
    createdAt: now.toISOString(),
    answers: a,
    findings,
    via,
    economics: economics(a),
    moments,
  };
  return { ...report, attempts };
}

