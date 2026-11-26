import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

/** The public pages, most important first. Reports and saved photos are private and left out. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const pages: [string, number, MetadataRoute.Sitemap[number]["changeFrequency"]][] = [
    ["/", 1, "weekly"],
    ["/studio", 0.9, "weekly"],
    ["/research", 0.8, "monthly"],
    ["/studio/post", 0.7, "monthly"],
    ["/help", 0.5, "monthly"],
    ["/design", 0.4, "yearly"],
  ];
  const lastModified = new Date();
  return pages.map(([path, priority, changeFrequency]) => ({ url: `${base}${path}`, lastModified, changeFrequency, priority }));
}
