/**
 * Phones can hand a file straight to Instagram, WhatsApp or the photo
 * gallery through the system share sheet (Web Share Level 2). Sellers live on
 * their phones, so this is the shortest path from "made" to "posted".
 * Desktop browsers mostly can't share files; there the download button stays.
 */
export function canShareFiles(): boolean {
  try {
    const probe = new File([new Uint8Array([0])], "probe.png", { type: "image/png" });
    return typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** Resolves to "shared", "cancelled" (the user closed the sheet) or "failed". */
export async function shareImage(blob: Blob, name: string, text?: string): Promise<"shared" | "cancelled" | "failed"> {
  try {
    await navigator.share({ files: [new File([blob], name, { type: blob.type || "image/png" })], text });
    return "shared";
  } catch (err) {
    return (err as Error).name === "AbortError" ? "cancelled" : "failed";
  }
}
