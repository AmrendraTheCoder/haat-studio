import type { ReactNode } from "react";

/**
 * Stands where a real result will go. Never an imitation of one: a dashed
 * frame that says plainly what is missing and how it gets filled.
 */
export function Placeholder({ title, children, className = "" }: { title: string; children?: ReactNode; className?: string }) {
  return (
    <div
      className={`grid place-items-center rounded-2xl border-2 border-dashed border-line-strong/40 bg-paper-glow/60 p-5 text-center ${className}`}
    >
      <div className="max-w-[16rem]">
        <svg viewBox="0 0 24 24" className="mx-auto size-7 text-ink-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="m3 16 5-5 4 4 3-3 6 6" strokeLinejoin="round" />
          <circle cx="15.5" cy="8.5" r="1.5" />
        </svg>
        <p className="mt-2 font-mono text-[11px] tracking-[0.06em] text-ink-2 uppercase">{title}</p>
        {children && <p className="mt-1.5 text-xs leading-relaxed text-ink-3">{children}</p>}
      </div>
    </div>
  );
}
