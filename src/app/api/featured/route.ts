import { z } from "zod";
import { env } from "@/lib/env";
import { store } from "@/lib/tryon";

/** Results picked for the landing page, in order. */
export async function GET() {
  const s = store();
  const metas = await Promise.all((await s.featured()).map((k) => s.find(k)));
  return Response.json(metas.filter(Boolean), { headers: { "Cache-Control": "no-store" } });
}

const body = z.object({ key: z.string().regex(/^[0-9a-f]{32}$/), on: z.boolean() });

/** { key, on } — feature or unfeature a saved result. Off unless CURATION is on. */
export async function POST(request: Request) {
  if (env().CURATION !== "on") {
    return Response.json({ error: "Curation is turned off on this server." }, { status: 403 });
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Send { key, on }." }, { status: 400 });
  try {
    return Response.json({ featured: await store().setFeatured(parsed.data.key, parsed.data.on) });
  } catch (err) {
    const message = (err as Error).message;
    return /test-engine/.test(message)
      ? Response.json({ error: "Results from the echo test engine aren't real try-ons, so they can't be featured." }, { status: 409 })
      : Response.json({ error: "That result doesn't exist." }, { status: 404 });
  }
}
