import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { DAY_MS, learnFromRefusal, parseRefusal, photosFitting, quotaStatus, type Ledger } from "@/lib/quota";
import { memoryStore } from "@/lib/tryon/store";
import { createStudio } from "@/lib/tryon/studio";
import { EngineError, type Engine } from "@/lib/tryon/types";

const T0 = Date.parse("2026-10-26T07:45:00Z");
const run = (minutesAfter: number, seconds: number) => ({ at: T0 + minutesAfter * 60_000, ms: seconds * 1000 });

describe("free GPU quota", () => {
  it("reads ZeroGPU's refusal wording", () => {
    expect(parseRefusal("You have exceeded your GPU quota (60s requested vs. 12s left). Try again in 0:13:21", T0)).toMatchObject({
      requestedSeconds: 60,
      leftSeconds: 12,
      retryAfterSeconds: 13 * 60 + 21,
    });
    expect(parseRefusal("Try again in 1 day, 2:00:00", T0).retryAfterSeconds).toBe(86400 + 7200);
    const bare = parseRefusal("You have exceeded your ZeroGPU quota", T0);
    expect(bare.leftSeconds).toBeUndefined();
    expect(bare.retryAfterSeconds).toBeUndefined();
  });

  it("needs a full 60 s free to start a photo, however short the photo", () => {
    expect(photosFitting(300, 27)).toBe(9);
    expect(photosFitting(60, 27)).toBe(1);
    expect(photosFitting(59, 27)).toBe(0);
  });

  it("counts today's photos inside the 24-hour window that started with the first one", () => {
    const ledger: Ledger = { runs: [run(0, 26), run(1, 10), run(200, 27), run(260, 26)] };
    const q = quotaStatus(ledger, T0 + 5 * 3600_000, 300);
    expect(q.usedSeconds).toBe(89);
    expect(q.leftSeconds).toBe(211);
    expect(q.photosLeft).toBe(6);
    expect(q.resetsAt).toBe(new Date(T0 + DAY_MS).toISOString());
    expect(q.source).toBe("estimate");
  });

  it("starts fresh once the window has passed", () => {
    const q = quotaStatus({ runs: [run(0, 26)] }, T0 + DAY_MS + 1, 300);
    expect(q).toMatchObject({ usedSeconds: 0, leftSeconds: 300, resetsAt: null });
  });

  it("trusts Hugging Face's own number over the estimate", () => {
    const at = T0 + 3600_000;
    const ledger: Ledger = {
      runs: [run(0, 26)],
      refusal: parseRefusal("You have exceeded your GPU quota (60s requested vs. 40s left). Try again in 2:00:00", at),
    };
    const q = quotaStatus(ledger, at + 60_000, 300);
    expect(q).toMatchObject({ leftSeconds: 40, photosLeft: 0, source: "huggingface", refused: true });
    expect(q.resetsAt).toBe(new Date(at + 2 * 3600_000).toISOString());
    // Once the refill time passes, back to the count.
    expect(quotaStatus(ledger, at + 2 * 3600_000 + 1, 300).refused).toBe(false);
  });

  it("treats a refusal without numbers as 'under 60 s', until a photo works again", () => {
    const at = T0 + 3600_000;
    const ledger: Ledger = { runs: [run(0, 26)], refusal: parseRefusal("You have exceeded your GPU quota", at) };
    expect(quotaStatus(ledger, at + 1000, 300)).toMatchObject({ photosLeft: 0, refused: true, resetsAt: new Date(T0 + DAY_MS).toISOString() });
    ledger.runs.push({ at: at + 600_000, ms: 26_000 });
    expect(quotaStatus(ledger, at + 700_000, 300)).toMatchObject({ refused: false, photosLeft: 7 });
  });
});

describe("the daily run limit", () => {
  // The message this account actually got on 2026-10-26, after its 8th photo of the day.
  const RUNS = "ZeroGPU quota exceeded: You have exceeded your ZeroGPU runs limit. Subscribe to Hugging Face PRO to get 40 min of ZeroGPU quota a day";
  const eight = () => [0, 1, 2, 3, 200, 214, 380, 383].map((m) => run(m, 22));

  it("tells a runs refusal from a time refusal", () => {
    expect(parseRefusal(RUNS, T0).kind).toBe("runs");
    expect(parseRefusal("You have exceeded your GPU quota (60s requested vs. 0s left)", T0).kind).toBe("time");
  });

  it("learns the limit from the refusal and counts photos against it", () => {
    const at = T0 + 400 * 60_000;
    const ledger = learnFromRefusal({ runs: eight() }, parseRefusal(RUNS, at));
    expect(ledger.runsLimit).toEqual({ runs: 8, learnedAt: at });
    const q = quotaStatus(ledger, at + 1000, 300);
    // Time alone would allow more; the run limit is what stops it.
    expect(q).toMatchObject({ runsUsed: 8, runsLimit: 8, photosLeft: 0, limitedBy: "runs", refused: true, resetsExact: false });
    expect(q.leftSeconds).toBe(300 - 8 * 22);

    // Next day: fresh window, learned limit kept.
    const tomorrow = quotaStatus({ ...ledger, runs: [...ledger.runs, { at: T0 + DAY_MS + 60_000, ms: 22_000 }] }, T0 + DAY_MS + 120_000, 300);
    expect(tomorrow).toMatchObject({ runsUsed: 1, runsLimit: 8, photosLeft: 7, refused: false });
  });

  it("lets .env set the limit outright", () => {
    expect(quotaStatus({ runs: eight().slice(0, 2) }, T0 + 60 * 60_000, 300, 3)).toMatchObject({ runsLimit: 3, photosLeft: 1, limitedBy: "runs" });
  });
});

describe("studio reports GPU use", () => {
  const png = () => sharp({ create: { width: 8, height: 12, channels: 3, background: "#c33" } }).png().toBuffer();
  const req = { garment: Buffer.from("g"), person: Buffer.from("p"), personId: "x", settings: { category: "tops", photoType: "flat-lay", quality: "fast", seed: 1 } } as const;
  const engineThat = (run: Engine["run"]): Engine => ({ id: "fashn-space", label: "f", configured: true, run });

  it("records GPU time for a finished photo and the message of a refusal", async () => {
    let clock = 1000;
    const used: unknown[] = [];
    const usage = { run: (e: string, at: number, ms: number) => used.push(["run", e, at, ms]), refused: (e: string, m: string) => used.push(["refused", e, m]) };
    const ok = engineThat(async (_i, onEvent) => {
      onEvent({ type: "running", etaSeconds: 20 });
      clock += 25_000;
      return png();
    });
    await createStudio({ engines: () => [ok], store: memoryStore(), timeoutMs: 1000, now: () => clock, usage }).start({ ...req, settings: { ...req.settings } }).done;
    expect(used).toEqual([["run", "fashn-space", 1000, 25_000]]);

    const refuse = engineThat(async () => {
      throw new EngineError("You have exceeded your GPU quota (60s requested vs. 12s left)", "quota");
    });
    await createStudio({ engines: () => [refuse], store: memoryStore(), timeoutMs: 1000, now: () => clock, usage }).start({ ...req, settings: { ...req.settings, seed: 2 } }).done;
    expect(used[1]).toEqual(["refused", "fashn-space", "You have exceeded your GPU quota (60s requested vs. 12s left)"]);
  });
});
