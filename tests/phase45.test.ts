import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { requirePasscode } from "@/lib/guard";
import { completeJSON, extractJSON, LlmUnavailable, type Candidate } from "@/lib/llm";
import { pricesMentioned, templateCaption, writeCaption } from "@/lib/posts/caption";
import { inr, postSchema, type CaptionRequest } from "@/lib/posts/spec";
import { createReport, economics, normalise, templateFindings, upcomingMoments } from "@/lib/research/build";
import { answersSchema, findingsSchema, type Answers } from "@/lib/research/schema";

const fixed = (id: string, reply: string | Error, configured = true): Candidate & { calls: number } => {
  const c = {
    id,
    configured,
    calls: 0,
    chat: async () => {
      c.calls++;
      if (reply instanceof Error) throw reply;
      return reply;
    },
  };
  return c;
};

describe("text AI choke point", () => {
  it("pulls JSON out of fences and chatter", () => {
    expect(extractJSON('Sure!\n```json\n{"a": 1}\n```\nHope that helps')).toEqual({ a: 1 });
    expect(() => extractJSON("no json here")).toThrow(/no JSON/);
  });

  it("skips unconfigured providers, falls through bad answers, and reports every failure", async () => {
    const schema = z.object({ ok: z.literal(true) });
    const unset = fixed("groq/x", "{}", false);
    const broken = fixed("gemini/y", new Error("HTTP 429"));
    const wrong = fixed("hf/z", '{"ok": false}');
    const right = fixed("hf/w", '{"ok": true}');
    const out = await completeJSON(schema, { system: "", prompt: "", maxTokens: 10, temperature: 0 }, [unset, broken, wrong, right]);
    expect(out).toEqual({ data: { ok: true }, via: "hf/w" });
    expect(unset.calls).toBe(0);

    const err = await completeJSON(schema, { system: "", prompt: "", maxTokens: 10, temperature: 0 }, [broken, wrong]).catch((e) => e);
    expect(err).toBeInstanceOf(LlmUnavailable);
    expect((err as LlmUnavailable).attempts.map((a) => a.id)).toEqual(["gemini/y", "hf/z"]);
  });
});

const answers: Answers = answersSchema.parse({
  shopName: "Kadam",
  product: "Cotton kurtis",
  category: "ethnic-women",
  city: "Jaipur",
  channels: ["instagram", "whatsapp"],
  priceMin: 499,
  priceMax: 1299,
  costPerPiece: 400,
  ages: ["18-24", "25-34"],
  gender: "women",
  goal: "festive-push",
});

describe("research (phase 5)", () => {
  it("validates the questionnaire, including price order", () => {
    const bad = answersSchema.safeParse({ ...answers, priceMin: 900, priceMax: 500 });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0].path).toEqual(["priceMax"]);
    expect(answersSchema.safeParse({ ...answers, channels: [] }).success).toBe(false);
  });

  it("does the profit maths itself and warns on thin margins", () => {
    const e = economics(answers);
    expect(e.perPiece).toEqual({ atMin: 99, atMax: 899, marginMinPct: 20, marginMaxPct: 69 });
    expect(e.warnings[0]).toMatch(/only 20%/);
    expect(economics({ ...answers, costPerPiece: 600 }).warnings[0]).toMatch(/lose money/);
    expect(economics({ ...answers, costPerPiece: undefined }).perPiece).toBeNull();
  });

  it("lists only upcoming moments inside the window, with days away", () => {
    const m = upcomingMoments(new Date("2026-10-26T10:00:00Z"));
    expect(m[0]).toMatchObject({ name: "Diwali", daysAway: 13 });
    expect(m.every((x) => x.daysAway >= 0 && x.daysAway <= 75)).toBe(true);
    expect(m.find((x) => x.name === "Valentine's Day")).toBeUndefined();
  });

  it("tidies model output: hashtags, price order, weekday order", () => {
    const f = normalise({
      ...templateFindings(answers),
      pricing: { minRupees: 1500, maxRupees: 700, reasoning: "x" },
      weekPlan: [
        { day: "Wed", format: "reel", idea: "b" },
        { day: "Mon", format: "post", idea: "a" },
        { day: "Fri", format: "story", idea: "c" },
        { day: "Tue", format: "story", idea: "d" },
        { day: "Sun", format: "post", idea: "e" },
      ],
      hashtags: { broad: ["kurti", "#Kurti Love", "kurti"], niche: [], local: ["##jaipur"] },
    });
    expect(f.pricing).toMatchObject({ minRupees: 700, maxRupees: 1500 });
    expect(f.weekPlan.map((d) => d.day)).toEqual(["Mon", "Tue", "Wed", "Fri", "Sun"]);
    expect(f.hashtags).toMatchObject({ broad: ["#kurti", "#KurtiLove"], local: ["#jaipur"] });
  });

  it("uses the AI when one answers, and a labelled template when none does", async () => {
    const good = JSON.stringify(templateFindings(answers));
    expect(findingsSchema.safeParse(JSON.parse(good)).success).toBe(true);
    const viaAi = await createReport(answers, [fixed("groq/m", good)]);
    expect(viaAi.via).toBe("groq/m");

    const none = await createReport(answers, []);
    expect(none.via).toBe("template");
    expect(none.findings.summary).toMatch(/not market research/);
    expect(none.id).toMatch(/^[0-9a-f]{12}$/);
  });
});

const request = (over: Partial<CaptionRequest["post"]> = {}): CaptionRequest => ({
  post: postSchema.parse({ shopName: "Kadam", handle: "@kadam.studio", product: "Cotton kurti", price: 1299, mrp: 1599, offer: "Diwali sale", cta: "dm", ...over }),
  category: "tops",
  tone: "festive",
  language: "english",
});

describe("posts (phase 4)", () => {
  it("validates post details the way Instagram and shoppers need", () => {
    expect(postSchema.parse({ handle: "@@kadam.studio", product: "Kurti", price: "999", cta: "dm" })).toMatchObject({ handle: "kadam.studio", price: 999 });
    expect(postSchema.safeParse({ handle: "kadam studio!", product: "Kurti", price: 999, cta: "dm" }).success).toBe(false);
    const mrp = postSchema.safeParse({ handle: "", product: "Kurti", price: 999, mrp: 999, cta: "dm" });
    expect(mrp.error?.issues[0].path).toEqual(["mrp"]);
    expect(postSchema.safeParse({ handle: "", product: "Kurti", price: "", cta: "dm" }).success).toBe(false);
  });

  it("formats rupees the Indian way", () => {
    expect(inr(1299)).toBe("₹1,299");
    expect(inr(129999)).toBe("₹1,29,999");
  });

  it("finds every rupee amount in a caption", () => {
    expect(pricesMentioned("Now ₹1,299 (MRP Rs. 1599), was INR 2,000")).toEqual([1299, 1599, 2000]);
  });

  it("rejects an AI caption that invents a price, and keeps one that doesn't", async () => {
    const liar = fixed("groq/a", JSON.stringify({ caption: "Only ₹999 today!!", hashtags: ["#a", "#b", "#c"] }));
    const honest = fixed("gemini/b", JSON.stringify({ caption: "Festive ready ✨ ₹1,299 (MRP ₹1,599)", hashtags: ["kurti", "#Kurti", "#festive", "#jaipur"] }));
    const out = await writeCaption(request(), null, [liar, honest]);
    expect(out.via).toBe("gemini/b");
    expect(out.hashtags).toEqual(["#kurti", "#festive", "#jaipur"]);
  });

  it("falls back to a template that only uses the seller's own words", async () => {
    const out = await writeCaption(request(), null, []);
    expect(out.via).toBe("template");
    expect(out.caption).toContain("₹1,299");
    expect(out.caption).toContain("MRP ₹1,599 — 19% off");
    expect(out.caption).toContain("DM us to order");
    expect(out.caption).toContain("@kadam.studio");
    expect(pricesMentioned(out.caption).every((n) => n === 1299 || n === 1599)).toBe(true);
    const hinglish = templateCaption({ ...request(), language: "hinglish", tone: "friendly" }, null);
    expect(hinglish.caption).toMatch(/Naya Cotton kurti aa gaya/);
    expect(new Set(out.hashtags.map((h) => h.toLowerCase())).size).toBe(out.hashtags.length);
  });
});

describe("passcode guard", () => {
  const original = process.env.STUDIO_PASSCODE;
  afterEach(() => {
    if (original === undefined) delete process.env.STUDIO_PASSCODE;
    else process.env.STUDIO_PASSCODE = original;
  });
  const req = (code?: string) => new Request("http://x/api", { method: "POST", headers: code ? { "x-studio-passcode": code } : {} });

  it("lets everything through when no passcode is set", () => {
    delete process.env.STUDIO_PASSCODE;
    expect(requirePasscode(req())).toBeNull();
  });

  it("blocks missing or wrong passcodes and allows the right one", async () => {
    process.env.STUDIO_PASSCODE = "diwali2026";
    expect(requirePasscode(req())?.status).toBe(401);
    expect(await requirePasscode(req("wrong"))!.json()).toMatchObject({ needsPasscode: true, error: /isn't right/ });
    expect(requirePasscode(req("diwali2026"))).toBeNull();
  });
});
