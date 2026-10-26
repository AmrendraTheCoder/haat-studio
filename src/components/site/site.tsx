"use client";

import Link from "next/link";
import { TEST_ENGINES } from "@/lib/engines";
import { LanguageToggle, useI18n } from "@/lib/i18n/client";
import type { Setup } from "@/lib/site";

/** Lowercase display wordmark with the magenta full stop, as in stiche-v2. */
export function HaatWord({ className = "", suffix }: { className?: string; suffix?: string }) {
  return (
    // The brand is a Latin wordmark in every language; lang="en" keeps its mono suffix under :lang(hi).
    <span lang="en" className={`inline-flex items-baseline font-display font-extrabold tracking-[-0.06em] ${className}`}>
      haat<span className="text-accent-strong">.</span>
      {suffix && <span className="ml-1.5 font-mono text-[0.42em] font-medium tracking-normal text-ink-3">{suffix}</span>}
    </span>
  );
}

/** Renders the items twice so the -50% keyframe loops without a gap. Hover pauses. */
export function ScrollingStrip({ items, className = "" }: { items: readonly string[]; className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <ul className="strip flex w-max items-center gap-10 pr-10">
        {items.concat(items).map((item, i) => (
          <li key={i} className="flex items-center gap-10 whitespace-nowrap" aria-hidden={i >= items.length}>
            <span>{item}</span>
            <span aria-hidden className="inline-block size-2 rounded-full bg-current opacity-40" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Marquee's scallop border: one 80px tile repeated, drifting one tile per loop. CSS only. */
export function WaveBorder({ flip = false, className = "" }: { flip?: boolean; className?: string }) {
  const id = flip ? "scallop-flip" : "scallop";
  return (
    <div aria-hidden className={`relative h-12 overflow-hidden ${className}`} style={flip ? { transform: "scaleY(-1)" } : undefined}>
      <svg className="scallop absolute inset-y-0 left-0 h-12" style={{ width: "calc(100% + 80px)" }}>
        <defs>
          <pattern id={id} width="80" height="48" patternUnits="userSpaceOnUse">
            <path d="M 0 48 L 0 28 A 40 22 0 0 1 80 28 L 80 48 Z" fill="var(--color-ink)" />
            <path d="M 6 30 A 34 17 0 0 1 74 30" stroke="var(--color-paper)" strokeWidth="0.6" fill="none" opacity="0.5" />
            <circle cx="40" cy="14" r="1" fill="var(--color-ink)" opacity="0.7" />
          </pattern>
        </defs>
        <rect width="100%" height="48" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}

const NAV = [
  { href: "/#how", key: "how" },
  { href: "/#examples", key: "examples" },
  { href: "/research", key: "research" },
  { href: "/#under-the-hood", key: "hood" },
  { href: "/design", key: "design" },
] as const;

/** Header for the working pages: the three tools, and whether generation is on. */
export function StudioHeader({ setup }: { setup: Setup }) {
  const { t } = useI18n();
  const ready = setup.engine.configured;
  const test = TEST_ENGINES.has(setup.engine.id);
  const quota = setup.quota;
  const label = !ready ? t.nav.engine.demo : test ? t.nav.engine.test : quota ? t.quota.chip(quota.photosLeft) : t.nav.engine.ready;
  // Green while photos remain, amber when generation is off or today's quota is spent.
  const ok = ready && (!quota || quota.photosLeft > 0);
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-5">
          <Link href="/" aria-label={t.nav.home} className="inline-flex min-h-11 items-center">
            <HaatWord className="text-2xl" suffix="studio" />
          </Link>
          <nav aria-label={t.nav.tools} className="hidden items-center gap-2 text-sm sm:flex">
            <Link href="/studio" className="inline-flex min-h-11 items-center px-2 text-ink-2 hover:text-ink">
              {t.nav.tryon}
            </Link>
            <Link href="/research" className="inline-flex min-h-11 items-center px-2 text-ink-2 hover:text-ink">
              {t.nav.research}
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`chip hidden sm:inline-flex ${ok ? "!border-good/40 !text-good" : "!border-marigold/60 !text-ink-2"}`}
            title={ready ? setup.engine.label : setup.engine.missing}
          >
            <span className={`size-1.5 rounded-full ${ok ? "bg-good" : "bg-marigold"}`} />
            {label}
          </span>
          <LanguageToggle />
        </div>
      </div>
      <nav aria-label={t.nav.tools} className="flex items-center gap-2 border-t border-line/50 px-2 text-sm sm:hidden">
        <Link href="/studio" className="inline-flex min-h-11 items-center px-2">
          {t.nav.tryon}
        </Link>
        <Link href="/research" className="inline-flex min-h-11 items-center px-2">
          {t.nav.research}
        </Link>
        <span className={`chip ml-auto ${ok ? "!border-good/40 !text-good" : "!border-marigold/60 !text-ink-2"}`}>
          <span className={`size-1.5 rounded-full ${ok ? "bg-good" : "bg-marigold"}`} />
          {label}
        </span>
      </nav>
    </header>
  );
}

export function SiteNav({ cta = true }: { cta?: boolean }) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label={t.nav.home} className="inline-flex min-h-11 items-center">
          <HaatWord className="text-2xl" suffix="studio" />
        </Link>
        <nav aria-label={t.nav.sectionsLabel} className="hidden items-center gap-6 text-sm lg:flex">
          {NAV.map((i) => (
            <Link key={i.href} href={i.href} className="inline-flex min-h-11 items-center text-ink-2 transition-colors hover:text-ink">
              {t.nav.sections[i.key]}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          {cta && (
            <Link href="/studio" className="btn-primary !px-4 !py-2">
              {t.nav.openStudio} <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-24 border-t border-line bg-paper-2">
      <div className="border-b border-line py-5 text-ink-2">
        <ScrollingStrip items={t.nav.ticker} className="font-display text-xl font-bold tracking-tight sm:text-2xl" />
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-end md:justify-between">
        <div>
          <HaatWord className="text-5xl" />
          <p className="mt-3 max-w-md text-sm text-ink-3">{t.nav.footerBlurb}</p>
        </div>
        <nav aria-label={t.nav.footerLabel} className="flex flex-wrap gap-x-6 text-sm text-ink-2">
          {[
            ["/studio", t.nav.footerLinks.studio],
            ["/research", t.nav.footerLinks.research],
            ["/design", t.nav.footerLinks.design],
            ["/#under-the-hood", t.nav.footerLinks.hood],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="inline-flex min-h-11 items-center hover:text-ink">
              {label}
            </Link>
          ))}
          <a href="https://github.com/AmrendraTheCoder/haat-studio" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center hover:text-ink">
            {t.nav.footerLinks.github}
          </a>
        </nav>
      </div>
    </footer>
  );
}
