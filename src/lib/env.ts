import { z } from "zod";

/** An empty `KEY=` line in .env means "not set", not "set to nothing". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

const schema = z.object({
  HF_TOKEN: optional(z.string().startsWith("hf_", "HF_TOKEN must start with hf_")),
  /** Comma-separated, tried in order. */
  TRYON_ENGINES: z.string().default("fashn-space"),
  /** Ceiling on one generation, queue included. */
  TRYON_TIMEOUT_MS: z.coerce.number().int().positive().default(240_000),
  DATA_DIR: z.string().default("data"),
  /**
   * The Hugging Face account's daily ZeroGPU allowance, in seconds: 300 for a
   * free account, 2400 for PRO. Only used to show what's left — Hugging Face
   * itself enforces the real limit.
   */
  ZEROGPU_DAILY_SECONDS: z.coerce.number().int().positive().default(300),
  /**
   * Free accounts also have an unpublished daily limit on the number of runs.
   * Unset, the studio learns it the first time Hugging Face refuses with
   * "runs limit"; set it if you know your account's number.
   */
  ZEROGPU_DAILY_RUNS: optional(z.coerce.number().int().positive()),
  /**
   * Whether the studio offers "Feature on the home page". There is no login
   * yet, so on a deployed copy anyone could curate; default it off there.
   */
  CURATION: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["on", "off"]).default(process.env.NODE_ENV === "production" ? "off" : "on"),
  ),

  /* ── Text AI (captions, market research). All free tiers; any one is enough. ── */
  GROQ_API_KEY: optional(z.string()),
  GEMINI_API_KEY: optional(z.string()),
  /**
   * Comma-separated `provider/model`, tried in order. Providers without a key
   * are skipped. Free model ids get withdrawn without notice — `npm run
   * llm:check` says which still answer.
   */
  // hf/<model> also works, but a free Hugging Face account's text-AI credit is
  // tiny and runs out silently — so it isn't in the default chain.
  LLM_CHAIN: z.string().default("groq/llama-3.3-70b-versatile,gemini/gemini-2.5-flash"),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),

  /**
   * When set, creating photos, captions and research — and featuring — needs
   * this passcode. Set it on any public deployment: there is no login, and
   * otherwise anyone with the link spends your free quota.
   */
  STUDIO_PASSCODE: optional(z.string().min(4)),
});

export type Env = z.infer<typeof schema>;

/**
 * Parsed on every call rather than once: `next dev` reloads .env when it
 * changes, and a cached copy would keep serving the old token until restart.
 */
export function env(): Env {
  return schema.parse(process.env);
}
