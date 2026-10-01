import { ACCEPTED_TYPES, HEIC_HINT, MAX_UPLOAD_BYTES, MIN_SIDE } from "@/lib/limits";

export const resultUrl = (key: string, file: string) => `/api/results/${key}/${file}`;

/**
 * The server's upload rules, checked in the browser first so a seller on a
 * slow connection learns about a wrong file before uploading 10 MB of it.
 * The server still checks everything; this is only the fast path.
 * Returns an error message, or null when the file is usable.
 */
export async function checkImageFile(file: File, label: string): Promise<string | null> {
  const name = file.name.toLowerCase();
  if (file.type === "image/heic" || file.type === "image/heif" || /\.(heic|heif)$/.test(name)) {
    return `This ${label} photo is HEIC. ${HEIC_HINT}`;
  }
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return `“${file.name}” isn't a JPEG, PNG or WebP image.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `This ${label} photo is ${(file.size / 1048576).toFixed(1)} MB. The limit is 15 MB — export a smaller JPEG.`;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    bitmap.close();
    if (Math.min(width, height) < MIN_SIDE) {
      return `This ${label} photo is only ${width}×${height}. Use one at least ${MIN_SIDE}px on its short side.`;
    }
  } catch {
    return `This ${label} file couldn't be opened as an image.`;
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
