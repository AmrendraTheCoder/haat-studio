import Link from "next/link";
import { connection } from "next/server";
import { BeforeAfter } from "@/components/shared/BeforeAfter";
import { Placeholder } from "@/components/shared/Placeholder";
import { ScrollingStrip, SiteFooter, SiteNav, WaveBorder } from "@/components/site/site";
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
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 md:pt-20 lg:grid-cols-[1.15fr_1fr]">
        <div className="rise">
          <p className="kicker">{H.kicker}</p>
          <h1 className="mt-5 font-extrabold leading-[0.88] tracking-[-0.07em]" style={{ fontSize: "var(--text-mega)" }}>
            <span className="block">{H.h1a}</span>
            <span className="block text-ink-2">{H.h1b}</span>
          </h1>
          <p className="mt-7 max-w-lg text-lg text-ink-2">
            {H.lead}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/studio" className="btn-primary !px-6 !py-3 !text-base">
              {H.tryFree} <span aria-hidden>→</span>
            </Link>
            <Link href="/#how" className="btn-ghost !px-6 !py-3 !text-base">
              {H.seeHow}
            </Link>
          </div>
          <p className="mt-5 text-xs text-ink-3">{H.freeLine}</p>
        </div>

        <HeroShowcase hero={hero} setup={setup} t={t} />
      </section>

      <WaveBorder />
      <section className="border-y border-line bg-paper-2 py-5">
        <ScrollingStrip items={H.ticker} className="font-display text-2xl font-bold tracking-tight sm:text-3xl" />
      </section>
      <WaveBorder flip />

      {/* ── How it works ── */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <p className="kicker">{H.how.kicker}</p>
        <h2 className="mt-3 font-extrabold tracking-[-0.05em]" style={{ fontSize: "var(--text-giant)" }}>
          {H.how.title}
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          <StepCard n="01" {...H.how.steps[0]}>
            <SampleThumb setup={setup} t={t} />
          </StepCard>
          <StepCard n="02" {...H.how.steps[1]}>
            <div className="grid h-full grid-cols-3 gap-2 p-3">
              {PRESETS.map((p) =>
                setup.presets.includes(p.id) ? (
                  <img key={p.id} src={`/presets/${p.file}`} alt={presetLabel(p.id, p.label)} className="size-full rounded-lg object-cover" />
                ) : (
                  <Placeholder key={p.id} title={H.hero.model} className="size-full !p-2" />
                ),
              )}
            </div>
          </StepCard>
          <StepCard n="03" {...H.how.steps[2]}>
            <SizesDiagram labels={H.how.sizes} />
          </StepCard>
        </div>
      </section>

      {/* ── Tools ── */}
      <section id="tools" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12 sm:px-6">
        <p className="kicker">{H.tools.kicker}</p>
        <h2 className="mt-3 font-extrabold tracking-[-0.05em]" style={{ fontSize: "var(--text-giant)" }}>
          {H.tools.title}
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {H.tools.items.map((tool, i) => (
            <Link key={tool.title} href={TOOL_HREFS[i]} className="card group flex flex-col p-6 transition-transform hover:-translate-y-1">
              <span className="font-mono text-xs text-ink-3">{tool.kicker}</span>
              <span className="mt-2 text-2xl font-bold tracking-tight">{tool.title}</span>
              <span className="mt-2 flex-1 text-sm text-ink-2">{tool.body}</span>
              <span className="mt-5 text-sm font-semibold group-hover:underline">{tool.cta} →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Examples ── */}
      <section id="examples" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kicker">{H.examples.kicker}</p>
            <h2 className="mt-3 font-extrabold tracking-[-0.05em]" style={{ fontSize: "var(--text-giant)" }}>
              {H.examples.title}
            </h2>
          </div>
          <p className="max-w-sm text-sm text-ink-3">{H.examples.note}</p>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3">
          {featured.length > 0
            ? featured.slice(0, 6).map((r) => <ExampleCard key={r.key} r={r} t={t} />)
            : [0, 1, 2].map((i) => (
                <Placeholder key={i} title={H.examples.slot(i + 1)} className="aspect-[4/3]">
                  {H.examples.slotBody}
                </Placeholder>
              ))}
        </div>
      </section>

      {/* ── Under the hood ── */}
      <section id="under-the-hood" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <p className="kicker">{H.hood.kicker}</p>
        <h2 className="mt-3 font-extrabold tracking-[-0.05em]" style={{ fontSize: "var(--text-giant)" }}>
          {H.hood.title}
        </h2>
        <div className="mt-12 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <ol className="card divide-y divide-line">
            {H.hood.pipeline.map((s, i) => (
              <li key={s.title} className="flex gap-4 p-5">
                <span className="font-mono text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="mt-1 text-sm text-ink-2">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <CostCard setup={setup} t={t} />
        </div>
      </section>

      {/* ── What's next ── */}
      <section id="next" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12 sm:px-6">
        <p className="kicker">{H.next.kicker}</p>
        <h2 className="mt-3 font-extrabold tracking-[-0.05em]" style={{ fontSize: "var(--text-giant)" }}>
          {H.next.title}
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROADMAP.map((status, i) => (
            <div key={i} className={`card p-5 ${status === "now" ? "!border-ink !bg-paper-glow" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-ink-3">{H.next.phase(i + 1)}</span>
                <span className={`chip ${status === "now" ? "!border-ink !text-ink" : ""}`}>{H.next.status[status]}</span>
              </div>
              <p className="mt-3 text-lg font-bold tracking-tight">{H.next.roadmap[i].title}</p>
              <p className="mt-1.5 text-sm text-ink-2">{H.next.roadmap[i].body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Close ── */}
      <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <div className="rounded-3xl border border-line bg-paper-3 px-6 py-16 text-center">
          <h2 className="font-extrabold tracking-[-0.05em]" style={{ fontSize: "var(--text-giant)" }}>
            {H.close.a}
            <br />
            {H.close.b}
          </h2>
          <Link href="/studio" className="btn-primary mt-8 !px-6 !py-3 !text-base">
            {H.close.cta} <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function HeroShowcase({ hero, setup, t }: { hero: ResultMeta | undefined; setup: Setup; t: Messages }) {
  const h = t.home.hero;
  if (hero) {
    return (
      <figure className="rise mx-auto w-full max-w-sm">
        <div className="relative">
          <BeforeAfter
            before={resultUrl(hero.key, "person.jpg")}
            after={resultUrl(hero.key, "result.png")}
            className="aspect-[2/3] rounded-3xl border border-line shadow-xl"
          />
          <div className="pointer-events-none absolute -bottom-5 -left-5 w-28 rotate-[-4deg] rounded-2xl border border-line bg-paper-glow p-2 shadow-lg">
            <img src={resultUrl(hero.key, "garment.jpg")} alt={h.productAlt} className="aspect-square w-full rounded-lg object-contain" />
            <p className="mt-1 text-center font-mono text-2xs text-ink-3">{h.productPhoto}</p>
          </div>
        </div>
        <figcaption className="mt-8 text-center text-xs text-ink-3">{h.caption}</figcaption>
      </figure>
    );
  }

  // No result yet: show the real inputs and say plainly that the output is pending.
  const sample = SAMPLE_GARMENTS.find((s) => setup.samples.includes(s.id));
  const preset = PRESETS.find((p) => p.id === sample?.preset && setup.presets.includes(p.id)) ?? PRESETS.find((p) => setup.presets.includes(p.id));
  return (
    <div className="rise mx-auto grid w-full max-w-md grid-cols-[minmax(0,0.7fr)_auto_minmax(0,1.3fr)] items-center gap-3">
      <div className="space-y-3">
        {sample ? (
          <img src={`/samples/${sample.file}`} alt={t.product.samples[sample.id] ?? sample.label} className="aspect-square w-full rounded-2xl border border-line bg-white object-contain p-2" />
        ) : (
          <Placeholder title={h.product} className="aspect-square" />
        )}
        <p className="text-center font-mono text-2xs text-ink-3">{h.yourProduct}</p>
        {preset ? (
          <img src={`/presets/${preset.file}`} alt={t.model.presets[preset.id]?.label ?? preset.label} className="aspect-[3/4] w-full rounded-2xl border border-line object-cover" />
        ) : (
          <Placeholder title={h.model} className="aspect-[3/4]" />
        )}
        <p className="text-center font-mono text-2xs text-ink-3">{h.aModel}</p>
      </div>
      <span className="font-display text-3xl font-bold text-ink-3" aria-hidden>
        →
      </span>
      <Placeholder title={h.result} className="aspect-[2/3]">
        {setup.engine.configured ? h.resultReady : h.resultDemo}
      </Placeholder>
    </div>
  );
}

function StepCard({ n, title, body, children }: { n: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="aspect-[4/3] border-b border-line bg-paper">{children}</div>
      <div className="p-5">
        <span className="font-mono text-xs text-ink-3">{n}</span>
        <h3 className="mt-1.5 text-2xl font-bold">{title}</h3>
        <p className="mt-2 text-sm text-ink-2">{body}</p>
      </div>
    </div>
  );
}

function SampleThumb({ setup, t }: { setup: Setup; t: Messages }) {
  const samples = SAMPLE_GARMENTS.filter((s) => setup.samples.includes(s.id));
  if (samples.length === 0) return <Placeholder title={t.home.hero.productPhoto} className="m-3 h-[calc(100%-1.5rem)]" />;
  return (
    <div className="grid h-full grid-cols-3 gap-2 p-3">
      {samples.map((s) => (
        <img key={s.id} src={`/samples/${s.file}`} alt={t.product.samples[s.id] ?? s.label} className="size-full rounded-lg bg-white object-contain p-1" />
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
    <div className="flex h-full items-end justify-center gap-5 p-5">
      {frames.map((f) => (
        <div key={f.label} className="flex flex-col items-center gap-2">
          <div className="grid place-items-center rounded-lg border-2 border-ink bg-paper-glow" style={{ width: f.w, height: f.h }}>
            <div className="h-3/5 w-2/5 rounded-full bg-paper-3" />
          </div>
          <span className="font-mono text-2xs text-ink-3">{f.label}</span>
        </div>
      ))}
    </div>
  );
}

function ExampleCard({ r, t }: { r: ResultMeta; t: Messages }) {
  const e = t.home.examples;
  return (
    <Link href={`/studio?r=${r.key}`} className="group block" aria-label={e.open}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-line bg-paper-2">
        <img src={resultUrl(r.key, "result.png")} alt={e.resultAlt} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        <img
          src={resultUrl(r.key, "garment.jpg")}
          alt={e.productAlt}
          loading="lazy"
          className="absolute right-2 bottom-2 size-14 rounded-xl border border-line bg-white object-contain p-1 shadow"
        />
      </div>
    </Link>
  );
}

function CostCard({ setup, t }: { setup: Setup; t: Messages }) {
  const h = t.home.hood;
  return (
    <div className="card flex flex-col p-6">
      <p className="kicker">{h.costKicker}</p>
      <p className="mt-3 font-display text-7xl font-extrabold tracking-[-0.05em]">₹0</p>
      <dl className="mt-5 space-y-3 text-sm">
        {h.costRows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-line pb-2.5 last:border-0">
            <dt className="text-ink-3">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p className={`mt-auto pt-5 text-xs ${setup.engine.configured ? "text-good" : "text-ink-3"}`}>
        ● {h.server(setup.engine.configured)}
      </p>
    </div>
  );
}

/** Status per phase, in roadmap order; the words live in the dictionary. */
const ROADMAP: ("done" | "now" | "planned")[] = ["done", "done", "now", "done", "done", "done"];

const TOOL_HREFS = ["/studio", "/studio", "/research"];
