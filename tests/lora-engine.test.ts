import { EventEmitter } from "node:events";
import { writeFileSync } from "node:fs";
import type { ChildProcess } from "node:child_process";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { adapterName, fashnLoraSpace, fashnSpace } from "@/lib/tryon/fashn-space";
import { classifyPython, localLora } from "@/lib/tryon/local-lora";
import { cacheKey, memoryStore } from "@/lib/tryon/store";
import { createStudio, enginesFor, keySpace, type TryOnRequest } from "@/lib/tryon/studio";
import type { Engine, EngineEvent, StreamEvent, TryOnSettings } from "@/lib/tryon/types";

let png: Buffer;
beforeAll(async () => {
  png = await sharp({ create: { width: 8, height: 12, channels: 3, background: "#2a6" } }).png().toBuffer();
});

const settings: TryOnSettings = { category: "tops", photoType: "flat-lay", quality: "fast", seed: 42 };
const request = (o: Partial<TryOnRequest> = {}): TryOnRequest => ({ garment: Buffer.from("g"), person: Buffer.from("p"), personId: "standing-men", settings, ...o });

function fake(id: string, extra: Partial<Engine> = {}): Engine & { calls: number } {
  const e = {
    id, label: id, configured: true, calls: 0, ...extra,
    run(_i: unknown, onEvent: (ev: EngineEvent) => void) {
      e.calls++;
      onEvent({ type: "running", etaSeconds: 1 });
      return Promise.resolve(png);
    },
  };
  return e;
}

describe("model choice in the studio (base vs LoRA-tuned)", () => {
  const base = () => fake("fashn-space", { variant: "base" });
  const tuned = () => fake("local-lora", { variant: "tuned", adapter: "laptop-v1", local: true });

  it("keeps the original cache keys for base requests", () => {
    expect(keySpace([base(), tuned()], "base")).toBe("");
    expect(keySpace([fake("echo")], "base")).toBe("test:echo");
  });

  it("gives tuned results their own key space, per adapter", () => {
    expect(keySpace([base(), tuned()], "tuned")).toBe("tuned:laptop-v1");
    const k1 = cacheKey(Buffer.from("g"), Buffer.from("p"), settings, keySpace([base(), tuned()], "base"));
    const k2 = cacheKey(Buffer.from("g"), Buffer.from("p"), settings, keySpace([base(), tuned()], "tuned"));
    expect(k1).not.toBe(k2);
  });

  it("only tries engines of the chosen variant (test engines serve both)", () => {
    const all = [base(), tuned(), fake("echo")];
    expect(enginesFor(all, "base").map((e) => e.id)).toEqual(["fashn-space", "echo"]);
    expect(enginesFor(all, "tuned").map((e) => e.id)).toEqual(["local-lora", "echo"]);
    expect(enginesFor([fake("legacy")], "base").map((e) => e.id)).toEqual(["legacy"]); // no variant = base
  });

  it("runs the tuned engine, records the model on the result, and spends no shared quota locally", async () => {
    const b = base(), t = tuned();
    const spent: string[] = [];
    const studio = createStudio({ engines: () => [b, t], store: memoryStore(), timeoutMs: 1000, usage: { run: (id) => spent.push(id), refused: () => {} } });
    const end = await studio.start(request({ model: "tuned" })).done;
    expect(end.type).toBe("done");
    expect(t.calls).toBe(1);
    expect(b.calls).toBe(0);
    if (end.type === "done") expect(end.result.model).toEqual({ variant: "tuned", adapter: "laptop-v1" });
    expect(spent).toEqual([]);
  });

  it("never serves a base result for a tuned request", async () => {
    const b = base(), t = tuned();
    const studio = createStudio({ engines: () => [b, t], store: memoryStore(), timeoutMs: 1000 });
    await studio.start(request()).done;
    const second = await studio.start(request({ model: "tuned" })).done;
    expect(second.type === "done" && second.cached).toBe(false);
    expect(t.calls).toBe(1);
  });

  it("says so plainly when no tuned engine is set up", async () => {
    const studio = createStudio({ engines: () => [base()], store: memoryStore(), timeoutMs: 1000 });
    const end = await studio.start(request({ model: "tuned" })).done;
    expect(end.type).toBe("error");
    if (end.type === "error") expect(end.message).toMatch(/tuned model/);
  });

  it("uses the engine's own time limit instead of the studio's", async () => {
    const slow: Engine = {
      id: "local-lora", label: "slow", configured: true, variant: "tuned", adapter: "a", local: true, timeoutMs: 400,
      run: (_i, _o, signal) => new Promise((resolve, reject) => {
        const t = setTimeout(() => resolve(png), 150);
        signal.addEventListener("abort", () => (clearTimeout(t), reject(signal.reason)));
      }),
    };
    const studio = createStudio({ engines: () => [slow], store: memoryStore(), timeoutMs: 50 });
    const events: StreamEvent[] = [];
    const job = studio.start(request({ model: "tuned" }));
    job.subscribe((e) => events.push(e));
    expect((await job.done).type).toBe("done");
  });
});

describe("LoRA engines", () => {
  it("names the adapter after its training run", () => {
    expect(adapterName("ml/runs/laptop-v1/lora-best.safetensors")).toBe("laptop-v1");
    expect(adapterName("C:\\runs\\indian-v2\\lora.safetensors")).toBe("indian-v2");
  });

  it("the hosted tuned engine needs LORA_SPACE and is a tuned variant", () => {
    const off = fashnLoraSpace(undefined, "hf_x", "laptop-v1");
    expect(off.configured).toBe(false);
    expect(off.missing).toMatch(/LORA_SPACE/);
    const on = fashnLoraSpace("me/haat-lora", "hf_x", "laptop-v1");
    expect(on).toMatchObject({ id: "fashn-lora-space", variant: "tuned", adapter: "laptop-v1", configured: true });
    expect(fashnSpace("hf_x").variant).toBe("base");
  });

  it("local-lora reports what is missing instead of failing later", () => {
    const e = localLora({ root: "/x", python: "py", adapter: "a.safetensors", exists: (p) => !p.endsWith("a.safetensors") });
    expect(e.configured).toBe(false);
    expect(e.missing).toMatch(/adapter is missing/);
    expect(localLora({ root: "/x", python: "py", adapter: "a", exists: () => false }).missing).toMatch(/Python environment/);
  });

  it("local-lora runs ml/scripts/sample.py with the adapter and returns its image", async () => {
    let seen: { cmd: string; args: string[]; cwd: string } | null = null;
    const spawn = (cmd: string, args: string[], opts: { cwd: string }) => {
      seen = { cmd, args, cwd: opts.cwd };
      const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter() as never, stderr: new EventEmitter(), kill: () => true }) as unknown as ChildProcess;
      (child.stdout as unknown as { resume: () => void }).resume = () => {};
      setTimeout(() => {
        writeFileSync(args[args.indexOf("--out") + 1], png);
        child.emit("close", 0);
      }, 5);
      return child;
    };
    const e = localLora({ root: "/proj", python: "py", adapter: "ml/runs/laptop-v1/lora-best.safetensors", exists: () => true, spawn });
    expect(e).toMatchObject({ configured: true, variant: "tuned", local: true, adapter: "laptop-v1" });
    const events: EngineEvent[] = [];
    const out = await e.run({ garment: Buffer.from("g"), person: Buffer.from("p"), settings }, (ev) => events.push(ev), new AbortController().signal);
    expect(out.equals(png)).toBe(true);
    expect(seen!.cmd).toBe("/proj/py");
    expect(seen!.cwd).toBe("/proj/ml");
    expect(seen!.args[0]).toBe("/proj/ml/scripts/sample.py");
    expect(seen!.args).toEqual(expect.arrayContaining(["--lora", "/proj/ml/runs/laptop-v1/lora-best.safetensors", "--steps", "20", "--seed", "42", "--category", "tops", "--scale", "0.5"]));
    expect(events[0]).toMatchObject({ type: "running" });
  });

  it("sorts Python failures into engine error kinds", () => {
    expect(classifyPython("RuntimeError: MPS backend out of memory", 1).kind).toBe("unavailable");
    expect(classifyPython("ModuleNotFoundError: No module named 'fashn_vton'", 1).kind).toBe("unavailable");
    expect(classifyPython("ValueError: No person detected in the image", 1).kind).toBe("input");
    expect(classifyPython("something else", 2).kind).toBe("unknown");
  });
});

describe("local-lora failure messages", () => {
  it("reports a SIGKILL as running out of memory, not the shutdown warning", () => {
    const e = classifyPython("step 3\n/x/resource_tracker.py:254: UserWarning: resource_tracker: leaked\n  warnings.warn('resource_tracker: There appear to be %d '", null, "SIGKILL");
    expect(e.kind).toBe("unavailable");
    expect(e.message).toMatch(/out of memory/);
  });
  it("skips trailing warnings to find the real error line", () => {
    const e = classifyPython("Traceback\nValueError: bad image size\n  warnings.warn('x')", 1);
    expect(e.message).toMatch(/ValueError: bad image size/);
  });
});
