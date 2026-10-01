"use client";

import { useEffect, useState } from "react";
import { engineName } from "@/lib/engines";
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

function describePrep(p: PrepInfo, what: string) {
  const changes = [
    p.rotated && "turned upright",
    p.flattened && "white background added behind the cut-out",
    p.resized && `${p.width}×${p.height} → ${p.outWidth}×${p.outHeight}`,
    p.stripped && "camera data (like location) removed",
  ].filter(Boolean);
  return `${what}: ${changes.length ? changes.join(", ") : `${p.outWidth}×${p.outHeight}, already fine`}`;
}

/**
 * Derives each stage from the events the server actually sent — nothing is
 * animated on a timer, so the panel can't claim a step that didn't happen.
 */
function deriveStages(log: LogEntry[], startedAt: number, now: number, settings: TryOnSettings | null, failed: boolean): Stage[] {
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
    stages.push({ id: "upload", title: "Uploading your photos", state: accepted ? "done" : "active", took: end(accepted) });
  } else if (accepted) {
    mark = accepted.at;
  }

  const prep = prepared?.e.type === "prepared" ? prepared.e.prep : null;
  stages.push({
    id: "prepare",
    title: "Preparing the photos",
    state: prepared ? "done" : accepted ? "active" : "todo",
    detail: prep ? `${describePrep(prep.garment, "Product")} · ${describePrep(prep.person, "Model")}` : undefined,
  });
  if (prepared) mark = prepared.at;

  stages.push({
    id: "check",
    title: "Checking saved photos",
    state: checked ? "done" : prepared ? "active" : "todo",
    detail: checked ? (hit ? "Made before with these exact inputs — reusing it, no GPU needed" : "New combination — this needs the GPU") : undefined,
    took: end(checked),
  });

  const queueDetail = (() => {
    if (queued?.e.type === "queued") {
      const pos = queued.e.position;
      const line = pos === null ? "In the queue" : pos === 0 ? "Next in line" : `#${pos + 1} in line`;
      return queued.e.engine === "fashn-space" ? `${line} on Hugging Face's shared GPUs` : line;
    }
    if (waiting) return "Finishing your previous photo first — one at a time saves the free quota";
    return undefined;
  })();
  stages.push({
    id: "queue",
    title: "Waiting for a free GPU",
    state: hit ? "skipped" : running || done ? "done" : waiting || queued || checked ? "active" : "todo",
    detail: hit ? "Skipped" : queueDetail,
    took: hit ? undefined : end(running),
  });

  const eta = running?.e.type === "running" ? running.e.etaSeconds : null;
  const genDetail = [
    running?.e.type === "running" ? engineName(running.e.engine) : null,
    steps && `${steps} refinement steps`,
    running && !done && `${secs(now - running.at)} so far${eta ? ` · usually ~${Math.round(eta)}s` : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");
  stages.push({
    id: "generate",
    title: "Dressing the model",
    state: hit ? "skipped" : done ? "done" : running ? "active" : "todo",
    detail: hit ? "Skipped" : genDetail,
    took: hit ? undefined : end(done),
  });

  stages.push({
    id: "save",
    title: hit ? "Opened the saved photo" : "Saved",
    state: done ? "done" : "todo",
    detail: done ? (hit ? undefined : "Stored on this computer — asking again is instant") : undefined,
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
  const now = useNow(live);
  // Server timestamps, when present, beat the client's idea of when it started.
  const base = log[0]?.at ?? startedAt;
  const stages = deriveStages(log, base, now, settings, failed);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="kicker">{live ? "How it’s being made" : "Step by step"}</p>
        {log.length > 0 && (
          <p className="font-mono text-xs text-ink-2 tabular-nums">{secs((live ? now : (log.at(-1)?.at ?? base)) - base)}</p>
        )}
      </div>
      <ol className="mt-4 space-y-3.5">
        {stages.map((s, i) => (
          <li key={s.id} className="flex gap-3">
            <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full font-mono text-[10px] ${DOT[s.state]}`}>
              {s.state === "done" ? "✓" : s.state === "failed" ? "!" : s.state === "skipped" ? "–" : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className={`text-sm font-semibold ${s.state === "todo" || s.state === "skipped" ? "text-ink-3" : "text-ink"}`}>{s.title}</p>
                {s.took !== undefined && s.state === "done" && <span className="font-mono text-[11px] text-ink-3 tabular-nums">{secs(s.took)}</span>}
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
  const rows: [string, string][] = [
    ["Engine", r.engine === "fashn-space" ? "FASHN VTON 1.5 · Hugging Face ZeroGPU" : engineName(r.engine)],
    ["Quality", `${r.settings.quality} · ${QUALITY_STEPS[r.settings.quality]} steps · seed ${r.settings.seed}`],
    ["Garment", `${{ tops: "Top", bottoms: "Bottom", "one-pieces": "Full outfit" }[r.settings.category]} · ${r.settings.photoType === "flat-lay" ? "photographed flat" : "photographed worn"}`],
    ["Time", `${secs(r.totalMs)} total${r.queueMs > 500 ? ` · ${secs(r.queueMs)} waiting for a GPU` : ""}`],
    ...(r.prep ? ([["Preparation", `${describePrep(r.prep.garment, "Product")}. ${describePrep(r.prep.person, "Model")}.`]] as [string, string][]) : []),
    ["Created", new Date(r.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })],
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
