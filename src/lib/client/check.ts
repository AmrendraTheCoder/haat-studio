import type { Messages } from "@/lib/i18n/messages";
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES, MIN_SIDE } from "@/lib/limits";

export const resultUrl = (key: string, file: string) => `/api/results/${key}/${file}`;

/**
 * The server's upload rules, checked in the browser first so a seller on a
 * slow connection learns about a wrong file before uploading 10 MB of it.
 * The server still checks everything; this is only the fast path.
 * Returns an error message in the seller's language, or null when the file is usable.
 */
export async function checkImageFile(file: File, what: "product" | "model", t: Messages): Promise<string | null> {
  const c = t.check;
  const label = c[what];
  const name = file.name.toLowerCase();
  if (file.type === "image/heic" || file.type === "image/heif" || /\.(heic|heif)$/.test(name)) {
    return c.heic(label);
  }
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return c.notImage(file.name);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return c.tooBig(label, (file.size / 1048576).toFixed(1));
  }
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    bitmap.close();
    if (Math.min(width, height) < MIN_SIDE) {
      return c.tooSmall(label, width, height, MIN_SIDE);
    }
  } catch {
    return c.unreadable(label);
  }
  return null;
}

/** Re-creates a File from a URL — for samples, presets and saved results. */
export async function fileFrom(url: string, name: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`couldn't load ${url} (HTTP ${res.status})`);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}
