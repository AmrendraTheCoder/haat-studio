import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CopyButton, PrintButton, UseForPosts } from "@/components/research/ReportActions";
import { StudioHeader } from "@/components/site/site";
import { inr } from "@/lib/posts/spec";
import { readReport } from "@/lib/research/build";
import { CATEGORIES, CHANNELS, GOALS } from "@/lib/research/schema";
import { readSetup } from "@/lib/site";

export const metadata: Metadata = { title: "Market research" };

const FORMAT_ICON = { reel: "▶", carousel: "▦", post: "▢", story: "◷" } as const;

export default async function ReportPage({ params }: PageProps<"/research/[id]">) {
  await connection();
  const { id } = await params;
  const [report, setup] = await Promise.all([readReport(id), readSetup()]);
  if (!report) notFound();

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
          <Link href="/research" className="text-sm text-ink-2 hover:text-ink">
            ← Edit answers
          </Link>
          <PrintButton />
        </div>

        <p className="kicker mt-6">Market research · {new Date(report.createdAt).toLocaleDateString("en-IN", { dateStyle: "long" })}</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.05em] sm:text-5xl">
          {a.shopName || a.product}
          <span className="text-ink-3">, {a.city}.</span>
        </h1>
        <p className="mt-2 text-ink-2">
          {a.product} · {CATEGORIES[a.category]} · ₹{a.priceMin.toLocaleString("en-IN")}–{a.priceMax.toLocaleString("en-IN")} · {a.channels.map((c) => CHANNELS[c]).join(", ")} · Goal: {GOALS[a.goal].toLowerCase()}
        </p>

        <div className={`mt-5 rounded-xl border px-4 py-3 text-sm ${ai ? "border-line bg-paper-glow" : "border-marigold/50 bg-[oklch(93%_0.06_80)]"}`}>
          {ai ? (
            <>
              <strong>Written by AI ({report.via})</strong> from general knowledge — it has no live internet access. Treat it as informed suggestions and
              check prices and trends against what you see in your market. The numbers and dates marked <em>calculated</em> are exact.
            </>
          ) : (
            <>
              <strong>Starter plan — no AI was available,</strong> so nothing below is market research. It&rsquo;s a week of posts and basics built from
              your answers. Add a free <code className="font-mono">GROQ_API_KEY</code> and run it again for tailored research.
            </>
          )}
        </div>

        <section className="mt-8">
          <p className="text-lg leading-relaxed">{f.summary}</p>
        </section>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <section className="card p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold">Your numbers</h2>
              <span className="chip">calculated</span>
            </div>
            {money.perPiece ? (
              <dl className="mt-4 grid grid-cols-2 gap-3">
                <Stat label={`Profit at ${inr(a.priceMin)}`} value={inr(money.perPiece.atMin)} sub={`${money.perPiece.marginMinPct}% margin`} bad={money.perPiece.atMin <= 0} />
                <Stat label={`Profit at ${inr(a.priceMax)}`} value={inr(money.perPiece.atMax)} sub={`${money.perPiece.marginMaxPct}% margin`} bad={money.perPiece.atMax <= 0} />
              </dl>
            ) : null}
            {money.warnings.map((w) => (
              <p key={w} className="mt-3 text-sm text-ink-2">
                ⚠ {w}
              </p>
            ))}
          </section>

          <section className="card p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold">Selling days coming up</h2>
              <span className="chip">calculated</span>
            </div>
            {moments.length ? (
              <ul className="mt-3 space-y-2.5">
                {moments.map((m) => (
                  <li key={m.date} className="flex gap-3 text-sm">
                    <span className="w-16 shrink-0 font-mono text-xs text-ink-3">{m.daysAway === 0 ? "today" : `in ${m.daysAway}d`}</span>
                    <span>
                      <strong>{m.name}</strong> — {new Date(`${m.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}. {m.note}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink-2">No fixed-date selling days in the next ten weeks.</p>
            )}
          </section>
        </div>

        <section className="card mt-4 p-5">
          <h2 className="text-lg font-bold">Who buys</h2>
          <p className="mt-2">{f.audience.persona}</p>
          <p className="mt-2 text-sm text-ink-2">
            <strong className="text-ink">Where they find products:</strong> {f.audience.whereTheyAre}
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
          <h2 className="text-2xl font-extrabold tracking-tight">{ai ? "What's working now" : "Two things to start with"}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {f.trends.map((t) => (
              <div key={t.name} className="card p-5">
                <p className="font-bold">{t.name}</p>
                <p className="mt-1 text-sm text-ink-2">{t.why}</p>
                <p className="mt-3 text-sm">
                  <strong>This week:</strong> {t.action}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="card mt-8 p-5">
          <h2 className="text-lg font-bold">Pricing</h2>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">
            {inr(f.pricing.minRupees)}–{inr(f.pricing.maxRupees)}
            <span className="ml-2 align-middle text-sm font-normal text-ink-3">yours today: {inr(a.priceMin)}–{inr(a.priceMax)}</span>
          </p>
          <p className="mt-2 text-sm text-ink-2">{f.pricing.reasoning}</p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-extrabold tracking-tight">This week&rsquo;s posts</h2>
          <ol className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper-2">
            {f.weekPlan.map((d) => (
              <li key={d.day} className="flex items-start gap-4 px-5 py-3">
                <span className="w-10 shrink-0 font-mono text-sm font-medium">{d.day}</span>
                <span className="w-24 shrink-0 text-xs text-ink-3">
                  {FORMAT_ICON[d.format]} {d.format}
                </span>
                <span className="text-sm">{d.idea}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-extrabold tracking-tight">Content ideas</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {f.contentIdeas.map((c) => (
              <div key={c.title} className="rounded-xl border border-line bg-paper-glow p-4">
                <p className="text-xs text-ink-3">
                  {FORMAT_ICON[c.format]} {c.format}
                </p>
                <p className="mt-1 font-semibold">{c.title}</p>
                <p className="mt-1 text-sm text-ink-2">Hook: “{c.hook}”</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card mt-8 p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">Hashtags</h2>
            <CopyButton text={allTags.join(" ")} label="Copy all" />
          </div>
          {(["broad", "niche", "local"] as const).map((k) =>
            f.hashtags[k].length ? (
              <p key={k} className="mt-3 text-sm">
                <span className="mr-2 font-mono text-[11px] text-ink-3 uppercase">{k}</span>
                {f.hashtags[k].join(" ")}
              </p>
            ) : null,
          )}
        </section>

        {f.watchOuts.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold">Watch out for</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
              {f.watchOuts.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-12 flex flex-wrap items-center gap-3 rounded-3xl border border-line bg-paper-3 p-6 print:hidden">
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold">Next: make this week&rsquo;s first post.</p>
            <p className="text-sm text-ink-2">Captions will use this research — your buyers, your hashtags.</p>
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
