import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

/** Public pages are crawlable; the API, sellers' reports and the photo library are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/research/", "/library", "/studio?r="] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
