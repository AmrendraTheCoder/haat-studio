"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BeforeAfter } from "@/components/shared/BeforeAfter";
import { resultUrl } from "@/lib/client/check";
import { canShareFiles, shareImage } from "@/lib/client/share";
import { TEST_ENGINES } from "@/lib/engines";
import { useI18n } from "@/lib/i18n/client";
import { EXPORT_SIZES, type ExportSize } from "@/lib/limits";
import type { ResultMeta } from "@/lib/tryon/types";
import { Lightbox, Notice } from "./parts";
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
}: {
  run: Exclude<Run, { phase: "idle" }>;
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
            <div className="scan relative aspect-[2/3] overflow-hidden rounded-3xl border border-line bg-paper-3">
              {run.personPreview ? (
                <img src={run.personPreview} alt={r.workingAlt} className="size-full object-cover opacity-75" />
              ) : (
                <div className="skeleton size-full" />
              )}
            </div>
            {run.garmentPreview && <ProductChip src={run.garmentPreview} />}
          </div>
        }
      >
        <div className="card p-5">
          <Pipeline log={run.log} startedAt={run.startedAt} settings={run.settings} live />
          <p className="mt-5 border-t border-line pt-4 text-xs text-ink-3">{r.safeToLeave}</p>
        </div>
      </Layout>
    );
  }

  if (run.phase === "error") {
    return (
      <Layout
        visual={
          <div className="grid aspect-[4/3] place-items-center rounded-3xl border-2 border-dashed border-danger/40 bg-danger-wash p-8 text-center lg:aspect-[3/4]">
            <div>
              <p className="font-display text-5xl font-extrabold text-danger">!</p>
              <p className="mt-2 text-lg font-bold">{r.errorTitles[run.kind]}</p>
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
          {run.log.length > 0 && (
            <div className="card p-5">
              <Pipeline log={run.log} startedAt={run.startedAt} settings={null} live={false} failed />
            </div>
          )}
          {run.attempts.length > 0 && (
            <details className="text-xs text-ink-3">
              <summary className="cursor-pointer select-none">{r.technical}</summary>
              <ul className="mt-2 space-y-1.5">
                {run.attempts.map((a, i) => (
                  <li key={i} className="rounded-lg bg-paper-2 p-2 font-mono break-words">
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
    />
  );
}

function Layout({ visual, children }: { visual: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rise grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
      <div className="mx-auto w-full max-w-md">{visual}</div>
      <div>{children}</div>
    </div>
  );
}

function ProductChip({ src }: { src: string }) {
  const { t } = useI18n();
  return (
    <div className="pointer-events-none absolute -bottom-4 -left-3 w-24 rotate-[-4deg] rounded-xl border border-line bg-white p-1.5 shadow-lg sm:-left-5">
      <img src={src} alt={t.result.productAlt} className="aspect-square w-full object-contain" />
      <p className="text-center font-mono text-2xs text-ink-3">{t.result.productChip}</p>
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
}: {
  run: Extract<Run, { phase: "done" }>;
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
            <BeforeAfter
              before={resultUrl(r.key, "person.jpg")}
              after={resultUrl(r.key, "result.png")}
              className="aspect-[2/3] rounded-3xl border border-line shadow-xl"
            />
            <ProductChip src={resultUrl(r.key, "garment.jpg")} />
            <button
              type="button"
              onClick={() => setFull(true)}
              className="absolute right-3 bottom-3 min-h-11 rounded-full bg-paper/90 px-4 py-1.5 text-xs font-medium text-ink shadow ring-1 ring-line hover:bg-paper"
            >
              {x.fullScreen}
            </button>
          </div>
          <p className="mt-7 text-center text-xs text-ink-3">{x.dragHint}</p>
          {full && <Lightbox result={r} onClose={() => setFull(false)} />}
        </>
      }
    >
      <div className="space-y-6">
        <div>
          <p className="kicker">{run.cached ? x.kickerSaved : x.kickerReady}</p>
          <h1 ref={heading} tabIndex={-1} className="mt-2 text-3xl font-extrabold tracking-[-0.04em] outline-none sm:text-4xl">
            {x.ready}
          </h1>
          {run.cached && <span className="chip mt-3 !border-good/40 !text-good">{x.noGpu}</span>}
          {TEST_ENGINES.has(r.engine) && (
            <div className="mt-3">
              <Notice tone="warn">
                <strong>{x.testTitle}</strong> {x.testBody}
              </Notice>
            </div>
          )}
        </div>

        <Link
          href={`/studio/post?r=${r.key}`}
          className="flex items-center justify-between rounded-2xl bg-ink px-5 py-4 text-paper transition-colors hover:bg-ink-2"
        >
          <span>
            <span className="block text-lg font-bold">{x.makePost}</span>
            <span className="text-sm text-paper/70">{x.makePostSub}</span>
          </span>
        </Link>

        <div>
          <p className="mb-2 text-sm font-semibold">{x.downloadTitle}</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(EXPORT_SIZES) as ExportSize[]).map((size) => {
              const s = EXPORT_SIZES[size];
              return (
                <a key={size} href={`${resultUrl(r.key, `${size}.jpg`)}?download`} download className="rounded-xl border border-line bg-paper-glow px-3 py-2.5 hover:border-ink">
                  <span className="block text-sm font-semibold">{x.sizes[size]}</span>
                  <span className="font-mono text-2xs text-ink-3">
                    {s.ratio} · {s.width}×{s.height}
                  </span>
                </a>
              );
            })}
            <a href={`${resultUrl(r.key, "result.png")}?download`} download className="rounded-xl border border-line bg-paper-glow px-3 py-2.5 hover:border-ink">
              <span className="block text-sm font-semibold">{x.original}</span>
              <span className="font-mono text-2xs text-ink-3">{x.originalSub}</span>
            </a>
            {shareable && (
              <button type="button" onClick={share} className="col-span-2 min-h-11 rounded-xl bg-accent-strong px-3 py-2.5 text-left text-paper hover:opacity-90">
                <span className="block text-sm font-semibold">{x.share}</span>
                <span className="font-mono text-2xs opacity-80">{x.shareSub}</span>
              </button>
            )}
          </div>
          {shareNote && <p className="mt-2 text-xs text-danger">{shareNote}</p>}
          <p className="mt-2 text-2xs leading-relaxed text-ink-3">{x.sizesNote}</p>
        </div>



        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={() => onVariation(r)} title={x.variationTitle}>
            {x.variation}
          </button>
          <button type="button" className="btn-ghost" onClick={() => onAnotherModel(r)}>
            {x.anotherModel}
          </button>
          <button type="button" className="btn-ghost" onClick={onNewProduct}>
            {x.newProduct}
          </button>
        </div>

        {curation && !TEST_ENGINES.has(r.engine) && (
          <div className="rounded-xl border border-line p-3">
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

        <details className="card p-4" open={live}>
          <summary className="cursor-pointer text-sm font-semibold select-none">{x.howMade}</summary>
          <div className="mt-4">{live ? <Pipeline log={run.log} startedAt={startedAt} settings={r.settings} live={false} /> : <MadeWith r={r} />}</div>
        </details>
      </div>
    </Layout>
  );
}
