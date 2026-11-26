import type { Metadata } from "next";

/**
 * The public address of the site, for canonical links, the sitemap and social previews.
 * SITE_URL wins; on Vercel the production domain is known at build and run time; locally it is
 * the dev server.
 */
export function siteUrl(): string {
  const fromEnv = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  return (fromEnv || "http://localhost:3100").replace(/\/$/, "");
}

/** Pages that are a seller's own work (a report, the photo library) stay out of search results. */
export const PRIVATE = { index: false, follow: false } as const;

/** Title, description, canonical link and social preview for one page. */
export function pageMeta({ title, description, path, noindex = false }: { title: string; description: string; path: string; noindex?: boolean }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: `${title} · Haat Studio`, description, url: path },
    twitter: { title: `${title} · Haat Studio`, description },
    ...(noindex && { robots: PRIVATE }),
  };
}
