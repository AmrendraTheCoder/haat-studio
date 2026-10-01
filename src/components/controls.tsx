"use client";

import { useRef, useState, type ReactNode } from "react";

const ACCEPT = "image/jpeg,image/png,image/webp";

export function Step({ n, title, children, aside }: { n: number; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-ink">
          <span className="mr-2 inline-grid size-5 place-items-center rounded-full bg-ink text-[11px] text-paper">{n}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-line bg-paper p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`rounded-lg px-2 py-1.5 text-center text-sm transition-colors ${
              active ? "bg-card font-medium text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"
            }`}
          >
            {o.label}
            {o.hint && <span className="block text-[11px] font-normal text-muted">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Click or drop an image. Shows the chosen one with a replace affordance. */
export function Dropzone({
  previewUrl,
  onFile,
  title,
  hint,
  className = "",
}: {
  previewUrl: string | null;
  onFile: (file: File) => void;
  title: string;
  hint: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

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
        over ? "border-accent bg-accent-soft" : "border-line bg-paper hover:border-muted"
      } ${className}`}
    >
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => take(e.target.files)} />
      <button type="button" onClick={() => input.current?.click()} className="absolute inset-0 size-full" aria-label={title} />
      {previewUrl ? (
        <>
          <img src={previewUrl} alt="" className="pointer-events-none size-full object-contain p-3" />
          <span className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-ink/80 px-3 py-1 text-xs text-paper opacity-0 transition-opacity group-hover:opacity-100">
            Replace
          </span>
        </>
      ) : (
        <div className="pointer-events-none grid size-full place-items-center p-6 text-center">
          <div>
            <svg viewBox="0 0 24 24" className="mx-auto mb-3 size-8 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M12 16V4m0 0-4 4m4-4 4 4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="font-medium text-ink">{title}</p>
            <p className="mt-1 text-xs text-muted">{hint}</p>
          </div>
        </div>
      )}
    </div>
  );
}
