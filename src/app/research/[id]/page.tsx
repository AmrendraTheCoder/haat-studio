import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CopyButton, PrintButton, UseForPosts } from "@/components/research/ReportActions";
import { StudioHeader } from "@/components/site/site";
import { inr } from "@/lib/posts/spec";
import { readReport } from "@/lib/research/build";
import { getMessages } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages";
import type { EconomicsWarning } from "@/lib/research/schema";
import { readSetup } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).t.meta.research };
}

const FORMAT_ICON = { reel: "▶", carousel: "▦", post: "▢", story: "◷" } as const;

function warningText(w: EconomicsWarning | string, R: Messages["report"]): string {
  if (typeof w === "string") return w; // saved before warnings became codes
  return w.code === "noCost" ? R.warnNoCost : w.code === "loss" ? R.warnLoss : R.warnThin(w.pct);
}

export default async function ReportPage({ params }: PageProps<"/research/[id]">) {
  await connection();
  const { id } = await params;
  const [report, setup, { t, locale }] = await Promise.all([readReport(id), readSetup(), getMessages()]);
  if (!report) notFound();
  const R = t.report;
  const Q = t.research;
  const dateLocale = locale === "hi" ? "hi-IN" : "en-IN";

  const { answers: a, findings: f, economics: money, moments } = report;
  const ai = report.via !== "template";
  const allTags = [...f.hashtags.broad, ...f.hashtags.niche, ...f.hashtags.local];

  return (
    <>
      <div className="print:hidden">
        <StudioHeader setup={setup} />
      </div>
      <main className="mx-auto max-w-4xl px-4 pt-8 pb-24 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/research" className="inline-flex min-h-11 items-center text-sm text-ink-2 hover:text-ink">
            {R.edit}
          </Link>
          <PrintButton />
        </div>

        <p className="kicker mt-6">{R.kicker(new Date(report.createdAt).toLocaleDateString(dateLocale, { dateStyle: "long" }))}</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.05em] sm:text-5xl">
          {a.shopName || a.product}
          <span className="text-ink-3">, {a.city}.</span>
        </h1>
        <p className="mt-2 text-ink-2">
          {a.product} · {Q.categories[a.category]} · ₹{a.priceMin.toLocaleString("en-IN")}–{a.priceMax.toLocaleString("en-IN")} · {a.channels.map((c) => Q.channelNames[c]).join(", ")} · {R.goal}: {Q.goals[a.goal].toLowerCase()}
        </p>

        <div className={`mt-5 rounded-xl border px-4 py-3 text-sm ${ai ? "border-line bg-paper-glow" : "border-marigold/50 bg-marigold-wash"}`}>
          {ai ? (
            <>
              <strong>{R.aiTitle(report.via)}</strong> {R.aiBody}
            </>
          ) : (
            <>
              <strong>{R.starterTitle}</strong> {R.starterBody}
            </>
          )}
        </div>

        <section className="mt-8">
          <p className="text-lg leading-relaxed">{f.summary}</p>
        </section>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <section className="card p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold">{R.numbers}</h2>
              <span className="chip">{R.calculated}</span>
            </div>
            {money.perPiece ? (
              <dl className="mt-4 grid grid-cols-2 gap-3">
                <Stat label={R.profitAt(inr(a.priceMin))} value={inr(money.perPiece.atMin)} sub={R.margin(money.perPiece.marginMinPct)} bad={money.perPiece.atMin <= 0} />
                <Stat label={R.profitAt(inr(a.priceMax))} value={inr(money.perPiece.atMax)} sub={R.margin(money.perPiece.marginMaxPct)} bad={money.perPiece.atMax <= 0} />
              </dl>
            ) : null}
            {money.warnings.map((w) => (
              <p key={typeof w === "string" ? w : w.code} className="mt-3 text-sm text-ink-2">
                ⚠ {warningText(w, R)}
              </p>
            ))}
          </section>

          <section className="card p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold">{R.moments}</h2>
              <span className="chip">{R.calculated}</span>
            </div>
            {moments.length ? (
              <ul className="mt-3 space-y-2.5">
                {moments.map((m) => (
                  <li key={m.date} className="flex gap-3 text-sm">
                    <span className="w-16 shrink-0 font-mono text-xs text-ink-3">{m.daysAway === 0 ? R.today : R.inDays(m.daysAway)}</span>
                    <span>
                      <strong>{(locale === "hi" && m.nameHi) || m.name}</strong> — {new Date(`${m.date}T00:00:00`).toLocaleDateString(dateLocale, { day: "numeric", month: "short" })}.{" "}
                      {(locale === "hi" && m.noteHi) || m.note}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink-2">{R.noMoments}</p>
            )}
          </section>
        </div>

        <section className="card mt-4 p-5">
          <h2 className="text-lg font-bold">{R.whoBuys}</h2>
          <p className="mt-2">{f.audience.persona}</p>
          <p className="mt-2 text-sm text-ink-2">
            <strong className="text-ink">{R.whereFind}</strong> {f.audience.whereTheyAre}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {f.audience.whatTheyValue.map((v) => (
              <span key={v} className="chip">
                {v}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-extrabold tracking-tight">{ai ? R.working : R.startWith}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {f.trends.map((tr) => (
              <div key={tr.name} className="card p-5">
                <p className="font-bold">{tr.name}</p>
                <p className="mt-1 text-sm text-ink-2">{tr.why}</p>
                <p className="mt-3 text-sm">
                  <strong>{R.thisWeek}</strong> {tr.action}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="card mt-8 p-5">
          <h2 className="text-lg font-bold">{R.pricing}</h2>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">
            {inr(f.pricing.minRupees)}–{inr(f.pricing.maxRupees)}
            <span className="ml-2 align-middle text-sm font-normal text-ink-3">{R.yoursToday(`${inr(a.priceMin)}–${inr(a.priceMax)}`)}</span>
          </p>
          <p className="mt-2 text-sm text-ink-2">{f.pricing.reasoning}</p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-extrabold tracking-tight">{R.weekPosts}</h2>
          <ol className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper-2">
            {f.weekPlan.map((d) => (
              <li key={d.day} className="flex items-start gap-4 px-5 py-3">
                <span className="w-12 shrink-0 font-mono text-sm font-medium">{R.days[d.day] ?? d.day}</span>
                <span className="w-24 shrink-0 text-xs text-ink-3">
                  {FORMAT_ICON[d.format]} {R.formats[d.format] ?? d.format}
                </span>
                <span className="text-sm">{d.idea}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-extrabold tracking-tight">{R.ideas}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {f.contentIdeas.map((c) => (
              <div key={c.title} className="rounded-xl border border-line bg-paper-glow p-4">
                <p className="text-xs text-ink-3">
                  {FORMAT_ICON[c.format]} {R.formats[c.format] ?? c.format}
                </p>
                <p className="mt-1 font-semibold">{c.title}</p>
                <p className="mt-1 text-sm text-ink-2">
                  {R.hook} “{c.hook}”
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="card mt-8 p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">{R.hashtags}</h2>
            <CopyButton text={allTags.join(" ")} label={t.common.copyAll} />
          </div>
          {(["broad", "niche", "local"] as const).map((k) =>
            f.hashtags[k].length ? (
              <p key={k} className="mt-3 text-sm">
                <span className="mr-2 font-mono text-2xs text-ink-3 uppercase">{R.tagGroups[k]}</span>
                {f.hashtags[k].join(" ")}
              </p>
            ) : null,
          )}
        </section>

        {f.watchOuts.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold">{R.watchOut}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
              {f.watchOuts.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-12 flex flex-wrap items-center gap-3 rounded-3xl border border-line bg-paper-3 p-6 print:hidden">
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold">{R.nextTitle}</p>
            <p className="text-sm text-ink-2">{R.nextBody}</p>
          </div>
          <UseForPosts id={report.id} />
        </section>
      </main>
    </>
  );
}

function Stat({ label, value, sub, bad }: { label: string; value: string; sub: string; bad?: boolean }) {
  return (
    <div className="rounded-xl bg-paper-glow p-3">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className={`mt-1 text-2xl font-extrabold tracking-tight ${bad ? "text-danger" : ""}`}>{value}</dd>
      <dd className="text-xs text-ink-2">{sub}</dd>
    </div>
  );
}
