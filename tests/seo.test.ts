import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { messages } from "@/lib/i18n/messages";
import { PRIVATE, pageMeta, siteUrl } from "@/lib/seo";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("SEO", () => {
  it("uses SITE_URL, then Vercel's production domain, then the dev server", () => {
    delete process.env.SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(siteUrl()).toBe("http://localhost:3100");
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "haatstudio.vercel.app";
    expect(siteUrl()).toBe("https://haatstudio.vercel.app");
    process.env.SITE_URL = "https://haat.example/";
    expect(siteUrl()).toBe("https://haat.example");
  });

  it("lists the public pages in the sitemap and keeps private ones out", () => {
    process.env.SITE_URL = "https://haat.example";
    const urls = sitemap().map((u) => u.url);
    expect(urls).toEqual(expect.arrayContaining(["https://haat.example/", "https://haat.example/studio", "https://haat.example/research"]));
    expect(urls.some((u) => /\/api\/|\/library|\/research\/[0-9a-f]/.test(u))).toBe(false);
  });

  it("blocks the API, reports and the library for crawlers and points them to the sitemap", () => {
    process.env.SITE_URL = "https://haat.example";
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.disallow).toEqual(expect.arrayContaining(["/api/", "/research/", "/library"]));
    expect(r.sitemap).toBe("https://haat.example/sitemap.xml");
  });

  it("gives every page a canonical link, social preview and noindex when private", () => {
    const m = pageMeta({ title: "Library", description: "d", path: "/library", noindex: true });
    expect(m.alternates?.canonical).toBe("/library");
    expect(m.openGraph?.title).toBe("Library · Haat Studio");
    expect(m.robots).toEqual(PRIVATE);
    expect(pageMeta({ title: "Studio", description: "d", path: "/studio" }).robots).toBeUndefined();
  });

  it("has a description for every page in English and Hindi, within search-snippet length", () => {
    for (const locale of ["en", "hi"] as const) {
      const d = messages[locale].meta.descriptions;
      for (const k of ["studio", "post", "research", "library", "help", "design"] as const) {
        expect(d[k].length).toBeGreaterThan(40);
        expect(d[k].length).toBeLessThanOrEqual(170);
      }
    }
  });

  it("ships the share image, icons and a home-screen manifest", () => {
    const app = path.join(process.cwd(), "src", "app");
    for (const f of ["opengraph-image.jpg", "twitter-image.jpg", "icon.svg", "apple-icon.png", "favicon.ico"]) expect(existsSync(path.join(app, f))).toBe(true);
    expect(statSync(path.join(app, "opengraph-image.jpg")).size).toBeLessThan(300_000);
    const m = manifest();
    expect(m.name).toBe("Haat Studio");
    expect(m.icons?.length).toBeGreaterThan(0);
  });

  it("states only facts in the structured data (no ratings or reviews)", () => {
    const page = readFileSync(path.join(process.cwd(), "src", "app", "page.tsx"), "utf8");
    expect(page).toContain('"application/ld+json"');
    expect(page).not.toMatch(/aggregateRating|reviewCount|ratingValue/);
  });
});
