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
});

export type Env = z.infer<typeof schema>;

/**
 * Parsed on every call rather than once: `next dev` reloads .env when it
 * changes, and a cached copy would keep serving the old token until restart.
 */
export function env(): Env {
  return schema.parse(process.env);
}
