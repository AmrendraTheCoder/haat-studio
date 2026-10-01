"use client";

import { useEffect, useState } from "react";
import { PRESETS } from "@/lib/presets";
import type { Attempt, ResultMeta } from "@/lib/tryon/types";

export type RunState =
  | { phase: "idle" }
  | {
      phase: "working";
      since: number;
      step: "preparing" | "waiting" | "queued" | "running";
      position: number | null;
      etaSeconds: number | null;
      runningSince: number | null;
    }
  | { phase: "done"; result: ResultMeta; cached: boolean }
  | { phase: "error"; message: string; attempts: Attempt[] };

export const QUALITY_LABEL = { fast: "Fast · 20 steps", balanced: "Balanced · 30 steps", best: "Best · 50 steps" } as const;
const CATEGORY_LABEL = { tops: "Top", bottoms: "Bottom", "one-pieces": "Full outfit" } as const;

export const fileUrl = (key: string, file: string) => `/api/results/${key}/${file}`;

const seconds = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function Output({
  run,
  onVariation,
  busy,
}: {
  run: RunState;
  onVariation: (result: ResultMeta) => void;
  busy: boolean;
}) {
  if (run.phase === "idle") return <Idle />;
  if (run.phase === "working") return <Working run={run} />;
  if (run.phase === "error") return <Failed run={run} />;
  return <Done run={run} onVariation={onVariation} busy={busy} />;
}

function Idle() {
  return (
    <div className="grid h-full min-h-[420px] place-items-center rounded-2xl border border-dashed border-line p-8">
      <div className="max-w-sm">
        <p className="font-display text-2xl text-ink">Your product, on a model.</p>
        <p className="mt-2 text-sm text-muted">The result appears here. For the most faithful output:</p>
        <ul className="mt-4 space-y-2 text-sm text-ink">
          {[
            "Photograph the whole garment, front side up, laid flat or on a hanger.",
            "Use a plain background and even light. Avoid strong shadows and folds.",
            "One garment per photo, and pick the matching category.",
            "Choose a model whose pose shows the part being dressed.",
          ].map((tip) => (
            <li key={tip} className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const STEPS = [
  { id: "preparing", label: "Preparing photos" },
  { id: "queued", label: "Waiting for a free GPU" },
  { id: "running", label: "Dressing the model" },
] as const;

function Working({ run }: { run: Extract<RunState, { phase: "working" }> }) {
  const now = useNow(true);
  const current = run.step === "waiting" ? "queued" : run.step;
  const index = STEPS.findIndex((s) => s.id === current);
  const pct =
    run.step === "running" && run.runningSince && run.etaSeconds
      ? Math.min(95, ((now - run.runningSince) / (run.etaSeconds * 1000)) * 100)
      : null;

  return (
    <div className="grid h-full min-h-[420px] place-items-center rounded-2xl border border-line bg-card p-8">
      <div className="w-full max-w-sm">
        <p className="font-display text-2xl text-ink">Working on it…</p>
        <p className="mt-1 text-sm text-muted tabular-nums">{seconds(now - run.since)} elapsed</p>

        <ol className="mt-6 space-y-3">
          {STEPS.map((s, i) => {
            const state = i < index ? "done" : i === index ? "active" : "todo";
            return (
              <li key={s.id} className="flex items-center gap-3 text-sm">
                <span
                  className={`grid size-5 place-items-center rounded-full text-[10px] ${
                    state === "done" ? "bg-ok text-paper" : state === "active" ? "bg-accent text-accent-ink" : "border border-line text-muted"
                  }`}
                >
                  {state === "done" ? "✓" : i + 1}
                </span>
                <span className={state === "todo" ? "text-muted" : "text-ink"}>
                  {s.label}
                  {state === "active" && s.id === "queued" && (
                    <span className="ml-2 text-muted tabular-nums">
                      {run.step === "waiting"
                        ? "· finishing your previous one first"
                        : run.position !== null
                          ? `· ${run.position === 0 ? "next up" : `#${run.position + 1} in line`}`
                          : ""}
                    </span>
                  )}
                  {state === "active" && s.id === "running" && run.etaSeconds && (
                    <span className="ml-2 text-muted tabular-nums">· usually ~{Math.round(run.etaSeconds)}s</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-line">
          {pct === null ? (
            <div className="h-full w-2/5 rounded-full bg-accent" style={{ animation: "indeterminate 1.4s ease-in-out infinite" }} />
          ) : (
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
          )}
        </div>
        <p className="mt-3 text-xs text-muted">You can close this tab — the result is saved to the gallery when it finishes.</p>
      </div>
    </div>
  );
}

function Failed({ run }: { run: Extract<RunState, { phase: "error" }> }) {
  return (
    <div className="grid h-full min-h-[420px] place-items-center rounded-2xl border border-bad/30 bg-bad-soft p-8">
      <div className="w-full max-w-md">
        <p className="font-display text-2xl text-ink">That didn&apos;t work.</p>
        <p className="mt-2 text-sm text-ink">{run.message}</p>
        {run.attempts.length > 0 && (
          <details className="mt-4 text-xs text-muted">
            <summary className="cursor-pointer select-none">What each engine said</summary>
            <ul className="mt-2 space-y-1.5">
              {run.attempts.map((a, i) => (
                <li key={i} className="rounded-lg bg-card/60 p-2 font-mono break-words">
                  <span className="font-semibold">{a.engine}</span> [{a.kind}] {a.message}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

function Done({
  run,
  onVariation,
  busy,
}: {
  run: Extract<RunState, { phase: "done" }>;
  onVariation: (result: ResultMeta) => void;
  busy: boolean;
}) {
  const r = run.result;
  const model = PRESETS.find((p) => p.id === r.personId)?.label ?? "Your model photo";
  return (
    <div className="rounded-2xl border border-line bg-card p-4 sm:p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4">
        <div className="flex flex-col gap-2">
          <Figure src={fileUrl(r.key, "garment.jpg")} caption="Product" contain />
          <span className="text-center text-lg leading-none text-muted">+</span>
          <Figure src={fileUrl(r.key, "person.jpg")} caption={model} />
        </div>
        <Figure src={fileUrl(r.key, "result.png")} caption="On model" large />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
        {run.cached && <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">From cache · no GPU used</span>}
        <span>{CATEGORY_LABEL[r.settings.category]}</span>
        <span>{r.settings.photoType === "flat-lay" ? "Flat-lay photo" : "Worn photo"}</span>
        <span>{QUALITY_LABEL[r.settings.quality]}</span>
        <span>Seed {r.settings.seed}</span>
        <span className="tabular-nums">
          {seconds(r.totalMs)} total{r.queueMs > 500 && ` · ${seconds(r.queueMs)} queued`}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={`${fileUrl(r.key, "result.png")}?download`}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:opacity-90"
        >
          Download image
        </a>
        <button
          type="button"
          disabled={busy}
          onClick={() => onVariation(r)}
          className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-paper disabled:opacity-50"
        >
          Another variation
        </button>
      </div>
    </div>
  );
}

function Figure({ src, caption, large, contain }: { src: string; caption: string; large?: boolean; contain?: boolean }) {
  return (
    <figure className="flex min-w-0 flex-col gap-1.5">
      <div className={`overflow-hidden rounded-xl bg-paper ${large ? "aspect-[2/3]" : "aspect-[3/4]"}`}>
        <img src={src} alt={caption} className={`size-full ${contain ? "object-contain p-2" : "object-cover"}`} />
      </div>
      <figcaption className={`truncate text-center ${large ? "text-sm font-medium text-ink" : "text-xs text-muted"}`}>{caption}</figcaption>
    </figure>
  );
}
