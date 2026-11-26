"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BeforeAfter } from "@/components/shared/BeforeAfter";
import { HelpTip } from "@/components/shared/HelpTip";
import { resultUrl } from "@/lib/client/check";
import { canShareFiles, shareImage } from "@/lib/client/share";
import { TEST_ENGINES } from "@/lib/engines";
import { useI18n } from "@/lib/i18n/client";
import { EXPORT_SIZES, type ExportSize } from "@/lib/limits";
import type { QuotaStatus } from "@/lib/quota";
import type { OutputQuality, ResultMeta } from "@/lib/tryon/types";
import { checkState, formatMeasure, summariseQuality } from "@/lib/ui/results";
import { Lightbox, Notice, QuotaMeter } from "./parts";
import { MadeWith, Pipeline } from "./Pipeline";
import type { Run, View } from "./types";

export function ResultStep({
  run,
  curation,
  featured,
  onFeature,
  onVariation,
  onAnotherModel,
  onNewProduct,
  onRetry,
  onReconnect,
  onGo,
  quota,
}: {
  run: Exclude<Run, { phase: "idle" }>;
  /** Free GPU time left; shown after a quota refusal and under a finished photo. */
  quota: QuotaStatus | null;
  curation: boolean;
  featured: string[];
  onFeature: (key: string, on: boolean) => Promise<string | null>;
  onVariation: (r: ResultMeta) => void;
  onAnotherModel: (r: ResultMeta) => void;
  onNewProduct: () => void;
  onRetry: (() => void) | null;
  onReconnect: (() => void) | null;
  onGo: (v: View) => void;
}) {
  const { t } = useI18n();
  const r = t.result;
  if (run.phase === "working") {
    return (
      <Layout
        visual={
          <div className="relative">
            <div className="rounded-[1.75rem] border border-line bg-paper-glow p-2 shadow-[var(--shadow-raised)]">
            <div className="scan relative aspect-[2/3] overflow-hidden rounded-[1.35rem] bg-paper-3">
              {run.personPreview ? (
                <img src={run.personPreview} alt={r.workingAlt} className="size-full object-cover opacity-75" />
              ) : (
                <div className="skeleton size-full" />
              )}
            </div>
            </div>
            {run.garmentPreview && <ProductChip src={run.garmentPreview} />}
          </div>
        }
      >
        <div className="card p-5">
          <Pipeline log={run.log} startedAt={run.startedAt} settings={run.settings} live />
          <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-ink-3">{r.safeToLeave}</p>
        </div>
      </Layout>
    );
  }

  if (run.phase === "error") {
    return (
      <Layout
        visual={
          <div className="grid aspect-[4/3] place-items-center rounded-[1.75rem] border border-danger/25 bg-danger-wash p-8 text-center lg:aspect-[3/4]">
            <div>
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-paper-glow text-2xl font-bold text-danger shadow-[var(--shadow-card)]">!</span>
              <p className="mt-4 text-lg font-semibold">{r.errorTitles[run.kind]}</p>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <Notice tone="error">{run.message}</Notice>
          <div className="flex flex-wrap gap-2">
            {run.kind === "input" && (
              <>
                <button type="button" className="btn-primary" onClick={() => onGo(/model photo|मॉडल/i.test(run.message) ? "model" : "product")}>
                  {/model photo|मॉडल/i.test(run.message) ? r.changeModel : r.changeProduct}
                </button>
              </>
            )}
            {run.kind === "offline" && onReconnect && (
              <button type="button" className="btn-primary" onClick={onReconnect}>
                {r.reconnect}
              </button>
            )}
            {(run.kind === "quota" || run.kind === "other" || (run.kind === "offline" && !onReconnect)) && onRetry && (
              <button type="button" className="btn-primary" onClick={onRetry}>
                {r.tryAgain}
              </button>
            )}
            {run.kind === "quota" && (
              <a href="#recent" className="btn-ghost">
                {r.openSaved}
              </a>
            )}
            <button type="button" className="btn-ghost" onClick={onNewProduct}>
              {r.startNew}
            </button>
          </div>
          {run.kind === "quota" && quota && <QuotaMeter quota={quota} />}
          {run.log.length > 0 && (
            <div className="card p-5">
              <Pipeline log={run.log} startedAt={run.startedAt} settings={null} live={false} failed />
            </div>
          )}
          {run.attempts.length > 0 && (
            <details className="text-xs text-ink-3">
              <summary className="inline-flex min-h-11 cursor-pointer items-center select-none">{r.technical}</summary>
              <ul className="mt-2 space-y-1.5">
                {run.attempts.map((a, i) => (
                  <li key={i} className="rounded-lg border border-line bg-paper-2 p-2 font-mono break-words">
                    {a.engine} [{a.kind}] {a.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Done
      run={run}
      curation={curation}
      featured={featured.includes(run.result.key)}
      onFeature={onFeature}
      onVariation={onVariation}
      onAnotherModel={onAnotherModel}
      onNewProduct={onNewProduct}
      quota={quota}
    />
  );
}

function Layout({ visual, children }: { visual: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rise grid items-start gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-10 2xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-md lg:sticky lg:top-24 lg:max-w-none">{visual}</div>
      <div>{children}</div>
    </div>
  );
}

function ProductChip({ src }: { src: string }) {
  const { t } = useI18n();
  return (
    <div className="pointer-events-none absolute -bottom-5 -left-3 w-24 rounded-xl border border-line bg-paper-glow p-1.5 shadow-[var(--shadow-raised)] sm:-left-6">
      <img src={src} alt={t.result.productAlt} className="aspect-square w-full object-contain" />
      <p className="mt-0.5 text-center text-2xs font-medium text-ink-3">{t.result.productChip}</p>
    </div>
  );
}

function Done({
  run,
  curation,
  featured,
  onFeature,
  onVariation,
  onAnotherModel,
  onNewProduct,
  quota,
}: {
  run: Extract<Run, { phase: "done" }>;
  quota: QuotaStatus | null;
  curation: boolean;
  featured: boolean;
  onFeature: (key: string, on: boolean) => Promise<string | null>;
  onVariation: (r: ResultMeta) => void;
  onAnotherModel: (r: ResultMeta) => void;
  onNewProduct: () => void;
}) {
  const { t } = useI18n();
  const x = t.result;
  const r = run.result;
  const [full, setFull] = useState(false);
  const [featureBusy, setFeatureBusy] = useState(false);
  const [featureError, setFeatureError] = useState<string | null>(null);
  const live = run.log.some((l) => l.e.type === "accepted");
  const startedAt = run.log[0]?.at ?? 0;
  const heading = useRef<HTMLHeadingElement>(null);
  const [shareable, setShareable] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);

  // Keyboard and screen-reader users land on the result, not on whatever
  // button they last pressed several screens ago.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection needs the browser
    setShareable(canShareFiles());
  }, [r.key]);

  async function share() {
    setShareNote(null);
    const res = await fetch(resultUrl(r.key, "post.jpg")).catch(() => null);
    if (!res?.ok) return setShareNote(x.sharePrepFailed);
    const outcome = await shareImage(await res.blob(), `haat-${r.key.slice(0, 8)}-post.jpg`);
    if (outcome === "failed") setShareNote(x.shareFailed);
  }

  return (
    <Layout
      visual={
        <>
          <div className="relative">
            <div className="rounded-[1.75rem] border border-line bg-paper-glow p-2 shadow-[var(--shadow-float)]">
              <BeforeAfter before={resultUrl(r.key, "person.jpg")} after={resultUrl(r.key, "result.png")} className="aspect-[2/3] rounded-[1.35rem]" />
            </div>
            <ProductChip src={resultUrl(r.key, "garment.jpg")} />
            <button
              type="button"
              onClick={() => setFull(true)}
              className="absolute right-5 bottom-5 min-h-11 rounded-lg bg-paper-glow/90 px-4 py-1.5 text-xs font-semibold text-ink shadow-[var(--shadow-raised)] ring-1 ring-line backdrop-blur hover:bg-paper-glow"
            >
              {x.fullScreen}
            </button>
          </div>
          <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-ink-3">
            {x.dragHint} <HelpTip topic="compare" />
          </p>
          {full && <Lightbox result={r} onClose={() => setFull(false)} />}
        </>
      }
    >
      <div className="grid items-start gap-5 2xl:grid-cols-2">
        <div className="2xl:col-span-2">
          <p className="kicker">{run.cached ? x.kickerSaved : x.kickerReady}</p>
          <h1 ref={heading} tabIndex={-1} className="mt-2 h-page outline-none sm:text-4xl">
            {x.ready}
          </h1>
          {run.cached && <span className="chip mt-3 !border-good/30 !bg-good-wash !text-good">{x.noGpu}</span>}
          {r.model?.variant === "tuned" && (
            <span className="chip mt-3 ml-2 !border-accent/30 !bg-accent/10 !text-accent-strong" title={t.tuned.badgeTitle(r.model.adapter ?? "")}>
              {t.tuned.badge}
            </span>
          )}
          {TEST_ENGINES.has(r.engine) && (
            <div className="mt-3">
              <Notice tone="warn">
                <strong>{x.testTitle}</strong> {x.testBody}
              </Notice>
            </div>
          )}
        </div>

        <div className="space-y-5">
        {r.quality && <QualityChecks quality={r.quality} />}
        <Link
          href={`/studio/post?r=${r.key}`}
          className="group flex items-center justify-between gap-4 rounded-2xl bg-accent-strong px-5 py-4 text-paper-glow shadow-[var(--shadow-raised)] transition-colors hover:bg-accent-deep"
        >
          <span>
            <span className="block text-lg font-semibold">{x.makePost}</span>
            <span className="mt-0.5 block text-sm text-paper-glow/85">{x.makePostSub}</span>
          </span>
        </Link>

        <div className="card p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
            {x.downloadTitle} <HelpTip topic="downloads" />
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 2xl:grid-cols-2">
            {(Object.keys(EXPORT_SIZES) as ExportSize[]).map((size) => {
              const s = EXPORT_SIZES[size];
              return (
                <a key={size} href={`${resultUrl(r.key, `${size}.jpg`)}?download`} download className="min-h-11 rounded-xl border border-line bg-paper-2/60 px-3 py-2.5 transition-colors hover:border-accent-strong hover:bg-accent-wash/50">
                  <span className="block text-sm font-semibold">{x.sizes[size]}</span>
                  <span className="text-2xs text-ink-3 tabular-nums">
                    {s.ratio} · {s.width}×{s.height}
                  </span>
                </a>
              );
            })}
            <a href={`${resultUrl(r.key, "result.png")}?download`} download className="min-h-11 rounded-xl border border-line bg-paper-2/60 px-3 py-2.5 transition-colors hover:border-accent-strong hover:bg-accent-wash/50">
              <span className="block text-sm font-semibold">{x.original}</span>
              <span className="text-2xs text-ink-3">{x.originalSub}</span>
            </a>
            {shareable && (
              <button type="button" onClick={share} className="col-span-2 min-h-11 sm:col-span-4 2xl:col-span-2 rounded-xl bg-ink px-3 py-2.5 text-left text-paper hover:bg-ink-2">
                <span className="block text-sm font-semibold">{x.share}</span>
                <span className="text-2xs text-paper/80">{x.shareSub}</span>
              </button>
            )}
          </div>
          {shareNote && <p className="mt-2 text-xs text-danger">{shareNote}</p>}
          <p className="mt-3 text-2xs leading-relaxed text-ink-3">{x.sizesNote}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-ghost" onClick={() => onVariation(r)} title={x.variationTitle}>
            {x.variation}
          </button>
          <HelpTip topic="variation" className="mr-1" />
          <button type="button" className="btn-ghost" onClick={() => onAnotherModel(r)}>
            {x.anotherModel}
          </button>
          <button type="button" className="btn-ghost" onClick={onNewProduct}>
            {x.newProduct}
          </button>
        </div>
        </div>

        <div className="space-y-5">
        {/* Before "another variation": does today's free GPU time still cover one? */}
        {quota && !TEST_ENGINES.has(r.engine) && <QuotaMeter quota={quota} />}

        {curation && !TEST_ENGINES.has(r.engine) && (
          <div className="card p-4">
            <button
              type="button"
              disabled={featureBusy}
              onClick={async () => {
                setFeatureBusy(true);
                setFeatureError(await onFeature(r.key, !featured));
                setFeatureBusy(false);
              }}
              className={`min-h-11 text-sm font-semibold ${featured ? "text-accent-strong" : "text-ink"}`}
            >
              {featured ? x.featureOn : x.featureOff}
            </button>
            <p className="mt-1 text-2xs text-ink-3">{x.featureNote}</p>
            {featureError && <p className="mt-1 text-xs text-danger">{featureError}</p>}
          </div>
        )}

        <details className="card px-5 py-2" open={live}>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold select-none">{x.howMade}</summary>
          <div className="mt-2 mb-3">{live ? <Pipeline log={run.log} startedAt={startedAt} settings={r.settings} live={false} /> : <MadeWith r={r} />}</div>
        </details>
        </div>
      </div>
    </Layout>
  );
}

/**
 * The output guardrails' verdict on this photo, one line per check. Only shown
 * when the result carries them — photos saved before the checks existed show nothing.
 */
function QualityChecks({ quality }: { quality: OutputQuality }) {
  const { t } = useI18n();
  const Q = t.result.quality;
  const known = (id: string) => id in Q.checks;
  const summary = summariseQuality(quality, known);
  if (!summary) return null;
  const checks = quality.checks.filter((c) => known(c.id));
  const label = summary.overall === "fail" ? Q.failed : summary.overall === "warn" ? Q.warned(summary.warns) : Q.passed;
  const summaryTone = { fail: "!border-danger/30 !bg-danger-wash !text-danger", warn: "!border-marigold/60 !bg-marigold-wash !text-ink", pass: "!border-good/30 !bg-good-wash !text-good" }[summary.overall];
  const badge = {
    pass: "bg-good-wash text-good",
    warn: "bg-marigold-wash text-ink ring-1 ring-marigold/60",
    fail: "bg-danger-wash text-danger",
  } as const;
  const word = { pass: "text-good", warn: "text-ink-2", fail: "text-danger" } as const;
  return (
    <section aria-labelledby="quality-title" className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
        <h2 id="quality-title" className="flex items-center gap-2 text-sm font-semibold">
          {Q.title} <HelpTip topic="qualityChecks" />
        </h2>
        <span className={`chip ${summaryTone}`}>{label}</span>
      </div>
      <ul className="divide-y divide-line">
        {checks.map((c) => {
          const s = checkState(c);
          const text = Q.checks[c.id];
          return (
            <li key={c.id} className="flex items-start gap-3 px-5 py-3" title={Q.measure(formatMeasure(c.value), formatMeasure(c.limit))}>
              <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${badge[s]}`} aria-hidden>
                <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  {s === "pass" ? <path d="m5 10.5 3.2 3L15 6.5" /> : s === "warn" ? <path d="M10 5v6M10 14.5v.01" /> : <path d="m6 6 8 8M14 6l-8 8" />}
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{text.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{c.ok ? text.ok : text.bad}</p>
              </div>
              <span className={`shrink-0 pt-0.5 text-2xs font-bold uppercase ${word[s]}`}>{Q.states[s]}</span>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-line bg-paper-2 px-5 py-3 text-2xs leading-relaxed text-ink-3">{Q.note}</p>
    </section>
  );
}
