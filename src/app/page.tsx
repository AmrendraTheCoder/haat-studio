import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { BeforeAfter } from "@/components/shared/BeforeAfter";
import { Placeholder } from "@/components/shared/Placeholder";
import { SiteFooter, SiteNav } from "@/components/site/site";
import { resultUrl } from "@/lib/client/check";
import type { Messages } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/server";
import { PRESETS, SAMPLE_GARMENTS } from "@/lib/presets";
import { readFeatured, readSetup, type Setup } from "@/lib/site";
import type { ResultMeta } from "@/lib/tryon/types";

export default async function Landing() {
  await connection();
  const [setup, featured, { t }] = await Promise.all([readSetup(), readFeatured(), getMessages()]);
  const hero = featured[0];
  const H = t.home;
  const presetLabel = (id: string, fallback: string) => t.model.presets[id]?.label ?? fallback;

  return (
    <main className="overflow-x-clip">
      <SiteNav />

      {/* ── Hero ── */}
      <section className="relative">
        <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_70%_40%,black,transparent_70%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pt-12 pb-20 sm:px-6 md:pt-20 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
          <div className="rise">
            <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-paper-glow px-3 py-1.5 text-xs font-medium text-ink-2 shadow-[var(--shadow-card)]">
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent-strong" />
              <span>{H.kicker}</span>
            </p>
            <h1 className="mt-6 font-bold tracking-[-0.01em]" style={{ fontSize: "var(--text-display)", lineHeight: 1.02 }}>
              <span className="block">{H.h1a}</span>
              <span className="block text-accent-strong">{H.h1b}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">{H.lead}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/studio" className="btn-primary !px-6 !py-3 !text-base">
                {H.tryFree} <span aria-hidden>→</span>
              </Link>
              <Link href="/#how" className="btn-ghost !px-6 !py-3 !text-base">
                {H.seeHow}
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-3">
              {H.freeLine.split(" · ").map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-good" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <HeroShowcase hero={hero} setup={setup} t={t} />
        </div>
      </section>

      {/* ── What you get, at a glance ── */}
      <section aria-label={H.how.kicker} className="border-y border-line bg-paper-glow">
        <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-3 px-4 py-6 text-sm font-medium text-ink-2 sm:grid-cols-3 sm:px-6 lg:grid-cols-6">
          {H.ticker.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-wash text-accent-strong">
                <Check className="size-3.5" />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* ── How it works ── */}
      <Section id="how" kicker={H.how.kicker} title={H.how.title}>
        <div className="grid gap-5 md:grid-cols-3">
          <StepCard n={1} {...H.how.steps[0]}>
            <SampleThumb setup={setup} t={t} />
          </StepCard>
          <StepCard n={2} {...H.how.steps[1]}>
            <div className="grid h-full grid-cols-3 gap-2 p-4">
              {PRESETS.map((p) =>
                setup.presets.includes(p.id) ? (
                  <img key={p.id} src={`/presets/${p.file}`} alt={presetLabel(p.id, p.label)} className="size-full rounded-lg object-cover" />
                ) : (
                  <Placeholder key={p.id} title={H.hero.model} className="size-full !p-2" />
                ),
              )}
            </div>
          </StepCard>
          <StepCard n={3} {...H.how.steps[2]}>
            <SizesDiagram labels={H.how.sizes} />
          </StepCard>
        </div>
      </Section>

      {/* ── Photo → post → plan ── */}
      <Section id="tools" kicker={H.tools.kicker} title={H.tools.title} tint>
        <div className="grid gap-5 lg:grid-cols-3">
          <ToolCard href={TOOL_HREFS[0]} tool={H.tools.items[0]} n={1}>
            {hero ? (
              <div className="grid h-full grid-cols-[1fr_auto_1.2fr] items-center gap-3 p-5">
                <img src={resultUrl(hero.key, "garment.jpg")} alt={H.hero.productAlt} className="aspect-square w-full rounded-xl border border-line bg-paper-glow object-contain p-2" />
                <Arrow />
                <img src={resultUrl(hero.key, "result.png")} alt={H.examples.resultAlt} className="aspect-[3/4] w-full rounded-xl object-cover shadow-[var(--shadow-raised)]" />
              </div>
            ) : (
              <Placeholder title={H.hero.result} className="m-5 h-[calc(100%-2.5rem)]">
                {setup.engine.configured ? H.hero.resultReady : H.hero.resultDemo}
              </Placeholder>
            )}
          </ToolCard>
          <ToolCard href={TOOL_HREFS[1]} tool={H.tools.items[1]} n={2}>
            {hero ? (
              <figure className="flex h-full flex-col items-center justify-center gap-2 p-5">
                <img src={resultUrl(hero.key, "post.jpg")} alt={H.tools.postExport} className="min-h-0 flex-1 rounded-lg object-contain shadow-[var(--shadow-raised)]" />
                <figcaption className="text-2xs text-ink-3">{H.tools.postExport}</figcaption>
              </figure>
            ) : (
              <Placeholder title={H.tools.items[1].title} className="m-5 h-[calc(100%-2.5rem)]" />
            )}
          </ToolCard>
          <ToolCard href={TOOL_HREFS[2]} tool={H.tools.items[2]} n={3}>
            <div className="flex h-full flex-col justify-center px-5 py-4">
              <p className="text-2xs font-semibold tracking-[0.08em] text-ink-3 uppercase">{H.tools.planPreview}</p>
              <ul className="mt-2 space-y-1.5">
                {[t.report.whoBuys, t.report.pricing, t.report.weekPosts, t.report.moments, t.report.hashtags].map((label, i) => (
                  <li key={label} className="flex items-center gap-3 rounded-lg border border-line bg-paper-glow px-3 py-1.5 text-sm">
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-wash text-2xs font-semibold text-accent-strong">{i + 1}</span>
                    <span className="font-medium">{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ToolCard>
        </div>
      </Section>

      {/* ── Examples ── */}
      <Section id="examples" kicker={H.examples.kicker} title={H.examples.title} aside={H.examples.note}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {featured.length > 0
            ? featured.slice(0, 6).map((r) => <ExampleCard key={r.key} r={r} t={t} />)
            : [0, 1, 2].map((i) => (
                <Placeholder key={i} title={H.examples.slot(i + 1)} className="aspect-[4/3]">
                  {H.examples.slotBody}
                </Placeholder>
              ))}
        </div>
      </Section>

      {/* ── Under the hood ── */}
      <Section id="under-the-hood" kicker={H.hood.kicker} title={H.hood.title} tint>
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <ol className="card p-2">
            {H.hood.pipeline.map((s, i) => (
              <li key={s.title} className="relative flex gap-4 rounded-xl p-4">
                {i < H.hood.pipeline.length - 1 && <span aria-hidden className="absolute top-12 bottom-0 left-[1.95rem] w-px bg-line" />}
                <span className="relative grid size-8 shrink-0 place-items-center rounded-full border border-line bg-paper-2 text-xs font-semibold text-ink-2 tabular-nums">
                  {i + 1}
                </span>
                <div className="pt-1">
                  <p className="font-semibold">{s.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <CostCard setup={setup} t={t} />
        </div>
      </Section>

      {/* ── What's next ── */}
      <Section id="next" kicker={H.next.kicker} title={H.next.title}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROADMAP.map((status, i) => (
            <div key={i} className={`card p-5 ${status === "now" ? "!border-accent-strong/40 ring-1 ring-accent-strong/20" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-ink-3">{H.next.phase(i + 1)}</span>
                <span
                  className={`chip ${status === "done" ? "!border-good/30 !bg-good-wash !text-good" : status === "now" ? "!border-accent-strong/30 !bg-accent-wash !text-accent-strong" : ""}`}
                >
                  {status === "done" && <Check className="size-3.5" />}
                  {H.next.status[status]}
                </span>
              </div>
              <p className="mt-3 text-lg font-semibold tracking-tight">{H.next.roadmap[i].title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{H.next.roadmap[i].body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Close ── */}
      <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-16 text-center text-paper sm:py-20">
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-accent/25 blur-3xl" />
          <h2 className="relative h-section">
            {H.close.a}
            <br />
            <span className="text-accent-wash">{H.close.b}</span>
          </h2>
          <Link href="/studio" className="btn-light relative mt-8 !px-6 !py-3 !text-base">
            {H.close.cta} <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function Section({ id, kicker, title, aside, tint = false, children }: { id: string; kicker: string; title: string; aside?: string; tint?: boolean; children: ReactNode }) {
  return (
    <section id={id} className={`scroll-mt-20 py-20 sm:py-24 ${tint ? "border-y border-line bg-paper-2/60" : ""}`}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="kicker">{kicker}</p>
            <h2 className="mt-3 h-section">{title}</h2>
          </div>
          {aside && <p className="max-w-sm text-sm leading-relaxed text-ink-3">{aside}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

function Check({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="m5 10.5 3.2 3L15 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 text-ink-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 12h14m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HeroShowcase({ hero, setup, t }: { hero: ResultMeta | undefined; setup: Setup; t: Messages }) {
  const h = t.home.hero;
  if (hero) {
    return (
      <figure className="rise mx-auto w-full max-w-[22rem] [animation-delay:80ms] sm:max-w-sm">
        <div className="relative">
          <div className="rounded-[1.75rem] border border-line bg-paper-glow p-2 shadow-[var(--shadow-float)]">
            <BeforeAfter before={resultUrl(hero.key, "person.jpg")} after={resultUrl(hero.key, "result.png")} className="aspect-[2/3] rounded-[1.35rem]" />
          </div>
          <div className="pointer-events-none absolute -bottom-6 -left-4 w-28 rounded-2xl border border-line bg-paper-glow p-2 shadow-[var(--shadow-raised)] sm:-left-10 sm:w-32">
            <img src={resultUrl(hero.key, "garment.jpg")} alt={h.productAlt} className="aspect-square w-full rounded-lg object-contain" />
            <p className="mt-1 text-center text-2xs font-medium text-ink-3">{h.productPhoto}</p>
          </div>
        </div>
        <figcaption className="mt-10 text-center text-xs text-ink-3">{h.caption}</figcaption>
      </figure>
    );
  }

  // No result yet: show the real inputs and say plainly that the output is pending.
  const sample = SAMPLE_GARMENTS.find((s) => setup.samples.includes(s.id));
  const preset = PRESETS.find((p) => p.id === sample?.preset && setup.presets.includes(p.id)) ?? PRESETS.find((p) => setup.presets.includes(p.id));
  return (
    <div className="rise mx-auto grid w-full max-w-md grid-cols-[minmax(0,0.7fr)_auto_minmax(0,1.3fr)] items-center gap-3">
      <div className="space-y-2">
        {sample ? (
          <img src={`/samples/${sample.file}`} alt={t.product.samples[sample.id] ?? sample.label} className="aspect-square w-full rounded-2xl border border-line bg-paper-glow object-contain p-2" />
        ) : (
          <Placeholder title={h.product} className="aspect-square" />
        )}
        <p className="text-center text-2xs text-ink-3">{h.yourProduct}</p>
        {preset ? (
          <img src={`/presets/${preset.file}`} alt={t.model.presets[preset.id]?.label ?? preset.label} className="aspect-[3/4] w-full rounded-2xl border border-line object-cover" />
        ) : (
          <Placeholder title={h.model} className="aspect-[3/4]" />
        )}
        <p className="text-center text-2xs text-ink-3">{h.aModel}</p>
      </div>
      <Arrow />
      <Placeholder title={h.result} className="aspect-[2/3]">
        {setup.engine.configured ? h.resultReady : h.resultDemo}
      </Placeholder>
    </div>
  );
}

function StepCard({ n, title, body, children }: { n: number; title: string; body: string; children: ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden border-b border-line bg-paper-2">
        <div className="absolute inset-0">{children}</div>
      </div>
      <div className="p-6">
        <span className="grid size-7 place-items-center rounded-full bg-ink text-xs font-semibold text-paper">{n}</span>
        <h3 className="mt-4 text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
      </div>
    </div>
  );
}

function ToolCard({ href, tool, n, children }: { href: string; tool: { kicker: string; title: string; body: string; cta: string }; n: number; children: ReactNode }) {
  return (
    <Link href={href} className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-[var(--shadow-raised)]">
      <div className="relative aspect-[4/3] overflow-hidden border-b border-line bg-paper-2">
        <div className="absolute inset-0">{children}</div>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-full bg-accent-strong text-xs font-semibold text-paper-glow">{n}</span>
          <span className="text-xs font-medium text-ink-3">{tool.kicker}</span>
        </div>
        <h3 className="mt-4 text-xl font-semibold tracking-tight">{tool.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-2">{tool.body}</p>
        <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-accent-strong">
          {tool.cta} <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
        </span>
      </div>
    </Link>
  );
}

function SampleThumb({ setup, t }: { setup: Setup; t: Messages }) {
  const samples = SAMPLE_GARMENTS.filter((s) => setup.samples.includes(s.id));
  if (samples.length === 0) return <Placeholder title={t.home.hero.productPhoto} className="m-4 h-[calc(100%-2rem)]" />;
  return (
    <div className="grid h-full grid-cols-3 gap-2 p-4">
      {samples.map((s) => (
        <img key={s.id} src={`/samples/${s.file}`} alt={t.product.samples[s.id] ?? s.label} className="size-full rounded-lg border border-line bg-paper-glow object-contain p-1.5" />
      ))}
    </div>
  );
}

/** A diagram of the three export frames — outlines, not a picture of a result. */
function SizesDiagram({ labels }: { labels: string[] }) {
  const frames = [
    { label: labels[0], w: 64, h: 80 },
    { label: labels[1], w: 72, h: 72 },
    { label: labels[2], w: 54, h: 96 },
  ];
  return (
    <div className="flex h-full items-end justify-center gap-5 p-6">
      {frames.map((f) => (
        <div key={f.label} className="flex flex-col items-center gap-2">
          <div className="grid place-items-center rounded-lg border-2 border-ink-3 bg-paper-glow shadow-[var(--shadow-card)]" style={{ width: f.w, height: f.h }}>
            <div className="h-3/5 w-2/5 rounded-full bg-accent-wash" />
          </div>
          <span className="text-2xs font-medium text-ink-3">{f.label}</span>
        </div>
      ))}
    </div>
  );
}

function ExampleCard({ r, t }: { r: ResultMeta; t: Messages }) {
  const e = t.home.examples;
  return (
    <Link href={`/studio?r=${r.key}`} className="group block" aria-label={e.open}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-line bg-paper-2 shadow-[var(--shadow-card)] transition-shadow group-hover:shadow-[var(--shadow-raised)]">
        <img src={resultUrl(r.key, "result.png")} alt={e.resultAlt} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        <img
          src={resultUrl(r.key, "garment.jpg")}
          alt={e.productAlt}
          loading="lazy"
          className="absolute right-3 bottom-3 size-16 rounded-xl border border-line bg-paper-glow object-contain p-1 shadow-[var(--shadow-raised)]"
        />
      </div>
    </Link>
  );
}

function CostCard({ setup, t }: { setup: Setup; t: Messages }) {
  const h = t.home.hood;
  return (
    <div className="card flex flex-col p-6">
      <p className="text-xs font-semibold tracking-[0.08em] text-ink-3 uppercase">{h.costKicker}</p>
      <p className="mt-2 text-6xl font-bold tracking-[-0.01em] text-ink">₹0</p>
      <dl className="mt-6 divide-y divide-line text-sm">
        {h.costRows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2.5">
            <dt className="text-ink-3">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p className={`mt-auto inline-flex items-center gap-2 pt-5 text-xs font-medium ${setup.engine.configured ? "text-good" : "text-ink-3"}`}>
        <span className={`size-2 rounded-full ${setup.engine.configured ? "bg-good" : "bg-marigold"}`} />
        {h.server(setup.engine.configured)}
      </p>
    </div>
  );
}

/** Status per phase, in roadmap order; the words live in the dictionary. */
const ROADMAP: ("done" | "now" | "planned")[] = ["done", "done", "now", "done", "done", "done"];

const TOOL_HREFS = ["/studio", "/studio", "/research"];
