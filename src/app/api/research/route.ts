import { requirePasscode } from "@/lib/guard";
import { createReport, saveReport } from "@/lib/research/build";
import { answersSchema } from "@/lib/research/schema";

// A large free model can take a while on a long structured answer.
export const maxDuration = 120;

/** POST the questionnaire answers → { id, via, attempts? }. The report is saved and opened at /research/<id>. */
export async function POST(request: Request) {
  const denied = requirePasscode(request);
  if (denied) return denied;

  const parsed = answersSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Some answers need fixing.", fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])) },
      { status: 400 },
    );
  }

  const { attempts, ...report } = await createReport(parsed.data);
  await saveReport(report);
  return Response.json({ id: report.id, via: report.via, attempts });
}
