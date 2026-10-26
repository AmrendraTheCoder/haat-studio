import { readReport } from "@/lib/research/build";

/** A saved report — the post maker reads it to ground captions in the seller's audience. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const report = await readReport((await params).id);
  return report ? Response.json(report) : Response.json({ error: "No report with that id." }, { status: 404 });
}
