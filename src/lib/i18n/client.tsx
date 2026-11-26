"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useId, useTransition, type ReactNode } from "react";
import { radioKeyDown, rovingTabIndex } from "@/lib/client/roving";
import { LOCALE_COOKIE, LOCALES, type Locale } from "./locale";
import { messages, type Messages } from "./messages";

const I18n = createContext<{ locale: Locale; t: Messages }>({ locale: "en", t: messages.en });

/** Set once in the root layout from the cookie, so every client component renders in the seller's language. */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <I18n.Provider value={{ locale, t: messages[locale] }}>{children}</I18n.Provider>;
}

export const useI18n = () => useContext(I18n);

function saveLocale(next: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
}

/** Each language is named in itself, so a seller who can't read the current one still finds theirs. */
const NATIVE: Record<Locale, string> = { en: "English", hi: "हिन्दी" };

/**
 * English | हिन्दी, as a two-option radio group with a "Language" label. Saves the
 * choice in a cookie for a year and re-renders the page in place — no reload,
 * and nothing typed so far is lost. Lives in the sidebar footer, the phone menu
 * and the site footer, not the top bar.
 */
export function LanguageToggle({ className = "", tone = "default" }: { className?: string; tone?: "default" | "compact" }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const id = useId();
  const choose = (next: Locale) => {
    if (next === locale || pending) return;
    saveLocale(next);
    start(() => router.refresh());
  };
  return (
    <div className={`flex items-center gap-3 ${tone === "compact" ? "justify-between" : ""} ${className}`} data-testid="language-switch">
      <span id={id} className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-3">
        <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3c2.3 2.5 3.5 5.5 3.5 9s-1.2 6.5-3.5 9c-2.3-2.5-3.5-5.5-3.5-9S9.7 5.5 12 3Z" />
        </svg>
        {t.common.language}
      </span>
      <div role="radiogroup" aria-labelledby={id} aria-busy={pending} className="inline-flex rounded-lg border border-line bg-paper-2 p-0.5">
        {LOCALES.map((l, i) => (
          <button
            key={l}
            type="button"
            role="radio"
            lang={l}
            aria-checked={locale === l}
            tabIndex={rovingTabIndex(locale === l, i, true)}
            onKeyDown={radioKeyDown}
            onClick={() => choose(l)}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors ${
              locale === l ? "bg-paper-glow text-ink shadow-[var(--shadow-card)]" : "text-ink-3 hover:text-ink"
            } ${pending ? "cursor-progress" : ""}`}
          >
            {NATIVE[l]}
          </button>
        ))}
      </div>
    </div>
  );
}
