import type { Metadata, Viewport } from "next";
import "@fontsource/carlito/400.css";
import "@fontsource/carlito/700.css";
import "@fontsource-variable/noto-sans-devanagari";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { siteUrl } from "@/lib/seo";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t.meta.home, template: "%s · Haat Studio" },
    description: t.meta.description,
    applicationName: "Haat Studio",
    appleWebApp: { title: "Haat Studio", capable: true, statusBarStyle: "default" },
    keywords: ["virtual try-on", "AI model photos", "product photos on model", "Instagram seller", "small business India", "kurti photoshoot", "saree model photo", "Instagram post maker", "Hinglish captions", "market research for sellers", "FASHN VTON", "LoRA"],
    authors: [{ name: "Amrendra Vikram Singh" }, { name: "Avirat Kaushik" }],
    creator: "Amrendra Vikram Singh, Avirat Kaushik",
    category: "business",
    alternates: { canonical: "/" },
    openGraph: { type: "website", siteName: "Haat Studio", title: t.meta.home, description: t.meta.description, url: "/", locale: "en_IN", alternateLocale: ["hi_IN"] },
    twitter: { card: "summary_large_image", title: t.meta.home, description: t.meta.description },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FBFAF8",
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
      <body className="min-h-dvh font-sans text-ink antialiased" suppressHydrationWarning>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
