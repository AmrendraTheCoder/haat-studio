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

/** Which model makes the photo: FASHN VTON 1.5 as released, or with the project's LoRA adapter. */
export const MODEL_CHOICES = ["base", "tuned"] as const;
export type ModelChoice = (typeof MODEL_CHOICES)[number];

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
  /**
   * "base" runs FASHN VTON 1.5 as released; "tuned" runs it with the project's LoRA adapter.
   * The seller picks the model; the studio only tries engines of that variant.
   */
  readonly variant?: ModelChoice;
  /** For tuned engines: which adapter (its run name). Part of the cache key, so a new adapter means new results. */
  readonly adapter?: string;
  /** Runs on this computer, not on the shared free GPU: no quota is spent or recorded. */
  readonly local?: boolean;
  /** Overrides the studio's timeout for this engine (a laptop needs minutes, not seconds). */
  readonly timeoutMs?: number;
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

/** What `prepareImage` did to one photo — shown in the studio's live panel. */
export interface PrepInfo {
  /** Upright size of the upload. */
  width: number;
  height: number;
  /** Size sent to the engine. */
  outWidth: number;
  outHeight: number;
  rotated: boolean;
  flattened: boolean;
  resized: boolean;
  /** Camera metadata (EXIF/XMP/IPTC — often GPS location) was removed before upload. */
  stripped: boolean;
}

export interface Prep {
  garment: PrepInfo;
  person: PrepInfo;
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
  prep?: Prep;
  /** Output guardrails run on the generated image (quality.ts). Absent on results saved before them. */
  quality?: OutputQuality;
  /** Present on results from the LoRA-adapted model: the variant and the adapter's run name. */
  model?: { variant: ModelChoice; adapter?: string };
}

/**
 * One automatic check on a generated photo. `ok: false` with `severity: "fail"`
 * means the result should not be shown as finished; `"warn"` means show it with
 * a note the seller can act on.
 *  - blank: the image is (almost) one flat colour
 *  - size: its aspect ratio doesn't match the model photo
 *  - changed: it is (almost) identical to the model photo, so nothing was tried on
 *  - colour: the garment area looks more like the old outfit than the new garment
 *  - person: the model's silhouette moved far from where it was (pose drift proxy)
 */
export interface QualityCheck {
  id: "blank" | "size" | "changed" | "colour" | "person";
  ok: boolean;
  severity: "fail" | "warn";
  value: number;
  limit: number;
  /** extra measurements behind the verdict (colour: distance to the old outfit, garment vs old outfit) */
  detail?: Record<string, number>;
}

export interface OutputQuality {
  /** No failing check. Warnings don't block the result. */
  passed: boolean;
  checks: QualityCheck[];
}

/**
 * What `/api/tryon` streams to the browser, one JSON object per line.
 * `at` is the server's clock when the event happened, so a page that
 * reconnects later still sees real stage durations, not replay time.
 */
export type StreamEvent = { at?: number } & (
  | { type: "accepted"; key: string }
  | { type: "prepared"; prep: Prep }
  /** The result cache was consulted. A hit is followed directly by `done`. */
  | { type: "checked"; hit: boolean }
  | { type: "waiting" }
  | { type: "queued"; engine: string; position: number | null; etaSeconds: number | null }
  | { type: "running"; engine: string; etaSeconds: number | null }
  | { type: "done"; result: ResultMeta; cached: boolean }
  | { type: "error"; message: string; attempts: Attempt[] }
);
