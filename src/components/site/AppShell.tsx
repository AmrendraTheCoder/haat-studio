"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { HelpContent } from "@/components/shared/HelpTip";
import { TEST_ENGINES } from "@/lib/engines";
import { LanguageToggle, useI18n } from "@/lib/i18n/client";
import type { Setup } from "@/lib/site";
import { HaatWord } from "./site";

export type ShellSection = "studio" | "post" | "research" | "library" | "help";

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const ICONS: Record<ShellSection | "design" | "home", ReactNode> = {
  studio: icon("M8.5 4 4 6.5l1.5 4L7 10v10h10V10l1.5.5 1.5-4L15.5 4c-.7 1.4-2 2.2-3.5 2.2S9.2 5.4 8.5 4Z"),
  post: icon("M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Zm0 10h16M8 18h5"),
  research: icon("M4 20V10m6 10V4m6 16v-7m4 7H3"),
  library: icon("M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"),
  help: icon("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.5-11.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14m0 3v.01"),
  design: icon("M12 3a9 9 0 1 0 0 18c1 0 1.5-.7 1.5-1.5 0-.9-.7-1.2-.7-2 0-.8.7-1.5 1.5-1.5H17a4 4 0 0 0 4-4c0-5-4-9-9-9Zm-4.5 9.5h.01M9 8h.01M14 7.5h.01"),
  home: icon("M4 11 12 4l8 7v9h-5v-6H9v6H4v-9Z"),
};

const TOOLS: { id: ShellSection; href: string }[] = [
  { id: "studio", href: "/studio" },
  { id: "post", href: "/studio/post" },
  { id: "research", href: "/research" },
  { id: "library", href: "/library" },
];

/**
 * The working pages' frame: a sidebar with every tool, a top bar with where you
 * are, today's free GPU, the language and Help. On phones the sidebar becomes a
 * menu drawer.
 */
export function AppShell({
  setup,
  active,
  crumbs,
  children,
}: {
  setup: Setup;
  active: ShellSection;
  /** After the root: e.g. [{ label: "Try-on Studio", href: "/studio" }, { label: "Review" }]. */
  crumbs: { label: string; href?: string }[];
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-paper-glow lg:flex print:hidden">
        <SideNav active={active} />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-line bg-paper-glow/90 backdrop-blur-lg print:hidden">
          <div className="flex h-16 items-center gap-2 px-3 sm:px-6">
            <button
              type="button"
              onClick={() => setMenu(true)}
              aria-label={t.shell.menu}
              className="inline-grid size-11 place-items-center rounded-lg text-ink-2 hover:bg-paper-2 lg:hidden"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <Link href="/" aria-label={t.nav.home} className="inline-flex min-h-11 items-center lg:hidden">
              <HaatWord className="text-base" />
            </Link>
            <nav aria-label={t.shell.crumbs} className="hidden min-w-0 lg:block">
              <ol className="flex min-w-0 items-center gap-1.5 text-sm">
                <li className="text-ink-3">{t.shell.root}</li>
                {crumbs.map((c, i) => (
                  <li key={i} className="flex min-w-0 items-center gap-1.5">
                    <span aria-hidden className="text-ink-3">/</span>
                    {c.href && i < crumbs.length - 1 ? (
                      <Link href={c.href} className="inline-flex min-h-11 items-center truncate text-ink-2 hover:text-ink">
                        {c.label}
                      </Link>
                    ) : (
                      <span aria-current={i === crumbs.length - 1 ? "page" : undefined} className="truncate font-semibold text-ink">
                        {c.label}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <StatusChip setup={setup} className="hidden sm:inline-flex" />
              <LanguageToggle />
              <button type="button" onClick={() => setHelp(true)} className="btn-ghost !gap-1.5 !px-3 shadow-none" aria-haspopup="dialog">
                {ICONS.help}
                <span className="hidden sm:inline">{t.shell.help}</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-line px-4 py-1.5 sm:hidden">
            <StatusChip setup={setup} />
          </div>
        </header>

        {children}
      </div>

      {menu && (
        <Drawer side="left" label={t.shell.navLabel} closeLabel={t.shell.closeMenu} onClose={() => setMenu(false)}>
<SideNav active={active} />
        </Drawer>
      )}
      {help && (
        <Drawer side="right" label={t.help.drawerTitle} closeLabel={t.help.close} onClose={() => setHelp(false)} title={t.help.drawerTitle}>
          <div className="px-5 pb-8">
            <p className="text-sm leading-relaxed text-ink-2">{t.help.drawerLead}</p>
            <Link href="/help" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent-strong hover:underline">
              {t.help.openFull}
            </Link>
            <div className="mt-4">
              <HelpContent headingLevel="h3" compact />
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}

function SideNav({ active }: { active: ShellSection }) {
  const { t } = useI18n();
  const item = (on: boolean) =>
    `flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
      on ? "bg-accent-wash text-accent-strong" : "text-ink-2 hover:bg-paper-2 hover:text-ink"
    }`;
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-line px-5">
        <Link href="/" aria-label={t.nav.home} className="inline-flex min-h-11 items-center">
          <HaatWord className="text-lg" suffix="studio" />
        </Link>
      </div>
      <nav aria-label={t.shell.navLabel} className="flex-1 overflow-y-auto px-3 py-5">
        <p className="px-3 text-2xs font-semibold tracking-[0.08em] text-ink-3 uppercase">{t.shell.groups.tools}</p>
        <ul className="mt-2 space-y-0.5">
          {TOOLS.map((x) => (
            <li key={x.id}>
              <Link href={x.href} aria-current={active === x.id ? "page" : undefined} className={item(active === x.id)}>
                {ICONS[x.id]}
                {t.shell.nav[x.id]}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-7 px-3 text-2xs font-semibold tracking-[0.08em] text-ink-3 uppercase">{t.shell.groups.resources}</p>
        <ul className="mt-2 space-y-0.5">
          <li>
            <Link href="/help" aria-current={active === "help" ? "page" : undefined} className={item(active === "help")}>
              {ICONS.help}
              {t.shell.nav.help}
            </Link>
          </li>
          <li>
            <Link href="/design" className={item(false)}>
              {ICONS.design}
              {t.shell.nav.design}
            </Link>
          </li>
          <li>
            <Link href="/" className={item(false)}>
              {ICONS.home}
              {t.shell.nav.home}
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export function StatusChip({ setup, className = "" }: { setup: Setup; className?: string }) {
  const { t } = useI18n();
  const ready = setup.engine.configured;
  const test = TEST_ENGINES.has(setup.engine.id);
  const quota = setup.quota;
  const label = !ready ? t.nav.engine.demo : test ? t.nav.engine.test : quota ? t.quota.chip(quota.photosLeft) : t.nav.engine.ready;
  // Green while photos remain, amber when generation is off or today's quota is spent.
  const ok = ready && (!quota || quota.photosLeft > 0);
  return (
    <span
      className={`chip ${ok ? "!border-good/30 !bg-good-wash !text-good" : "!border-marigold/60 !bg-marigold-wash !text-ink-2"} ${className}`}
      title={ready ? setup.engine.label : setup.engine.missing}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${ok ? "bg-good" : "bg-marigold"}`} />
      {label}
    </span>
  );
}

/** Side sheet: modal, focus starts on Close, Tab stays inside, Esc closes and returns focus. */
function Drawer({
  side,
  label,
  closeLabel,
  title,
  onClose,
  children,
}: {
  side: "left" | "right";
  label: string;
  closeLabel: string;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])")];
      if (items.length === 0) return;
      const [first, last] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 print:hidden" role="dialog" aria-modal="true" aria-label={label}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        className={`rise absolute inset-y-0 flex w-[min(24rem,88vw)] flex-col bg-paper-glow shadow-[var(--shadow-float)] ${side === "left" ? "left-0 border-r" : "right-0 border-l"} border-line`}
      >
        <div className={title ? "flex h-16 shrink-0 items-center justify-between gap-2 border-b border-line pr-3 pl-5" : "absolute top-2.5 right-2 z-10"}>
          {title && <p className="text-base font-semibold">{title}</p>}
          <button ref={close} type="button" onClick={onClose} aria-label={closeLabel} className="inline-grid size-11 place-items-center rounded-lg text-ink-2 hover:bg-paper-2">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto ${title ? "pt-4" : ""}`}>{children}</div>
      </div>
    </div>
  );
}
