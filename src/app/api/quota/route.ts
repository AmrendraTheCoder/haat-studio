import { readQuota } from "@/lib/tryon";

/** GET: the free GPU quota left today, or null when generation is off. Read-only, so no passcode. */
export async function GET() {
  return Response.json(await readQuota(), { headers: { "Cache-Control": "no-store" } });
}
