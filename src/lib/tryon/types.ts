import { z } from "zod";

export const CATEGORIES = ["tops", "bottoms", "one-pieces"] as const;
export const PHOTO_TYPES = ["flat-lay", "model"] as const;

/**
 * Sampling steps per quality level. These are the three values FASHN
 * documents; more steps cost proportionally more GPU time, and GPU time is
 * the free quota we are spending.
 */
export const QUALITY_STEPS = { fast: 20, balanced: 30, best: 50 } as const;
export type Quality = keyof typeof QUALITY_STEPS;

export const settingsSchema = z.object({
  category: z.enum(CATEGORIES),
  photoType: z.enum(PHOTO_TYPES),
  quality: z.enum(["fast", "balanced", "best"]),
  seed: z.coerce.number().int().min(0).max(2 ** 31 - 1),
});
export type TryOnSettings = z.infer<typeof settingsSchema>;

/** Both images are already normalised by `prepareImage` — JPEG, upright, bounded. */
export interface TryOnInput {
  garment: Buffer;
  person: Buffer;
  settings: TryOnSettings;
}

export type EngineEvent =
  | { type: "queued"; position: number | null; etaSeconds: number | null }
  | { type: "running"; etaSeconds: number | null };

export interface Engine {
  readonly id: string;
  readonly label: string;
  /** False when a required key is missing; the chain skips it and says why. */
  readonly configured: boolean;
  readonly missing?: string;
  /** Resolves to the generated image's bytes, in whatever format the engine returns. */
  run(input: TryOnInput, onEvent: (e: EngineEvent) => void, signal: AbortSignal): Promise<Buffer>;
}

/**
 * `input` means the images themselves were rejected — every engine would
 * reject them too, so the chain stops instead of burning another quota.
 * Everything else is the engine's problem and the next one gets a turn.
 */
export type EngineErrorKind = "quota" | "unavailable" | "timeout" | "input" | "unknown";

export class EngineError extends Error {
  constructor(
    message: string,
    readonly kind: EngineErrorKind,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

export interface Attempt {
  engine: string;
  kind: EngineErrorKind | "skipped";
  message: string;
  retryAfterSeconds?: number;
}

export interface ResultMeta {
  key: string;
  engine: string;
  settings: TryOnSettings;
  personId: string;
  createdAt: string;
  /** Wall time from submit to result, queue included. */
  totalMs: number;
  /** Time spent waiting in the Space's queue before the GPU picked it up. */
  queueMs: number;
}

/** What `/api/tryon` streams to the browser, one JSON object per line. */
export type StreamEvent =
  | { type: "accepted"; key: string }
  | { type: "waiting" }
  | { type: "queued"; engine: string; position: number | null; etaSeconds: number | null }
  | { type: "running"; engine: string; etaSeconds: number | null }
  | { type: "done"; result: ResultMeta; cached: boolean }
  | { type: "error"; message: string; attempts: Attempt[] };
