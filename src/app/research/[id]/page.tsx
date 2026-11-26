import type { Metadata } from "next";
import { PRIVATE } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CopyButton, PrintButton, UseForPosts } from "@/components/research/ReportActions";
import { AppShell } from "@/components/site/AppShell";
import { inr } from "@/lib/posts/spec";
import { readReport } from "@/lib/research/build";
import { getMessages } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages";
import type { EconomicsWarning } from "@/lib/research/schema";
import type { MarketPlan } from "@/lib/market/engines";
import { readSetup } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/research/[id]">): Promise<Metadata> {
  const [{ t }, report] = await Promise.all([getMessages(), params.then(({ id }) => readReport(id))]);
  // A seller's report is their own: reachable by link, never listed in search results.
  return {
    title: report ? t.meta.report(report.answers.shopName || report.answers.product) : t.meta.research,
    robots: PRIVATE,
    alternates: { canonical: report ? `/research/${report.id}` : "/research" },
  };
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
    <AppShell setup={setup} active="research" crumbs={[{ label: t.shell.nav.research, href: "/research" }, { label: a.shopName || a.product }]}>
      <main className="app-page">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/research" className="inline-flex min-h-11 items-center text-sm font-medium text-ink-2 hover:text-ink">
            {R.edit}
          </Link>
          <PrintButton />
        </div>

        <p className="kicker mt-6">{R.kicker(new Date(report.createdAt).toLocaleDateString(dateLocale, { dateStyle: "long" }))}</p>
        <h1 className="mt-2 h-page sm:text-4xl">
          {a.shopName || a.product}
          <span className="text-ink-3">, {a.city}.</span>
        </h1>
        <p className="mt-2 text-ink-2">
          {a.product} · {Q.categories[a.category]} · ₹{a.priceMin.toLocaleString("en-IN")}–{a.priceMax.toLocaleString("en-IN")} · {a.channels.map((c) => Q.channelNames[c]).join(", ")} · {R.goal}: {Q.goals[a.goal].toLowerCase()}
        </p>

        <div className={`mt-5 rounded-xl border px-4 py-3 text-sm ${ai ? "border-line bg-paper-2" : "border-marigold/60 bg-marigold-wash"}`}>
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
              <h2 className="text-base font-semibold">{R.numbers}</h2>
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
              <h2 className="text-base font-semibold">{R.moments}</h2>
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
          <h2 className="text-base font-semibold">{R.whoBuys}</h2>
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
          <h2 className="text-xl font-semibold tracking-tight">{ai ? R.working : R.startWith}</h2>
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
          <h2 className="text-base font-semibold">{R.pricing}</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight">
            {inr(f.pricing.minRupees)}–{inr(f.pricing.maxRupees)}
            <span className="ml-2 align-middle text-sm font-normal text-ink-3">{R.yoursToday(`${inr(a.priceMin)}–${inr(a.priceMax)}`)}</span>
          </p>
          <p className="mt-2 text-sm text-ink-2">{f.pricing.reasoning}</p>
        </section>

        {report.market && <MarketSection plan={report.market} t={t} />}

        <section className="mt-8">
          <h2 className="text-xl font-semibold tracking-tight">{R.weekPosts}</h2>
          <ol className="card mt-4 divide-y divide-line overflow-hidden">
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
          <h2 className="text-xl font-semibold tracking-tight">{R.ideas}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {f.contentIdeas.map((c) => (
              <div key={c.title} className="card p-4">
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
            <h2 className="text-base font-semibold">{R.hashtags}</h2>
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
            <h2 className="text-base font-semibold">{R.watchOut}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
              {f.watchOuts.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-12 flex flex-wrap items-center gap-3 rounded-2xl border border-accent-strong/20 bg-accent-wash p-6 print:hidden">
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold">{R.nextTitle}</p>
            <p className="text-sm text-ink-2">{R.nextBody}</p>
          </div>
          <UseForPosts id={report.id} />
        </section>
      </main>
    </AppShell>
  );
}

function Stat({ label, value, sub, bad }: { label: string; value: string; sub: string; bad?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-paper-2 p-3">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className={`mt-1 text-2xl font-bold tracking-tight ${bad ? "text-danger" : ""}`}>{value}</dd>
      <dd className="text-xs text-ink-2">{sub}</dd>
    </div>
  );
}

/** Price band, title, hashtags and positioning from real listings (src/lib/market/engines.ts). */
function MarketSection({ plan, t }: { plan: MarketPlan; t: Messages }) {
  const M = t.market;
  const p = plan.pricing;
  const n = (x: number) => x.toLocaleString("en-IN");
  return (
    <section aria-labelledby="market-h2" className="mt-8 overflow-hidden rounded-2xl border border-line bg-paper-glow">
      <div className="border-b border-line bg-paper-2/60 px-5 py-4">
        <h2 id="market-h2" className="text-xl font-semibold tracking-tight">
          {M.h2}
        </h2>
        <p className="mt-1 text-sm text-ink-2">{M.lead(n(plan.category.listings), plan.category.label)}</p>
      </div>
      <div className="grid gap-px bg-line lg:grid-cols-3">
        <div className="bg-paper-glow p-5">
          <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{M.band}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
            {inr(p.band[0])}–{inr(p.band[1])}
          </p>
          <p className="mt-1 text-sm font-medium text-accent-strong">{M.tier[p.position]}</p>
          <p className="mt-2 text-xs text-ink-3">{M.comparables(n(p.comparables), n(p.sampleSize))}</p>
          <p className="mt-3 text-sm text-ink-2">{M.range(inr(p.comparablePrice.p25), inr(p.comparablePrice.median), inr(p.comparablePrice.p75))}</p>
          {p.marginAtBand && <p className="mt-1 text-sm text-ink-2">{M.margin(p.marginAtBand[0], p.marginAtBand[1])}</p>}
          {p.floorFor30 && <p className="mt-1 text-sm text-ink-2">{M.floor(inr(p.floorFor30))}</p>}
          {p.warning && <p className="mt-2 text-sm font-medium text-danger">{M.warning[p.warning]}</p>}
          {p.categoryMedianDiscount !== null && <p className="mt-3 text-xs text-ink-3">{M.discount(p.categoryMedianDiscount)}</p>}
        </div>
        <div className="bg-paper-glow p-5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{M.title}</p>
            <CopyButton text={plan.seo.title} label={M.copy} />
          </div>
          <p className="mt-2 font-semibold">{plan.seo.title}</p>
          <p className="mt-1 text-xs text-ink-3">{M.chars(plan.seo.chars, plan.seo.benchmarkChars)}</p>
          {plan.seo.keywordsToConsider.length > 0 && (
            <>
              <p className="mt-4 text-xs text-ink-2">{M.consider}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {plan.seo.keywordsToConsider.map((k) => (
                  <span key={k} className="chip">
                    {k}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="bg-paper-glow p-5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{M.hashtags}</p>
            <CopyButton text={plan.hashtags.join(" ")} label={M.copy} />
          </div>
          <p className="mt-2 text-sm leading-relaxed">{plan.hashtags.join(" ")}</p>
          <p className="mt-4 text-xs font-semibold tracking-wide text-ink-3 uppercase">{M.positioning}</p>
          <p className="mt-1 text-sm">{plan.positioning.statement}</p>
          {plan.positioning.underSupplied.length > 0 && (
            <>
              <p className="mt-3 text-xs text-ink-2">{M.under}</p>
              <ul className="mt-1.5 space-y-1 text-sm">
                {plan.positioning.underSupplied.slice(0, 4).map((u) => (
                  <li key={`${u.attribute}-${u.value}`} className="flex justify-between gap-3">
                    <span>
                      {u.value} <span className="text-ink-3">· {t.market.attrs[u.attribute]}</span>
                    </span>
                    <span className="tabular-nums text-good">{M.lift(u.lift)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
