/**
 * Upload rules shared by the browser (instant feedback, no wasted upload)
 * and the server (the actual gate). Pure data — safe to import anywhere.
 */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MIN_SIDE = 256;
/** FASHN generates at 576×864; anything past this only costs upload time. */
export const MAX_SIDE = 1536;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ACCEPT_ATTR = ACCEPTED_TYPES.join(",");

export const HEIC_HINT = "Export it as JPEG first (on iPhone: Settings → Camera → Formats → Most Compatible).";

/** Instagram frames the result can be downloaded in. The result is fitted, never cropped. */
export const EXPORT_SIZES = {
  post: { width: 1080, height: 1350, label: "Post", ratio: "4:5" },
  square: { width: 1080, height: 1080, label: "Square", ratio: "1:1" },
  story: { width: 1080, height: 1920, label: "Story / Reel", ratio: "9:16" },
} as const;
export type ExportSize = keyof typeof EXPORT_SIZES;
