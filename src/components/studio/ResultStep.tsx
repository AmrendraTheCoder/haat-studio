"use client";

import { useState } from "react";
import { BeforeAfter } from "@/components/shared/BeforeAfter";
import { resultUrl } from "@/lib/client/check";
import { TEST_ENGINES } from "@/lib/engines";
import { EXPORT_SIZES, type ExportSize } from "@/lib/limits";
import type { ResultMeta } from "@/lib/tryon/types";
import { Lightbox, Notice } from "./parts";
import { MadeWith, Pipeline } from "./Pipeline";
import type { ErrorKind, Run, View } from "./types";

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
  if (run.phase === "working") {
    return (
      <Layout
        visual={
          <div className="relative">
            <div className="scan relative aspect-[2/3] overflow-hidden rounded-3xl border border-line bg-paper-3">
              {run.personPreview ? (
                <img src={run.personPreview} alt="The model photo being dressed" className="size-full object-cover opacity-75" />
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
          <p className="mt-5 border-t border-line pt-4 text-xs text-ink-3">
            Safe to leave this page. The photo keeps generating, appears in your recent photos, and this page&rsquo;s link brings you back to it.
          </p>
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
              <p className="mt-2 text-lg font-bold">{ERROR_TITLE[run.kind]}</p>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <Notice tone="error">{run.message}</Notice>
          <div className="flex flex-wrap gap-2">
            {run.kind === "input" && (
              <>
                <button type="button" className="btn-primary" onClick={() => onGo(/model photo/i.test(run.message) ? "model" : "product")}>
                  {/model photo/i.test(run.message) ? "Change the model photo" : "Change the product photo"}
                </button>
              </>
            )}
            {run.kind === "offline" && onReconnect && (
              <button type="button" className="btn-primary" onClick={onReconnect}>
                Reconnect
              </button>
            )}
            {(run.kind === "quota" || run.kind === "other" || (run.kind === "offline" && !onReconnect)) && onRetry && (
              <button type="button" className="btn-primary" onClick={onRetry}>
                Try again
              </button>
            )}
            {run.kind === "quota" && (
              <a href="#recent" className="btn-ghost">
                Open a saved photo
              </a>
            )}
            <button type="button" className="btn-ghost" onClick={onNewProduct}>
              Start a new photo
            </button>
          </div>
          {run.log.length > 0 && (
            <div className="card p-5">
              <Pipeline log={run.log} startedAt={run.startedAt} settings={null} live={false} failed />
            </div>
          )}
          {run.attempts.length > 0 && (
            <details className="text-xs text-ink-3">
              <summary className="cursor-pointer select-none">Technical detail</summary>
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

const ERROR_TITLE: Record<ErrorKind, string> = {
  quota: "Today's free GPU time is used up",
  input: "That photo can't be used",
  missing: "No photo at this link",
  offline: "Lost the connection",
  other: "The photo couldn't be made",
};

function Layout({ visual, children }: { visual: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rise grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
      <div className="mx-auto w-full max-w-md">{visual}</div>
      <div>{children}</div>
    </div>
  );
}

function ProductChip({ src }: { src: string }) {
  return (
    <div className="pointer-events-none absolute -bottom-4 -left-3 w-24 rotate-[-4deg] rounded-xl border border-line bg-white p-1.5 shadow-lg sm:-left-5">
      <img src={src} alt="Your product photo" className="aspect-square w-full object-contain" />
      <p className="text-center font-mono text-[9px] text-ink-3">product</p>
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
  const r = run.result;
  const [full, setFull] = useState(false);
  const [featureBusy, setFeatureBusy] = useState(false);
  const [featureError, setFeatureError] = useState<string | null>(null);
  const live = run.log.some((l) => l.e.type === "accepted");
  const startedAt = run.log[0]?.at ?? 0;

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
              className="absolute right-3 bottom-3 rounded-full bg-paper/90 px-3 py-1.5 text-xs font-medium text-ink shadow ring-1 ring-line hover:bg-paper"
            >
              ⤢ Full screen
            </button>
          </div>
          <p className="mt-7 text-center text-xs text-ink-3">Drag the handle (or use ← →) to compare with the original model photo.</p>
          {full && <Lightbox result={r} onClose={() => setFull(false)} />}
        </>
      }
    >
      <div className="space-y-6">
        <div>
          <p className="kicker">{run.cached ? "Saved photo" : "Your photo is ready"}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">Ready to post.</h1>
          {run.cached && <span className="chip mt-3 !border-good/40 !text-good">No GPU used — loaded from saved photos</span>}
          {TEST_ENGINES.has(r.engine) && (
            <div className="mt-3">
              <Notice tone="warn">
                <strong>Test output.</strong> Made by the echo test engine, which returns the model photo unchanged. It is not a try-on and
                can&rsquo;t be featured.
              </Notice>
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Download</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(EXPORT_SIZES) as ExportSize[]).map((size) => {
              const s = EXPORT_SIZES[size];
              return (
                <a key={size} href={`${resultUrl(r.key, `${size}.jpg`)}?download`} download className="rounded-xl border border-line bg-paper-glow px-3 py-2.5 hover:border-ink">
                  <span className="block text-sm font-semibold">{s.label}</span>
                  <span className="font-mono text-[11px] text-ink-3">
                    {s.ratio} · {s.width}×{s.height}
                  </span>
                </a>
              );
            })}
            <a href={`${resultUrl(r.key, "result.png")}?download`} download className="rounded-xl border border-line bg-paper-glow px-3 py-2.5 hover:border-ink">
              <span className="block text-sm font-semibold">Original</span>
              <span className="font-mono text-[11px] text-ink-3">PNG · as generated</span>
            </a>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
            Instagram sizes fit the whole photo on a blurred backdrop — nothing is cropped off. The model generates at 576×864, so large sizes are
            enlarged; sharper output is planned.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => onVariation(r)} title="Same product and model, a new random seed">
            Another variation
          </button>
          <button type="button" className="btn-ghost" onClick={() => onAnotherModel(r)}>
            Try another model
          </button>
          <button type="button" className="btn-ghost" onClick={onNewProduct}>
            New product
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
              className={`text-sm font-semibold ${featured ? "text-accent-strong" : "text-ink"}`}
            >
              {featured ? "★ Featured on the home page — remove" : "☆ Feature on the home page"}
            </button>
            <p className="mt-1 text-[11px] text-ink-3">Only feature results that faithfully show the product. Featured photos load instantly in demos.</p>
            {featureError && <p className="mt-1 text-xs text-danger">{featureError}</p>}
          </div>
        )}

        <details className="card p-4" open={live}>
          <summary className="cursor-pointer text-sm font-semibold select-none">How this photo was made</summary>
          <div className="mt-4">{live ? <Pipeline log={run.log} startedAt={startedAt} settings={r.settings} live={false} /> : <MadeWith r={r} />}</div>
        </details>
      </div>
    </Layout>
  );
}
