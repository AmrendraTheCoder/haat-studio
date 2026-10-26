import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export const PASSCODE_HEADER = "x-studio-passcode";

/**
 * Gate for every route that spends quota or changes what visitors see
 * (try-on, captions, research, featuring). Returns a 401 response to send,
 * or null to carry on. Without STUDIO_PASSCODE nothing is gated — the right
 * default on a laptop, the wrong one on a public link.
 */
export function requirePasscode(request: Request): Response | null {
  const expected = env().STUDIO_PASSCODE;
  if (!expected) return null;
  const given = request.headers.get(PASSCODE_HEADER) ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length === b.length && timingSafeEqual(a, b)) return null;
  return Response.json(
    { error: given ? "That passcode isn't right." : "This studio needs a passcode before it can create anything.", needsPasscode: true },
    { status: 401 },
  );
}
