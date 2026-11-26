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
  /**
   * What the model already has on. A bottom can only replace a bottom: on a
   * model in a dress there is nothing separate to swap, and in the first real
   * eval (2026-10-26) a tiered skirt blended into the dress instead.
   */
  wearing: "separates" | "one-piece";
  /** Garment categories this preset has handled well, or is expected to. */
  suits: TryOnSettings["category"][];
  /** Who the model is, for the model filter. */
  gender: "men" | "women";
}

/** Front-facing and full body — what try-on handles best. Each notes its own limits. */
export const PRESETS: Preset[] = [
  { id: "standing-men", label: "Standing · men's", file: "standing-men.jpg", sourceUrl: `${FASHN_EXAMPLES}/person2.png`, note: "Full body, arms clear of the torso. Tops and bottoms.", wearing: "separates", suits: ["tops", "bottoms"], gender: "men" },
  { id: "standing-women", label: "Standing · women's", file: "standing-women.jpg", sourceUrl: `${FASHN_EXAMPLES}/person6.png`, note: "Wearing a dress: good for tops and dresses, not for skirts or trousers.", wearing: "one-piece", suits: ["tops", "one-pieces"], gender: "women" },
  { id: "casual-women", label: "Casual · women's", file: "casual-women.jpg", sourceUrl: `${FASHN_EXAMPLES}/person5.png`, note: "Tee and shorts: good for bottoms. The phone may hide part of a top.", wearing: "separates", suits: ["bottoms", "tops"], gender: "women" },
];

export interface SampleGarment {
  id: string;
  label: string;
  /** Under public/samples/. */
  file: string;
  sourceUrl: string;
  category: TryOnSettings["category"];
  photoType: TryOnSettings["photoType"];
  /** The preset it is evaluated against in `npm run eval` (catalogue samples: the suggested model). */
  preset: string;
  /** A real product photo from a public shop listing, copied locally for demos — never part of `npm run eval`. */
  catalogue?: boolean;
}

/** All flat-lay — a product photo with no person in it is the seller's case. */
export const SAMPLE_GARMENTS: SampleGarment[] = [
  { id: "black-tee", label: "Black logo tee", file: "black-tee.jpg", sourceUrl: `${FASHN_EXAMPLES}/garment7.jpg`, category: "tops", photoType: "flat-lay", preset: "standing-men" },
  { id: "eyelet-crop-top", label: "Navy eyelet crop top", file: "eyelet-crop-top.jpg", sourceUrl: `${FASHN_EXAMPLES}/garment3.jpeg`, category: "tops", photoType: "flat-lay", preset: "standing-women" },
  { id: "tiered-skirt", label: "White tiered skirt", file: "tiered-skirt.jpg", sourceUrl: `${FASHN_EXAMPLES}/garment5.jpeg`, category: "bottoms", photoType: "flat-lay", preset: "casual-women" },
];

/**
 * Catalogue samples: garment-only product photos from public Indian shop listings
 * (collected for the project's research data), copied into public/samples for
 * demos. Not committed (public/samples is gitignored) and not part of
 * `npm run eval`, which only runs SAMPLE_GARMENTS. The source listings had tops
 * only, so every catalogue sample is a top — said plainly rather than padded.
 */
export const CATALOGUE_SAMPLES: SampleGarment[] = [
  { id: "cat-black-chest-tee", label: "Black tee with chest print", file: "cat-black-chest-tee.jpg", sourceUrl: "https://m.media-amazon.com/images/I/41EdRiQ1ieL._SL1500_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-men", catalogue: true },
  { id: "cat-black-embroidered-blouse", label: "Black embroidered peasant blouse", file: "cat-black-embroidered-blouse.jpg", sourceUrl: "https://m.media-amazon.com/images/I/61HLWIoE0RL._SL1500_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-women", catalogue: true },
  { id: "cat-plain-black-tee", label: "Plain black tee", file: "cat-plain-black-tee.jpg", sourceUrl: "https://m.media-amazon.com/images/I/512c30WKJwL._SL1500_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-men", catalogue: true },
  { id: "cat-green-acid-wash-tee", label: "Green acid-wash tee", file: "cat-green-acid-wash-tee.jpg", sourceUrl: "https://m.media-amazon.com/images/I/51yxtKgkQUL._SL1004_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-men", catalogue: true },
  { id: "cat-black-slogan-tee", label: "Black slogan tee", file: "cat-black-slogan-tee.jpg", sourceUrl: "https://m.media-amazon.com/images/I/51hMupZExaL._SL1500_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-men", catalogue: true },
  { id: "cat-black-chess-tee", label: "Black chess print tee", file: "cat-black-chess-tee.jpg", sourceUrl: "https://m.media-amazon.com/images/I/61xEGNg0zWL._SL1500_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-men", catalogue: true },
  { id: "cat-plain-navy-tee", label: "Plain navy tee", file: "cat-plain-navy-tee.jpg", sourceUrl: "https://m.media-amazon.com/images/I/51e8e15i7ZL._SL1500_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-men", catalogue: true },
  { id: "cat-black-dragonfly-tee", label: "Black dragonfly print tee", file: "cat-black-dragonfly-tee.jpg", sourceUrl: "https://m.media-amazon.com/images/I/51s1Mhpf0LL._SL1195_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-men", catalogue: true },
  { id: "cat-black-paris-tee", label: "Black “Paris 1980” tee", file: "cat-black-paris-tee.jpg", sourceUrl: "https://m.media-amazon.com/images/I/51ZvoVUqpxL._SL1500_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-men", catalogue: true },
  { id: "cat-plain-red-tee", label: "Plain red tee", file: "cat-plain-red-tee.jpg", sourceUrl: "https://m.media-amazon.com/images/I/51ZlBYtm1EL._SL1199_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-men", catalogue: true },
  { id: "cat-red-embroidered-blouse", label: "Red embroidered peasant blouse", file: "cat-red-embroidered-blouse.jpg", sourceUrl: "https://m.media-amazon.com/images/I/61gDiA8pNKL._SL1500_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-women", catalogue: true },
  { id: "cat-black-floral-top", label: "Black floral long-sleeve top", file: "cat-black-floral-top.jpg", sourceUrl: "https://m.media-amazon.com/images/I/71mk8xrnxvL._SL1500_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-women", catalogue: true },
  { id: "cat-olive-slogan-tee", label: "Olive slogan tee", file: "cat-olive-slogan-tee.jpg", sourceUrl: "https://m.media-amazon.com/images/I/61AbaKLWLeL._SL1500_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-men", catalogue: true },
  { id: "cat-grey-linen-shirt", label: "Grey linen button-down shirt", file: "cat-grey-linen-shirt.jpg", sourceUrl: "https://m.media-amazon.com/images/I/51R1iFya-dL._SL1024_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-men", catalogue: true },
  { id: "cat-green-bengali-tee", label: "Green Bengali-script tee", file: "cat-green-bengali-tee.jpg", sourceUrl: "https://m.media-amazon.com/images/I/51AopHOq5uL._SL1500_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-men", catalogue: true },
  { id: "cat-black-wolves-tee", label: "Black wolves print tee", file: "cat-black-wolves-tee.jpg", sourceUrl: "https://m.media-amazon.com/images/I/51zrhDJnXwL._SL1200_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-men", catalogue: true },
  { id: "cat-olive-knit-top", label: "Olive knit long-sleeve top", file: "cat-olive-knit-top.jpg", sourceUrl: "https://m.media-amazon.com/images/I/713RKYSf7aL._SL1500_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-women", catalogue: true },
  { id: "cat-blue-jagannath-tee", label: "Blue Jagannath print tee", file: "cat-blue-jagannath-tee.jpg", sourceUrl: "https://m.media-amazon.com/images/I/61ZpfGRcrKL._SL1448_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-men", catalogue: true },
  { id: "cat-beige-zip-polo", label: "Beige zip-collar polo", file: "cat-beige-zip-polo.jpg", sourceUrl: "https://m.media-amazon.com/images/I/51P10xAdf7L._SL1200_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-men", catalogue: true },
  { id: "cat-maroon-tea-tee", label: "Maroon Bengali tea tee", file: "cat-maroon-tea-tee.jpg", sourceUrl: "https://m.media-amazon.com/images/I/71nAlKpOUCL._SL1500_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-men", catalogue: true },
  { id: "cat-blue-embroidered-blouse", label: "Blue embroidered peasant blouse", file: "cat-blue-embroidered-blouse.jpg", sourceUrl: "https://m.media-amazon.com/images/I/712TQLFcrwL._SL1500_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-women", catalogue: true },
  { id: "cat-green-cami-top", label: "Green cami top", file: "cat-green-cami-top.jpg", sourceUrl: "https://m.media-amazon.com/images/I/31LUsmc4KlL.jpg", category: "tops", photoType: "flat-lay", preset: "standing-women", catalogue: true },
  { id: "cat-white-chill-tee", label: "White “Chill” print tee", file: "cat-white-chill-tee.jpg", sourceUrl: "https://m.media-amazon.com/images/I/51GNlCYhAfL._SL1080_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-men", catalogue: true },
  { id: "cat-mustard-zip-polo", label: "Mustard zip-collar polo", file: "cat-mustard-zip-polo.jpg", sourceUrl: "https://m.media-amazon.com/images/I/51vXqQXt-kL._SL1151_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-men", catalogue: true },
  { id: "cat-beige-drawstring-blouse", label: "Beige drawstring blouse", file: "cat-beige-drawstring-blouse.jpg", sourceUrl: "https://m.media-amazon.com/images/I/61Kx1vlDaHL._SL1500_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-women", catalogue: true },
  { id: "cat-pink-ribbed-crop-top", label: "Pink ribbed crop top", file: "cat-pink-ribbed-crop-top.jpg", sourceUrl: "https://m.media-amazon.com/images/I/518FYF0hTLL._SL1440_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-women", catalogue: true },
  { id: "cat-white-holi-tee", label: "White Holi print tee", file: "cat-white-holi-tee.jpg", sourceUrl: "https://m.media-amazon.com/images/I/51+O8JpBuHL._SL1500_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-men", catalogue: true },
  { id: "cat-white-embroidered-blouse", label: "White embroidered peasant blouse", file: "cat-white-embroidered-blouse.jpg", sourceUrl: "https://m.media-amazon.com/images/I/71QfbSDSHTL._SL1500_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-women", catalogue: true },
  { id: "cat-grey-striped-sweatshirt", label: "Grey striped-sleeve sweatshirt", file: "cat-grey-striped-sweatshirt.jpg", sourceUrl: "https://m.media-amazon.com/images/I/71JzCYAQSuL._SL1500_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-women", catalogue: true },
  { id: "cat-pink-henley-top", label: "Pink henley top", file: "cat-pink-henley-top.jpg", sourceUrl: "https://m.media-amazon.com/images/I/61RqhBquLgL._SL1500_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-women", catalogue: true },
  { id: "cat-light-blue-long-tee", label: "Light blue long-sleeve tee", file: "cat-light-blue-long-tee.jpg", sourceUrl: "https://m.media-amazon.com/images/I/5115q86WahL._SL1024_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-men", catalogue: true },
  { id: "cat-peach-long-tee", label: "Peach long-sleeve tee", file: "cat-peach-long-tee.jpg", sourceUrl: "https://m.media-amazon.com/images/I/5112Tr+d4fL._SL1024_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-men", catalogue: true },
  { id: "cat-red-heart-crop-top", label: "Red heart-print crop top", file: "cat-red-heart-crop-top.jpg", sourceUrl: "https://m.media-amazon.com/images/I/61QSRmzTFzL._SL1500_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-women", catalogue: true },
  { id: "cat-white-blue-embroidered-blouse", label: "White blouse with blue embroidery", file: "cat-white-blue-embroidered-blouse.jpg", sourceUrl: "https://m.media-amazon.com/images/I/61n643vkkpL._SL1500_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-women", catalogue: true },
  { id: "cat-white-floral-blouse", label: "White floral blouse", file: "cat-white-floral-blouse.jpg", sourceUrl: "https://m.media-amazon.com/images/I/61pE3CsRI7L._SL1024_.jpg", category: "tops", photoType: "flat-lay", preset: "standing-women", catalogue: true },
];

/** Everything the studio's sample picker can offer. */
export const ALL_SAMPLES: SampleGarment[] = [...SAMPLE_GARMENTS, ...CATALOGUE_SAMPLES];
