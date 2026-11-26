"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n/client";
import { HELP_SECTIONS, type HelpTopic } from "@/lib/ui/help";

export { HELP_SECTIONS, type HelpTopic };

const WIDTH = 288;

/**
 * A "?" next to a control or section. Click (or Enter/Space) opens a short
 * explanation; Esc, a second click, a click elsewhere or scrolling closes it.
 * The open note is linked to the button with aria-describedby, so a screen
 * reader reads it with the button. The visible circle is small, the hit area 44 px.
 */
export function HelpTip({ topic, className = "" }: { topic: HelpTopic; className?: string }) {
  const { t } = useI18n();
  const entry = t.help.topics[topic];
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);

  const place = useCallback(() => {
    const r = button.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(Math.max(12, r.left + r.width / 2 - WIDTH / 2), window.innerWidth - WIDTH - 12);
    const above = r.bottom + 220 > window.innerHeight && r.top > 240;
    setPos({ top: above ? r.top - 6 : r.bottom + 2, left, above });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!button.current?.contains(target) && !panel.current?.contains(target)) setOpen(false);
    };
    const close = () => setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", close, { passive: true, capture: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <span className={`relative inline-flex align-middle ${className}`}>
      <button
        ref={button}
        type="button"
        aria-label={t.help.open(entry.title)}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="group -m-3 inline-grid size-11 shrink-0 place-items-center rounded-full"
      >
        <span
          aria-hidden
          className={`grid size-5 place-items-center rounded-full border text-2xs font-bold transition-colors ${
            open ? "border-accent-strong bg-accent-strong text-paper-glow" : "border-line-strong/70 bg-paper-glow text-ink-3 group-hover:border-accent-strong group-hover:text-accent-strong"
          }`}
        >
          ?
        </span>
      </button>
      {/* Portalled to <body>: a transformed ancestor (the step entrance animation) would otherwise
          become the containing block for position: fixed and misplace the note. */}
      {open &&
        pos &&
        createPortal(
        <div
          ref={panel}
          id={id}
          role="tooltip"
          className="fixed z-[60] rounded-xl border border-line bg-paper-glow p-3.5 text-left shadow-[var(--shadow-float)]"
          style={{ top: pos.top, left: pos.left, width: WIDTH, transform: pos.above ? "translateY(-100%)" : undefined }}
        >
          <p className="text-sm font-semibold text-ink">{entry.title}</p>
          <p className="mt-1 text-xs leading-relaxed font-normal text-ink-2 normal-case">{entry.body}</p>
        </div>,
          document.body,
        )}
    </span>
  );
}

/** Every help topic, grouped — the help drawer and the /help page. */
export function HelpContent({ headingLevel = "h2", compact = false }: { headingLevel?: "h2" | "h3"; compact?: boolean }) {
  const { t } = useI18n();
  const H = headingLevel;
  return (
    <div className={compact ? "space-y-6" : "space-y-10"}>
      {HELP_SECTIONS.map((s) => (
        <section key={s.id} id={`help-${s.id}`} aria-labelledby={`help-${s.id}-title`} className="scroll-mt-24">
          <H id={`help-${s.id}-title`} className={compact ? "text-xs font-semibold tracking-[0.08em] text-accent-strong uppercase" : "text-lg font-semibold tracking-tight"}>
            {t.help.sections[s.id]}
          </H>
          <dl className={`mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-paper-glow ${compact ? "" : "shadow-[var(--shadow-card)]"}`}>
            {s.topics.map((id) => (
              <div key={id} id={`help-topic-${id}`} className={compact ? "px-4 py-3" : "grid gap-1 px-5 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6"}>
                <dt className="text-sm font-semibold">{t.help.topics[id].title}</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-ink-2">{t.help.topics[id].body}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
