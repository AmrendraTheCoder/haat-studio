import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Haat Studio",
  description: "Put your product on a model from a single photo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
