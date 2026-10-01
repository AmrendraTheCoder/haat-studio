"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BeforeAfter } from "@/components/shared/BeforeAfter";
import { resultUrl } from "@/lib/client/check";
import { TEST_ENGINES } from "@/lib/engines";
import { ACCEPT_ATTR } from "@/lib/limits";
import type { ResultMeta } from "@/lib/tryon/types";
import type { View } from "./types";

/* ── Stepper ─────────────────────────────────────────────────────────── */

const STEPS: { id: View; label: string }[] = [
  { id: "product", label: "Product" },
  { id: "model", label: "Model" },
  { id: "result", label: "Photo" },
];

export function Stepper({
  view,
  reachable,
  complete,
  onGo,
  lockedReason,
}: {
  view: View;
  reachable: Record<View, boolean>;
  /** A tick means the step's inputs are actually filled in, not merely that it comes earlier. */
  complete: Record<View, boolean>;
  onGo: (v: View) => void;
  lockedReason: string | null;
}) {
  return (
    <ol className="flex items-center gap-2" aria-label="Steps">
      {STEPS.map((s, i) => {
        const active = s.id === view;
        const done = !active && complete[s.id];
        const enabled = reachable[s.id] && !active && !lockedReason;
        return (
          <li key={s.id} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              disabled={!enabled}
              onClick={() => onGo(s.id)}
              aria-current={active ? "step" : undefined}
              title={lockedReason ?? (reachable[s.id] ? undefined : "Finish the earlier step first")}
              className={`flex min-w-0 items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm transition-colors ${
                active ? "bg-ink text-paper" : enabled ? "text-ink hover:bg-paper-2" : "text-ink-3"
              } disabled:cursor-default`}
            >
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full font-mono text-[11px] ${
                  active ? "bg-paper text-ink" : done ? "bg-ink text-paper" : "border border-line-strong/50"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className="truncate font-medium">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-line" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

/* ── Dropzone ────────────────────────────────────────────────────────── */

/** Click, drop, or (when `pasteTarget`) paste an image. Only the first file is used. */
export function Dropzone({
  previewUrl,
  onFile,
  onClear,
  title,
  hint,
  className = "",
  pasteTarget = false,
  compact = false,
}: {
  previewUrl: string | null;
  onFile: (file: File, note?: string) => void;
  onClear?: () => void;
  title: string;
  hint: string;
  className?: string;
  pasteTarget?: boolean;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = (files: FileList | null | undefined) => {
    if (!files || files.length === 0) return;
    onFile(files[0], files.length > 1 ? `You added ${files.length} files — using the first one.` : undefined);
  };

  useEffect(() => {
    if (!pasteTarget) return;
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) onFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [pasteTarget, onFile]);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
      className={`group relative overflow-hidden rounded-2xl border-2 border-dashed transition-colors ${
        over ? "border-accent-strong bg-accent-wash" : previewUrl ? "border-line bg-white" : "border-line-strong/40 bg-paper-glow hover:border-ink"
      } ${className}`}
    >
      <input
        ref={input}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = ""; // choosing the same file again should still fire
        }}
      />
      <button type="button" onClick={() => input.current?.click()} className="absolute inset-0 size-full" aria-label={previewUrl ? `Replace: ${title}` : title} />
      {previewUrl ? (
        <>
          <img src={previewUrl} alt="" className="pointer-events-none size-full object-contain p-3" />
          <div className="absolute right-2 bottom-2 flex gap-1.5">
            <span className="pointer-events-none rounded-full bg-ink/80 px-3 py-1 text-xs text-paper">Replace</span>
            {onClear && (
              <button type="button" onClick={onClear} className="relative rounded-full bg-paper px-3 py-1 text-xs text-ink shadow ring-1 ring-line">
                Remove
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="pointer-events-none grid size-full place-items-center p-4 text-center">
          <div>
            <svg viewBox="0 0 24 24" className={`mx-auto text-ink-2 ${compact ? "mb-1 size-6" : "mb-3 size-9"}`} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M12 16V4m0 0-4 4m4-4 4 4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className={`font-semibold text-ink ${compact ? "text-xs" : ""}`}>{title}</p>
            <p className={`mt-1 text-ink-3 ${compact ? "text-[10px] leading-tight" : "text-xs"}`}>{hint}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Choice cards (radio group) ──────────────────────────────────────── */

export function Choices<T extends string>({
  label,
  value,
  options,
  onChange,
  columns = 3,
}: {
  label: string;
  value: T | null;
  options: { value: T; title: string; hint?: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
  columns?: 2 | 3;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-2 ${columns === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors ${
              active ? "border-ink bg-ink text-paper" : "border-line bg-paper-glow text-ink hover:border-ink"
            }`}
          >
            {o.icon}
            <span className="text-sm font-semibold leading-tight">{o.title}</span>
            {o.hint && <span className={`text-[11px] leading-tight ${active ? "text-paper/70" : "text-ink-3"}`}>{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

const icon = (d: string) => (
  <svg viewBox="0 0 32 32" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
export const ICONS = {
  tops: icon("M11 5 6 8 3 14l4 2 2-3v14h14V13l2 3 4-2-3-6-5-3c-1 2-3 3-5 3s-4-1-5-3Z"),
  bottoms: icon("M9 4h14l2 24h-6l-3-15-3 15H7L9 4Z"),
  "one-pieces": icon("M12 3h8l-1 6 5 19H8l5-19-1-6Z"),
  "flat-lay": icon("M5 22h22M9 22l2-10h10l2 10M13 12V8h6v4"),
  model: icon("M16 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 20 1-11-3 4-2-2 5-7h10l5 7-2 2-3-4 1 11"),
};

/* ── Action bar: sticky at the bottom on phones, inline on larger screens ── */

export function ActionBar({ children, reason }: { children: ReactNode; reason?: string | null }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-8 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
      <div className="flex items-center justify-between gap-3">{children}</div>
      {reason && <p className="mt-2 text-right text-xs text-ink-3">{reason}</p>}
    </div>
  );
}

export function Notice({ tone, children }: { tone: "warn" | "error" | "info"; children: ReactNode }) {
  const styles = {
    warn: "border-marigold/50 bg-[oklch(93%_0.06_80)]",
    error: "border-danger/40 bg-danger-wash",
    info: "border-line bg-paper-glow",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm text-ink ${styles}`}>
      {children}
    </div>
  );
}

/* ── Lightbox ────────────────────────────────────────────────────────── */

export function Lightbox({ result, onClose }: { result: ResultMeta; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  const [compare, setCompare] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Full-screen photo" className="fixed inset-0 z-50 flex flex-col bg-ink/95" onClick={onClose}>
      <div className="flex items-center justify-between gap-3 p-3 text-paper" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => setCompare((c) => !c)} className="rounded-full border border-paper/30 px-4 py-1.5 text-sm hover:bg-paper/10">
          {compare ? "Show result only" : "Compare before / after"}
        </button>
        <button ref={close} type="button" onClick={onClose} className="rounded-full bg-paper px-4 py-1.5 text-sm font-medium text-ink">
          Close · Esc
        </button>
      </div>
      <div className="grid min-h-0 flex-1 place-items-center p-3 pt-0" onClick={(e) => e.stopPropagation()}>
        {compare ? (
          <BeforeAfter before={resultUrl(result.key, "person.jpg")} after={resultUrl(result.key, "result.png")} className="aspect-[2/3] h-full max-h-full max-w-full rounded-xl" />
        ) : (
          <img src={resultUrl(result.key, "result.png")} alt="Try-on result" className="max-h-full max-w-full rounded-xl object-contain" />
        )}
      </div>
    </div>
  );
}

/* ── Recent photos ───────────────────────────────────────────────────── */

const ago = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} h ago` : new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export function RecentGrid({
  results,
  featured,
  activeKey,
  onOpen,
  disabled = false,
}: {
  results: ResultMeta[];
  featured: string[];
  activeKey: string | null;
  onOpen: (r: ResultMeta) => void;
  /** While a photo is being made, opening another would hide its progress. */
  disabled?: boolean;
}) {
  return (
    <section className="mt-16">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-2xl font-extrabold tracking-[-0.04em]">Recent photos</h2>
        <p className="text-xs text-ink-3">
          {disabled ? "Available again when the current photo finishes" : "Saved on this computer · opening one uses no GPU"}
        </p>
      </div>
      {results.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line-strong/40 p-6 text-center text-sm text-ink-3">
          Nothing generated yet. Photos you create appear here, and stay here after you close the page.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {results.map((r) => (
            <button key={r.key} type="button" disabled={disabled} onClick={() => onOpen(r)} className="group text-left disabled:opacity-50" aria-label={`Open photo from ${ago(r.createdAt)}`}>
              <div
                className={`relative aspect-[2/3] overflow-hidden rounded-xl border bg-paper-2 ${r.key === activeKey ? "border-ink ring-2 ring-ink" : "border-line"}`}
              >
                <img src={resultUrl(r.key, "result.png")} alt="" loading="lazy" className="size-full object-cover transition-transform group-hover:scale-[1.03]" />
                <img src={resultUrl(r.key, "garment.jpg")} alt="" loading="lazy" className="absolute right-1.5 bottom-1.5 size-10 rounded-lg border border-line bg-white object-contain p-0.5" />
                {TEST_ENGINES.has(r.engine) && (
                  <span className="absolute inset-x-0 top-0 bg-marigold py-0.5 text-center font-mono text-[9px] text-ink uppercase">test engine</span>
                )}
                {featured.includes(r.key) && (
                  <span className="absolute top-1.5 left-1.5 rounded-full bg-accent-strong px-1.5 py-0.5 text-[10px] text-paper" title="Featured on the home page">
                    ★
                  </span>
                )}
              </div>
              <p className="mt-1 font-mono text-[10px] text-ink-3">{ago(r.createdAt)}</p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
