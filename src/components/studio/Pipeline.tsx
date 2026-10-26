"use client";

import { useEffect, useState } from "react";
import { engineName } from "@/lib/engines";
import { useI18n } from "@/lib/i18n/client";
import type { Messages } from "@/lib/i18n/messages";
import { QUALITY_STEPS, type PrepInfo, type ResultMeta, type TryOnSettings } from "@/lib/tryon/types";
import type { LogEntry, LogEvent } from "./types";

type State = "todo" | "active" | "done" | "skipped" | "failed";
interface Stage {
  id: string;
  title: string;
  state: State;
  detail?: string;
  /** ms this stage took, when it has finished. */
  took?: number;
}

export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export const secs = (ms: number) => {
  const s = Math.max(0, ms / 1000);
  return s < 10 ? `${s.toFixed(1)}s` : s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, "0")}s`;
};

function describePrep(p: PrepInfo, what: string, t: Messages) {
  const changes = [
    p.rotated && t.pipeline.upright,
    p.flattened && t.pipeline.whiteBg,
    p.resized && `${p.width}×${p.height} → ${p.outWidth}×${p.outHeight}`,
    p.stripped && t.pipeline.stripped,
  ].filter(Boolean);
  return `${what}: ${changes.length ? changes.join(", ") : t.pipeline.fine(p.outWidth, p.outHeight)}`;
}

/**
 * Derives each stage from the events the server actually sent — nothing is
 * animated on a timer, so the panel can't claim a step that didn't happen.
 */
function deriveStages(log: LogEntry[], startedAt: number, now: number, settings: TryOnSettings | null, failed: boolean, t: Messages): Stage[] {
  const P = t.pipeline;
  const first = (t: LogEvent["type"]) => log.find((l) => l.e.type === t);
  const last = (t: LogEvent["type"]) => [...log].reverse().find((l) => l.e.type === t);
  const uploading = first("uploading");
  const accepted = first("accepted");
  const prepared = first("prepared");
  const checked = first("checked");
  const waiting = first("waiting");
  const queued = last("queued");
  const running = first("running");
  const done = first("done");
  const hit = checked?.e.type === "checked" && checked.e.hit;
  const steps = settings ? QUALITY_STEPS[settings.quality] : null;

  const stages: Stage[] = [];
  let mark = startedAt;
  const end = (entry: LogEntry | undefined) => {
    if (!entry) return undefined;
    const took = entry.at - mark;
    mark = entry.at;
    return took;
  };

  if (uploading) {
    // The server prepares the photos before it answers, so this time covers both.
    stages.push({ id: "upload", title: P.upload, state: accepted ? "done" : "active", took: end(accepted) });
  } else if (accepted) {
    mark = accepted.at;
  }

  const prep = prepared?.e.type === "prepared" ? prepared.e.prep : null;
  stages.push({
    id: "prepare",
    title: P.prepare,
    state: prepared ? "done" : accepted ? "active" : "todo",
    detail: prep ? `${describePrep(prep.garment, P.prepProduct, t)} · ${describePrep(prep.person, P.prepModel, t)}` : undefined,
  });
  if (prepared) mark = prepared.at;

  stages.push({
    id: "check",
    title: P.check,
    state: checked ? "done" : prepared ? "active" : "todo",
    detail: checked ? (hit ? P.hit : P.miss) : undefined,
    took: end(checked),
  });

  const queueDetail = (() => {
    if (queued?.e.type === "queued") {
      const pos = queued.e.position;
      const line = pos === null ? P.inQueue : pos === 0 ? P.nextInLine : P.position(pos + 1);
      return queued.e.engine === "fashn-space" ? P.onHf(line) : line;
    }
    if (waiting) return P.waitingPrevious;
    return undefined;
  })();
  stages.push({
    id: "queue",
    title: P.queue,
    state: hit ? "skipped" : running || done ? "done" : waiting || queued || checked ? "active" : "todo",
    detail: hit ? P.skipped : queueDetail,
    took: hit ? undefined : end(running),
  });

  const eta = running?.e.type === "running" ? running.e.etaSeconds : null;
  const genDetail = [
    running?.e.type === "running" ? engineName(running.e.engine) : null,
    steps && P.steps(steps),
    running && !done && P.soFar(secs(now - running.at), eta ? Math.round(eta) : null),
  ]
    .filter(Boolean)
    .join(" · ");
  stages.push({
    id: "generate",
    title: P.generate,
    state: hit ? "skipped" : done ? "done" : running ? "active" : "todo",
    detail: hit ? P.skipped : genDetail,
    took: hit ? undefined : end(done),
  });

  stages.push({
    id: "save",
    title: hit ? P.opened : P.save,
    state: done ? "done" : "todo",
    detail: done ? (hit ? undefined : P.stored) : undefined,
  });

  if (failed) {
    const stuck = stages.find((s) => s.state === "active" || s.state === "todo");
    if (stuck) stuck.state = "failed";
    for (const s of stages) if (s.state === "active") s.state = "todo";
  }
  return stages;
}

const DOT: Record<State, string> = {
  done: "bg-ink text-paper",
  active: "bg-accent-strong text-paper animate-pulse",
  todo: "border border-line-strong/40 text-ink-3",
  skipped: "border border-dashed border-line-strong/40 text-ink-3",
  failed: "bg-danger text-paper",
};

export function Pipeline({
  log,
  startedAt,
  settings,
  live,
  failed = false,
}: {
  log: LogEntry[];
  startedAt: number;
  settings: TryOnSettings | null;
  live: boolean;
  failed?: boolean;
}) {
  const { t } = useI18n();
  const now = useNow(live);
  // Server timestamps, when present, beat the client's idea of when it started.
  const base = log[0]?.at ?? startedAt;
  const stages = deriveStages(log, base, now, settings, failed, t);
  // One polite announcement per stage change for screen readers — the
  // visual list updates every 250 ms, which would be noise if read aloud.
  const current = stages.find((s) => s.state === "active" || s.state === "failed") ?? [...stages].reverse().find((s) => s.state === "done");
  const announcement = current ? `${current.title}${current.state === "failed" ? t.pipeline.failed : current.state === "done" ? t.pipeline.done : ""}` : "";
  return (
    <div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <div className="flex items-baseline justify-between">
        <p className="kicker">{live ? t.pipeline.live : t.pipeline.after}</p>
        {log.length > 0 && (
          <p className="font-mono text-xs text-ink-2 tabular-nums">{secs((live ? now : (log.at(-1)?.at ?? base)) - base)}</p>
        )}
      </div>
      <ol className="mt-4 space-y-3.5">
        {stages.map((s, i) => (
          <li key={s.id} className="flex gap-3">
            <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full font-mono text-2xs ${DOT[s.state]}`}>
              {s.state === "done" ? "✓" : s.state === "failed" ? "!" : s.state === "skipped" ? "–" : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className={`text-sm font-semibold ${s.state === "todo" || s.state === "skipped" ? "text-ink-3" : "text-ink"}`}>{s.title}</p>
                {s.took !== undefined && s.state === "done" && <span className="font-mono text-2xs text-ink-3 tabular-nums">{secs(s.took)}</span>}
              </div>
              {s.detail && <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{s.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** For a result opened later, when there is no live log: what we know from its saved record. */
export function MadeWith({ r }: { r: ResultMeta }) {
  const { t, locale } = useI18n();
  const P = t.pipeline;
  const stop = locale === "hi" ? "।" : ".";
  const rows: [string, string][] = [
    [P.rows.engine, r.engine === "fashn-space" ? "FASHN VTON 1.5 · Hugging Face ZeroGPU" : engineName(r.engine)],
    [P.rows.quality, P.qualityLine(t.model.qualities[r.settings.quality].title, QUALITY_STEPS[r.settings.quality], r.settings.seed)],
    [P.rows.garment, `${t.product.categories[r.settings.category].title} · ${r.settings.photoType === "flat-lay" ? P.flat : P.worn}`],
    [P.rows.time, `${P.total(secs(r.totalMs))}${r.queueMs > 500 ? ` · ${P.waitingGpu(secs(r.queueMs))}` : ""}`],
    ...(r.prep ? ([[P.rows.preparation, `${describePrep(r.prep.garment, P.prepProduct, t)}${stop} ${describePrep(r.prep.person, P.prepModel, t)}${stop}`]] as [string, string][]) : []),
    [P.rows.created, new Date(r.createdAt).toLocaleString(locale === "hi" ? "hi-IN" : "en-IN", { dateStyle: "medium", timeStyle: "short" })],
  ];
  return (
    <dl className="space-y-2 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[6.5rem_1fr] gap-2">
          <dt className="text-ink-3">{k}</dt>
          <dd className="text-ink-2">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
