import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Haat Studio — your product, on a model", template: "%s · Haat Studio" },
  description: "Upload a photo of your garment and get it back worn by a model, sized for Instagram. Free, for Indian sellers.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#EFE7D2",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      {/* Extensions (e.g. colour pickers) add attributes to <body> before React hydrates. */}
      <body className="min-h-dvh font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
