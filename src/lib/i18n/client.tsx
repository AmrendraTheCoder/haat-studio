"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useTransition, type ReactNode } from "react";
import { LOCALE_COOKIE, type Locale } from "./locale";
import { messages, type Messages } from "./messages";

const I18n = createContext<{ locale: Locale; t: Messages }>({ locale: "en", t: messages.en });

/** Set once in the root layout from the cookie, so every client component renders in the seller's language. */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <I18n.Provider value={{ locale, t: messages[locale] }}>{children}</I18n.Provider>;
}

export const useI18n = () => useContext(I18n);

/**
 * English ⇄ हिन्दी. Saves the choice in a cookie for a year and re-renders
 * the page in place — no reload, and nothing typed so far is lost.
 */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next: Locale = locale === "en" ? "hi" : "en";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        start(() => router.refresh());
      }}
      lang={next}
      title={t.common.switchLanguage}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line-strong/50 px-3 text-sm font-medium hover:bg-paper-2 disabled:opacity-60 ${className}`}
    >
      {next === "hi" ? "हिन्दी" : "English"}
    </button>
  );
}
