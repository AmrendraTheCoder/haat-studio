/** Pure — imported by the server (cookie) and the browser (toggle). */
export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];

/** The cookie that remembers the seller's language. A cookie, not localStorage, so server-rendered pages come out in the right language. */
export const LOCALE_COOKIE = "haat-lang";

export const isLocale = (v: unknown): v is Locale => v === "en" || v === "hi";
