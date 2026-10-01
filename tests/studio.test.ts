import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { cacheKey, memoryStore } from "@/lib/tryon/store";
import { createStudio, explain, type TryOnRequest } from "@/lib/tryon/studio";
import { EngineError, type Engine, type EngineEvent, type StreamEvent, type TryOnSettings } from "@/lib/tryon/types";

let png: Buffer;
beforeAll(async () => {
  png = await sharp({ create: { width: 8, height: 12, channels: 3, background: "#c33" } }).png().toBuffer();
});

const settings: TryOnSettings = { category: "tops", photoType: "flat-lay", quality: "fast", seed: 42 };
const request = (overrides: Partial<TryOnRequest> = {}): TryOnRequest => ({
  garment: Buffer.from("garment"),
  person: Buffer.from("person"),
  personId: "standing-men",
  settings,
  ...overrides,
});

/** An engine whose behaviour is a function; counts its calls. */
function engine(
  id: string,
  behaviour: (onEvent: (e: EngineEvent) => void, signal: AbortSignal) => Promise<Buffer>,
  configured = true,
): Engine & { calls: number } {
  const e = {
    id,
    label: id,
    configured,
    missing: configured ? undefined : `${id} has no key`,
    calls: 0,
    run(_input: unknown, onEvent: (e: EngineEvent) => void, signal: AbortSignal) {
      e.calls++;
      return behaviour(onEvent, signal);
    },
  };
  return e;
}

const succeed = (onEvent: (e: EngineEvent) => void) => {
  onEvent({ type: "queued", position: 0, etaSeconds: 20 });
  onEvent({ type: "running", etaSeconds: 20 });
  return Promise.resolve(png);
};

const collect = (studio: ReturnType<typeof createStudio>, req: TryOnRequest) => {
  const job = studio.start(req);
  const events: StreamEvent[] = [];
  job.subscribe((e) => events.push(e));
  return { job, events };
};

describe("studio", () => {
  it("streams progress, saves the result, and serves the repeat from cache", async () => {
    const fashn = engine("fashn", succeed);
    const studio = createStudio({ engines: () => [fashn], store: memoryStore(), timeoutMs: 1000 });

    const first = collect(studio, request());
    const end = await first.job.done;
    expect(first.events.map((e) => e.type)).toEqual(["accepted", "queued", "running", "done"]);
    expect(end).toMatchObject({ type: "done", cached: false, result: { engine: "fashn", personId: "standing-men" } });

    const again = await studio.start(request()).done;
    expect(again).toMatchObject({ type: "done", cached: true });
    expect(fashn.calls).toBe(1);
  });

  it("treats a new seed as a new request", async () => {
    const fashn = engine("fashn", succeed);
    const studio = createStudio({ engines: () => [fashn], store: memoryStore(), timeoutMs: 1000 });
    await studio.start(request()).done;
    await studio.start(request({ settings: { ...settings, seed: 7 } })).done;
    expect(fashn.calls).toBe(2);
  });

  it("skips unconfigured engines, falls through failures, and keeps every attempt", async () => {
    const unset = engine("unset", succeed, false);
    const busy = engine("busy", () => Promise.reject(new EngineError("quota gone", "quota", 60)));
    const backup = engine("backup", succeed);
    const studio = createStudio({ engines: () => [unset, busy, backup], store: memoryStore(), timeoutMs: 1000 });

    const end = await studio.start(request()).done;
    expect(end).toMatchObject({ type: "done", result: { engine: "backup" } });
    expect(unset.calls).toBe(0);
    expect(busy.calls).toBe(1);
  });

  it("reports all attempts when everything fails", async () => {
    const studio = createStudio({
      engines: () => [
        engine("a", () => Promise.reject(new EngineError("Space is sleeping", "unavailable"))),
        engine("b", () => Promise.reject(new Error("socket hang up"))),
      ],
      store: memoryStore(),
      timeoutMs: 1000,
    });
    const end = await studio.start(request()).done;
    expect(end.type).toBe("error");
    if (end.type !== "error") return;
    expect(end.attempts.map((a) => [a.engine, a.kind])).toEqual([
      ["a", "unavailable"],
      ["b", "unknown"],
    ]);
    expect(end.message).toContain("a: Space is sleeping");
    expect(end.message).toContain("b: socket hang up");
  });

  it("stops at an input error instead of spending another engine's quota on the same bad photo", async () => {
    const strict = engine("strict", () => Promise.reject(new EngineError("Please upload a person image", "input")));
    const next = engine("next", succeed);
    const studio = createStudio({ engines: () => [strict, next], store: memoryStore(), timeoutMs: 1000 });
    const end = await studio.start(request()).done;
    expect(end).toMatchObject({ type: "error", message: "Please upload a person image" });
    expect(next.calls).toBe(0);
  });

  it("gives one engine call to identical requests made at the same time", async () => {
    let finish!: (b: Buffer) => void;
    const slow = engine("slow", () => new Promise<Buffer>((resolve) => (finish = resolve)));
    const studio = createStudio({ engines: () => [slow], store: memoryStore(), timeoutMs: 1000 });

    const a = studio.start(request());
    const b = studio.start(request());
    expect(b).toBe(a);
    await new Promise((r) => setTimeout(r, 10));
    finish(png);
    await Promise.all([a.done, b.done]);
    expect(slow.calls).toBe(1);
  });

  it("runs different requests one at a time, telling the later one it is waiting", async () => {
    let active = 0;
    let peak = 0;
    const counted = engine("counted", async () => {
      peak = Math.max(peak, ++active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
      return png;
    });
    const studio = createStudio({ engines: () => [counted], store: memoryStore(), timeoutMs: 1000 });

    const first = collect(studio, request());
    const second = collect(studio, request({ garment: Buffer.from("another garment") }));
    await Promise.all([first.job.done, second.job.done]);
    expect(peak).toBe(1);
    expect(second.events.map((e) => e.type)).toContain("waiting");
    expect(first.events.map((e) => e.type)).not.toContain("waiting");
  });

  it("turns a stalled engine into a timeout", async () => {
    const stuck = engine(
      "stuck",
      (_onEvent, signal) => new Promise<Buffer>((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason))),
    );
    const studio = createStudio({ engines: () => [stuck], store: memoryStore(), timeoutMs: 30 });
    const end = await studio.start(request()).done;
    expect(end).toMatchObject({ type: "error", attempts: [{ engine: "stuck", kind: "timeout" }] });
  });

  it("rejects an engine that returns something that isn't an image", async () => {
    const studio = createStudio({
      engines: () => [engine("garbage", () => Promise.resolve(Buffer.from("<html>502</html>")))],
      store: memoryStore(),
      timeoutMs: 1000,
    });
    const end = await studio.start(request()).done;
    expect(end).toMatchObject({ type: "error", attempts: [{ kind: "unknown" }] });
  });
});

describe("explain", () => {
  it("tells the seller how to switch generation on when nothing is configured", () => {
    expect(explain([{ engine: "fashn-space", kind: "skipped", message: "HF_TOKEN is not set" }])).toMatch(/HF_TOKEN/);
  });

  it("names the refill time when the quota is spent", () => {
    expect(explain([{ engine: "fashn-space", kind: "quota", message: "…", retryAfterSeconds: 801 }])).toMatch(
      /used up\. It refills in about 14 min/,
    );
  });
});

describe("cacheKey", () => {
  it("is stable for the same bytes and settings and changes with any of them", () => {
    const g = Buffer.from("g");
    const p = Buffer.from("p");
    const base = cacheKey(g, p, settings);
    expect(cacheKey(Buffer.from("g"), Buffer.from("p"), { ...settings })).toBe(base);
    expect(cacheKey(g, p, { ...settings, seed: 43 })).not.toBe(base);
    expect(cacheKey(g, p, { ...settings, quality: "best" })).not.toBe(base);
    expect(cacheKey(g, Buffer.from("other person"), settings)).not.toBe(base);
    expect(base).toMatch(/^[0-9a-f]{32}$/);
  });
});
