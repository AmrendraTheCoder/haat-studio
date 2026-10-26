import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, type Locale } from "./locale";
import { messages } from "./messages";

/** The seller's chosen language, from the cookie the toggle sets. English when unset. */
export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : "en";
}

export async function getMessages() {
  const locale = await getLocale();
  return { locale, t: messages[locale] };
}
