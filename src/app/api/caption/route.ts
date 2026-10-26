import { requirePasscode } from "@/lib/guard";
import { writeCaption } from "@/lib/posts/caption";
import { captionRequestSchema } from "@/lib/posts/spec";
import { readReport } from "@/lib/research/build";

export const maxDuration = 60;

/** POST { post, category, tone, language, researchId? } → { caption, hashtags, via, attempts? }. Never fails for lack of AI: falls back to a template. */
export async function POST(request: Request) {
  const denied = requirePasscode(request);
  if (denied) return denied;

  const parsed = captionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
  }
  const research = parsed.data.researchId ? await readReport(parsed.data.researchId) : null;
  return Response.json(await writeCaption(parsed.data, research));
}
