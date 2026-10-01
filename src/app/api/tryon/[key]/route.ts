import { store, studio } from "@/lib/tryon";
import { streamEvents, streamJob } from "@/lib/tryon/stream";

const KEY = /^[0-9a-f]{32}$/;

/**
 * Re-attach to a generation by key — after a reload, a dropped connection,
 * or from a shared link. Running → the same NDJSON stream from the start.
 * Finished → a single `done`. Neither → 404 (it failed, or never existed;
 * failures aren't stored, so the studio offers to try again).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!KEY.test(key)) return Response.json({ error: "Not a result link." }, { status: 404 });

  const running = studio().get(key);
  if (running) return streamJob(running);

  const result = await store().find(key);
  if (result) return streamEvents([{ type: "done", result, cached: true }]);

  return Response.json({ error: "This photo isn't running and wasn't saved." }, { status: 404 });
}
