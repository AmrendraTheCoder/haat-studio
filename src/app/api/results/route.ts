import { store } from "@/lib/tryon";

/** Newest first. The gallery, and the demo's fallback when the quota runs out. */
export async function GET() {
  return Response.json(await store().list(30), { headers: { "Cache-Control": "no-store" } });
}
