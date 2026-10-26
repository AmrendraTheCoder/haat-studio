/**
 * The free GPU quota, as far as this studio can know it. Pure — used by the
 * server (ledger) and the browser (types, formatting).
 *
 * What Hugging Face documents (docs/hub/spaces-zerogpu):
 *   - a free account gets 5 minutes of ZeroGPU time a day (PRO: 40);
 *   - the day resets exactly 24 hours after the first GPU use, not at midnight;
 *   - a call reserves the Space's declared duration before it starts — FASHN
 *     declares none, so the 60 s default — and is refused if less is left,
 *     even though a photo only uses ~25 s of it.
 * Free accounts also have a daily limit on the NUMBER of runs (HF staff,
 * forum, April 2026: "both time-based quotas and request-based limits"). Its
 * value isn't published — this account was stopped after 8 photos on
 * 2026-10-26 with "You have exceeded your ZeroGPU runs limit", 3 minutes in.
 *
 * Hugging Face has no API for either balance. So the studio counts its own
 * runs and GPU time; a time refusal says how much is left ("60s requested vs.
 * 12s left") and replaces the estimate, and a runs refusal teaches the run limit.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
/** ZeroGPU's default `@spaces.GPU` duration — what each call must have left to start. */
export const REQUEST_SECONDS = 60;
/** Until this studio has timed a few photos of its own. */
const DEFAULT_PHOTO_SECONDS = 27;

export interface GpuRun {
  /** When GPU work started (epoch ms). */
  at: number;
  /** How long it ran. */
  ms: number;
}

export interface Refusal {
  at: number;
  message: string;
  /** "runs": the daily run-count limit; "time": the GPU-seconds quota. */
  kind: "runs" | "time" | "unknown";
  leftSeconds?: number;
  requestedSeconds?: number;
  retryAfterSeconds?: number;
}

export interface Ledger {
  runs: GpuRun[];
  refusal?: Refusal;
  /** Runs in the window when Hugging Face last said "runs limit" — the best guess at that limit. */
  runsLimit?: { runs: number; learnedAt: number };
}

export interface QuotaStatus {
  limitSeconds: number;
  usedSeconds: number;
  leftSeconds: number;
  /** How many more photos fit, given each needs REQUEST_SECONDS free to start. */
  photosLeft: number;
  perPhotoSeconds: number;
  requestSeconds: number;
  /** Photos that reached the GPU in the current window. */
  runsUsed: number;
  /** The daily run limit, once learned from a refusal (or set in .env); null while unknown. */
  runsLimit: number | null;
  /** Which limit `photosLeft` comes from. */
  limitedBy: "time" | "runs";
  /** When the quota refills, or null when no 24-hour window is running. */
  resetsAt: string | null;
  /** True when Hugging Face gave the refill time; false when it's 24 h after the first photo by our count. */
  resetsExact: boolean;
  /** "huggingface": the balance came from ZeroGPU's own refusal message. */
  source: "estimate" | "huggingface";
  /** When Hugging Face last reported a number. */
  reportedAt: string | null;
  /** The last call was refused and nothing has run since: less than `requestSeconds` is left. */
  refused: boolean;
}

/** "(60s requested vs. 12s left). Try again in 0:13:21" → numbers. Wording as documented; anything missing stays undefined. */
export function parseRefusal(message: string, at: number): Refusal {
  const r: Refusal = { at, message: message.slice(0, 500), kind: /runs? limit/i.test(message) ? "runs" : /requested|quota/i.test(message) ? "time" : "unknown" };
  const amounts = message.match(/(\d+(?:\.\d+)?)\s*s\s+requested\s+vs\.?\s+(\d+(?:\.\d+)?)\s*s\s+left/i);
  if (amounts) {
    r.requestedSeconds = Number(amounts[1]);
    r.leftSeconds = Number(amounts[2]);
  }
  const wait = message.match(/try again in (?:(\d+)\s*days?,\s*)?(\d+):(\d{2}):(\d{2})/i);
  if (wait) r.retryAfterSeconds = Number(wait[1] ?? 0) * 86400 + Number(wait[2]) * 3600 + Number(wait[3]) * 60 + Number(wait[4]);
  return r;
}

/** Start of the 24-hour window `now` falls in, or null when the last one has run out. */
function windowStart(runs: GpuRun[], now: number): number | null {
  let start: number | null = null;
  for (const r of [...runs].sort((a, b) => a.at - b.at)) {
    if (start === null || r.at >= start + DAY_MS) start = r.at;
  }
  return start !== null && now < start + DAY_MS ? start : null;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

export function photosFitting(leftSeconds: number, perPhotoSeconds: number, requestSeconds = REQUEST_SECONDS): number {
  return leftSeconds >= requestSeconds ? Math.floor((leftSeconds - requestSeconds) / perPhotoSeconds) + 1 : 0;
}

/** Remembers the run limit when a refusal says that's what was hit. */
export function learnFromRefusal(ledger: Ledger, refusal: Refusal): Ledger {
  const start = windowStart(ledger.runs, refusal.at);
  const runsUsed = start === null ? 0 : ledger.runs.filter((r) => r.at >= start).length;
  return {
    ...ledger,
    refusal,
    ...(refusal.kind === "runs" && runsUsed > 0 && { runsLimit: { runs: runsUsed, learnedAt: refusal.at } }),
  };
}

export function quotaStatus(ledger: Ledger, now: number, limitSeconds: number, runsLimitOverride?: number): QuotaStatus {
  const start = windowStart(ledger.runs, now);
  const inWindow = start === null ? [] : ledger.runs.filter((r) => r.at >= start);
  const usedSeconds = inWindow.reduce((sum, r) => sum + r.ms, 0) / 1000;
  const recent = ledger.runs.slice(-10).map((r) => r.ms / 1000);
  const perPhotoSeconds = Math.round(recent.length >= 3 ? median(recent) : DEFAULT_PHOTO_SECONDS);

  let leftSeconds = Math.max(0, limitSeconds - usedSeconds);
  let resetsAt = start === null ? null : start + DAY_MS;
  let resetsExact = false;
  let source: QuotaStatus["source"] = "estimate";
  let reportedAt: string | null = null;

  // A refusal still in force overrides the estimate: Hugging Face counts usage
  // we can't see (other apps on the same token, time a failed call spent).
  const f = ledger.refusal;
  const refillAt = f?.retryAfterSeconds !== undefined ? f.at + f.retryAfterSeconds * 1000 : null;
  const ranSince = f ? ledger.runs.some((r) => r.at > f.at) : false;
  // Without numbers, a photo that worked after the refusal proves it stale.
  const stillRefused = f && (refillAt !== null ? now < refillAt : start !== null && f.at >= start) && (f.leftSeconds !== undefined || !ranSince);
  if (f && stillRefused) {
    const since = ledger.runs.filter((r) => r.at > f.at).reduce((sum, r) => sum + r.ms, 0) / 1000;
    if (f.kind !== "runs") leftSeconds = Math.max(0, Math.min(leftSeconds, (f.leftSeconds ?? 0) - since));
    if (f.leftSeconds !== undefined) source = "huggingface";
    reportedAt = new Date(f.at).toISOString();
    if (refillAt !== null) {
      resetsAt = refillAt;
      resetsExact = true;
    }
  }

  const runsUsed = inWindow.length;
  const runsLimit = runsLimitOverride ?? ledger.runsLimit?.runs ?? null;
  const byTime = photosFitting(leftSeconds, perPhotoSeconds);
  const byRuns = runsLimit === null ? Infinity : Math.max(0, runsLimit - runsUsed);
  const refused = Boolean(stillRefused && !ranSince);

  return {
    limitSeconds,
    usedSeconds: Math.round(Math.max(usedSeconds, limitSeconds - leftSeconds)),
    leftSeconds: Math.round(leftSeconds),
    photosLeft: refused ? 0 : Math.min(byTime, byRuns),
    perPhotoSeconds,
    requestSeconds: REQUEST_SECONDS,
    runsUsed,
    runsLimit,
    limitedBy: byRuns < byTime || f?.kind === "runs" ? "runs" : "time",
    resetsAt: resetsAt === null ? null : new Date(resetsAt).toISOString(),
    resetsExact,
    source,
    reportedAt,
    refused,
  };
}
