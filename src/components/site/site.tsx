"use client";

import Link from "next/link";
import { LanguageToggle, useI18n } from "@/lib/i18n/client";

/** The logo: a rani-pink tile with a hanger-hook "h", then the wordmark. */
export function HaatWord({ className = "", suffix, mark = true }: { className?: string; suffix?: string; mark?: boolean }) {
  return (
    // The brand is a Latin wordmark in every language; lang="en" keeps it out of the :lang(hi) rules.
    <span lang="en" className={`inline-flex items-center gap-2 font-display font-bold tracking-[-0.01em] text-ink ${className}`}>
      {mark && <LogoMark className="size-[1.4em]" />}
      <span>
        Haat
        {suffix && <span className="ml-1 font-medium text-ink-3">{suffix.charAt(0).toUpperCase() + suffix.slice(1)}</span>}
      </span>
    </span>
  );
}

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="7.5" fill="var(--color-accent-strong)" />
      {/* A hanger: hook, then shoulders — the shop's garment, in one stroke. */}
      <path
        d="M12.9 9.4a3.1 3.1 0 1 1 4.3 2.85c-.75.3-1.2.9-1.2 1.7V15M16 15 5.9 21.6c-1 .65-.55 2.15.65 2.15h18.9c1.2 0 1.65-1.5.65-2.15L16 15Z"
        fill="none"
        stroke="var(--color-paper-glow)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const NAV = [
  { href: "/#how", key: "how" },
  { href: "/#examples", key: "examples" },
  { href: "/research", key: "research" },
  { href: "/#under-the-hood", key: "hood" },
  { href: "/design", key: "design" },
] as const;

export function SiteNav({ cta = true }: { cta?: boolean }) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper-glow/85 backdrop-blur-lg backdrop-saturate-150" data-testid="site-header">
      <div className="site-container flex h-16 items-center justify-between gap-3">
      <Link href="/" aria-label={t.nav.home} className="inline-flex min-h-11 shrink-0 items-center">
        <HaatWord className="text-lg" suffix="studio" />
      </Link>
      <nav aria-label={t.nav.sectionsLabel} className="hidden items-center gap-1 lg:flex">
        {NAV.map((i) => (
          <Link key={i.href} href={i.href} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink">
            {t.nav.sections[i.key]}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        {cta && (
          <Link href="/studio" className="btn-primary !px-4 whitespace-nowrap">
            {t.nav.openStudio} <span aria-hidden>→</span>
          </Link>
        )}
        <SiteMenu />
      </div>
      </div>
    </header>
  );
}

/** Phones and tablets: the section links and the language, behind a menu button. */
function SiteMenu() {
  const { t } = useI18n();
  return (
    <details className="group relative lg:hidden">
      <summary
        aria-label={t.shell.menu}
        className="inline-grid size-11 cursor-pointer list-none place-items-center rounded-lg text-ink-2 hover:bg-paper-2 [&::-webkit-details-marker]:hidden"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </summary>
      <div className="absolute top-full right-0 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-line bg-paper-glow p-2 shadow-[var(--shadow-float)]">
        <nav aria-label={t.nav.sectionsLabel}>
          <ul>
            {NAV.map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}
                  className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-ink-2 hover:bg-paper-2 hover:text-ink"
                >
                  {t.nav.sections[i.key]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-2 border-t border-line px-3 pt-2">
          <LanguageToggle tone="compact" />
        </div>
      </div>
    </details>
  );
}

export function SiteFooter() {
  const { t } = useI18n();
  const L = t.nav.footerLinks;
  const link = "inline-flex min-h-11 items-center text-sm text-ink-2 transition-colors hover:text-ink";
  return (
    <footer className="mt-24 border-t border-line bg-paper-glow">
      <div className="site-container grid gap-10 py-14 md:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <HaatWord className="text-xl" suffix="studio" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-3">{t.nav.footerBlurb}</p>
          <LanguageToggle className="mt-6" />
        </div>
        <nav aria-label={t.nav.footerCols.product}>
          <p className="text-xs font-semibold tracking-[0.08em] text-ink uppercase">{t.nav.footerCols.product}</p>
          <ul className="mt-2">
            <li><Link href="/studio" className={link}>{L.studio}</Link></li>
            <li><Link href="/research" className={link}>{L.research}</Link></li>
          </ul>
        </nav>
        <nav aria-label={t.nav.footerCols.project}>
          <p className="text-xs font-semibold tracking-[0.08em] text-ink uppercase">{t.nav.footerCols.project}</p>
          <ul className="mt-2">
            <li><Link href="/design" className={link}>{L.design}</Link></li>
            <li><Link href="/#under-the-hood" className={link}>{L.hood}</Link></li>
            <li>
              <a href="https://github.com/AmrendraTheCoder/haat-studio" target="_blank" rel="noreferrer" className={link}>
                {L.github} <span aria-hidden className="ml-1">↗</span>
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
