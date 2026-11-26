import type { MetadataRoute } from "next";

/** Lets a seller add Haat Studio to the phone's home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Haat Studio",
    short_name: "Haat Studio",
    description: "On-model photos, Instagram posts and market plans for small Indian sellers. Free.",
    start_url: "/studio",
    display: "standalone",
    background_color: "#FBFAF8",
    theme_color: "#C8105A",
    lang: "en-IN",
    categories: ["business", "photo", "productivity"],
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  };
}
