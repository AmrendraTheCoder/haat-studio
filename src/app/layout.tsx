import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/noto-sans-devanagari";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale, getMessages } from "@/lib/i18n/server";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: { default: t.meta.home, template: "%s · Haat Studio" }, description: t.meta.description };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#EFE7D2",
  colorScheme: "light",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The seller's language comes from a cookie, so the page is rendered in it
  // on the server — no flash of English — and `lang` tells screen readers
  // to pronounce Hindi as Hindi.
  const locale = await getLocale();
  return (
    <html lang={locale}>
      {/* Extensions (e.g. colour pickers) add attributes to <body> before React hydrates. */}
      <body className="min-h-dvh font-sans" suppressHydrationWarning>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
