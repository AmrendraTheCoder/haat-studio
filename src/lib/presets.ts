import type { TryOnSettings } from "@/lib/tryon/types";

/**
 * Preset model photos and sample garments come from FASHN's own Space
 * examples (Apache-2.0). `npm run setup` downloads them into public/ — they
 * are not committed, so this repo redistributes no one's photos.
 *
 * Pure data: imported by both the browser and the server.
 */
const FASHN_EXAMPLES = "https://huggingface.co/spaces/fashn-ai/fashn-vton-1.5/resolve/main/assets/examples";

export interface Preset {
  id: string;
  label: string;
  /** Under public/presets/. */
  file: string;
  sourceUrl: string;
  /** What this pose is good and bad for — shown when choosing. */
  note: string;
}

/** Front-facing and full body — what try-on handles best. Each notes its own limits. */
export const PRESETS: Preset[] = [
  { id: "standing-men", label: "Standing · men's", file: "standing-men.jpg", sourceUrl: `${FASHN_EXAMPLES}/person2.png`, note: "Full body, arms clear of the torso. Tops and bottoms." },
  { id: "standing-women", label: "Standing · women's", file: "standing-women.jpg", sourceUrl: `${FASHN_EXAMPLES}/person6.png`, note: "Full body, outdoors. Tops, bottoms and dresses." },
  { id: "casual-women", label: "Casual · women's", file: "casual-women.jpg", sourceUrl: `${FASHN_EXAMPLES}/person5.png`, note: "Mirror selfie — the phone may hide part of a top." },
];

export interface SampleGarment {
  id: string;
  label: string;
  /** Under public/samples/. */
  file: string;
  sourceUrl: string;
  category: TryOnSettings["category"];
  photoType: TryOnSettings["photoType"];
  /** The preset it is evaluated against in `npm run eval`. */
  preset: string;
}

/** All flat-lay — a product photo with no person in it is the seller's case. */
export const SAMPLE_GARMENTS: SampleGarment[] = [
  { id: "black-tee", label: "Black logo tee", file: "black-tee.jpg", sourceUrl: `${FASHN_EXAMPLES}/garment7.jpg`, category: "tops", photoType: "flat-lay", preset: "standing-men" },
  { id: "eyelet-crop-top", label: "Navy eyelet crop top", file: "eyelet-crop-top.jpg", sourceUrl: `${FASHN_EXAMPLES}/garment3.jpeg`, category: "tops", photoType: "flat-lay", preset: "standing-women" },
  { id: "tiered-skirt", label: "White tiered skirt", file: "tiered-skirt.jpg", sourceUrl: `${FASHN_EXAMPLES}/garment5.jpeg`, category: "bottoms", photoType: "flat-lay", preset: "standing-women" },
];
