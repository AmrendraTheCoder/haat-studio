import { spawn as nodeSpawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { env } from "@/lib/env";
import { adapterName } from "./fashn-space";
import { EngineError, QUALITY_STEPS, type Engine } from "./types";

/**
 * FASHN VTON 1.5 with the project's LoRA adapter, run on this computer.
 *
 * It calls ml/scripts/sample.py, the same code the evaluation used (compare_lora.py measured this
 * adapter against the base model on held-out garments), so the app and the experiments share one
 * path from photo to pixels. Nothing goes to a shared GPU: no quota is spent or recorded.
 *
 *   TRYON_ENGINES=local-lora              tuned model only
 *   TRYON_ENGINES=fashn-space,local-lora  standard model on the free GPU, tuned model locally
 *
 * Needs ml/.venv (ML_PYTHON), the FASHN weights in ml/weights and the adapter (LORA_ADAPTER).
 * It generates at LOCAL_LORA_SCALE (0.5: the size the laptop adapter was trained and evaluated at)
 * and upsamples to full size. On the project's 8 GB M3 that took 54 s for 20 steps (86 s with
 * loading, 4.8 GB peak); at full size the run was killed for lack of memory.
 */
export const LOCAL_LORA_ID = "local-lora";

/** Measured on the project's 8 GB M3 at half size: 2.7 s a sampling step, about 30 s to load. */
const SECONDS_PER_STEP_LAPTOP = 2.7;
const LOAD_SECONDS = 30;

export interface LocalLoraOptions {
  root?: string;
  python?: string;
  adapter?: string;
  timeoutMs?: number;
  scale?: number;
  /** Injected in tests. */
  spawn?: (cmd: string, args: string[], opts: { cwd: string }) => ChildProcess;
  exists?: (p: string) => boolean;
}

export function localLora(o: LocalLoraOptions = {}): Engine {
  const e = env();
  const root = o.root ?? process.cwd();
  // Runtime-only paths (the ML folder is never part of the web build): tell the bundler not to trace them.
  const abs = (p: string) => path.resolve(/*turbopackIgnore: true*/ root, p);
  const python = abs(o.python ?? e.ML_PYTHON);
  const adapter = abs(o.adapter ?? e.LORA_ADAPTER);
  const mlDir = abs("ml");
  const scale = o.scale ?? e.LOCAL_LORA_SCALE;
  const exists = o.exists ?? ((p: string) => existsSync(/*turbopackIgnore: true*/ p));
  const spawn = o.spawn ?? ((cmd, args, opts) => nodeSpawn(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"] }));

  const missing = !exists(python)
    ? `the Python environment is missing (${o.python ?? e.ML_PYTHON}); run the setup in ml/README.md`
    : !exists(path.join(/*turbopackIgnore: true*/ mlDir, "weights", "model.safetensors"))
      ? "the FASHN weights are missing (ml/weights); run ml/scripts/download_weights.py"
      : !exists(adapter)
        ? `the LoRA adapter is missing (${o.adapter ?? e.LORA_ADAPTER}); train one with ml/run_lora_pipeline.sh`
        : undefined;

  return {
    id: LOCAL_LORA_ID,
    label: "FASHN VTON 1.5 + Haat LoRA · this computer",
    variant: "tuned",
    adapter: adapterName(adapter),
    local: true,
    timeoutMs: o.timeoutMs ?? e.LOCAL_LORA_TIMEOUT_MS,
    configured: !missing,
    missing,

    async run(input, onEvent, signal) {
      const dir = await mkdtemp(path.join(/*turbopackIgnore: true*/ tmpdir(), "haat-lora-"));
      try {
        const [person, garment, out] = ["person.jpg", "garment.jpg", "result.png"].map((f) => path.join(/*turbopackIgnore: true*/ dir, f));
        await Promise.all([writeFile(person, input.person), writeFile(garment, input.garment)]);
        const steps = QUALITY_STEPS[input.settings.quality];
        const args = [
          path.join(/*turbopackIgnore: true*/ mlDir, "scripts", "sample.py"),
          "--person", person, "--garment", garment, "--out", out,
          "--category", input.settings.category, "--photo-type", input.settings.photoType,
          "--steps", String(steps), "--seed", String(input.settings.seed), "--lora", adapter, "--scale", String(scale),
        ];
        onEvent({ type: "running", etaSeconds: Math.round(steps * SECONDS_PER_STEP_LAPTOP + LOAD_SECONDS) });
        const child = spawn(python, args, { cwd: mlDir });
        const kill = () => child.kill("SIGTERM");
        signal.addEventListener("abort", kill, { once: true });
        let stderr = "";
        child.stderr?.on("data", (d: Buffer) => (stderr = (stderr + d.toString()).slice(-4000)));
        child.stdout?.resume();
        const [code, killedBy] = await new Promise<[number | null, NodeJS.Signals | null]>((resolve, reject) => {
          child.on("error", (err) => reject(new EngineError(`could not start Python: ${err.message}`, "unavailable")));
          child.on("close", (c, sig) => resolve([c, sig]));
        }).finally(() => signal.removeEventListener("abort", kill));
        signal.throwIfAborted();
        if (code !== 0) throw classifyPython(stderr, code, killedBy);
        return await readFile(/*turbopackIgnore: true*/ out).catch(() => {
          throw new EngineError("the tuned model finished without writing a result", "unknown");
        });
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
}

/** Out-of-memory and missing pieces are the computer's problem ("unavailable"); a bad photo is "input". */
export function classifyPython(stderr: string, code: number | null, killedBy: string | null = null): EngineError {
  // The last line that names an error, not a shutdown warning printed after it.
  const lines = stderr.trim().split("\n").filter(Boolean);
  const last = [...lines].reverse().find((l) => /Error|Exception|Killed/.test(l) && !/warnings\.warn|UserWarning/.test(l)) ?? lines.at(-1) ?? `exit code ${code}`;
  // macOS stops a process that uses too much memory with SIGKILL and no Python traceback.
  if (killedBy === "SIGKILL" || code === 137 || (code === null && !killedBy)) return new EngineError("the system stopped the tuned model, most likely because this computer ran out of memory; close other apps and try again", "unavailable");
  if (/out of memory|MPS backend out of memory|CUDA out of memory|Killed/i.test(stderr)) return new EngineError(`this computer ran out of memory: ${last}`, "unavailable");
  if (/No (person|human) (was )?(detected|found)|no person/i.test(stderr)) return new EngineError(`no person found in the model photo: ${last}`, "input");
  if (/ModuleNotFoundError|No such file|FileNotFoundError/i.test(stderr)) return new EngineError(`the tuned model is not installed correctly: ${last}`, "unavailable");
  return new EngineError(`the tuned model failed: ${last}`, "unknown");
}
