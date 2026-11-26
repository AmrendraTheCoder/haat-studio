/**
 * Pure helpers behind the studio's pickers and review step. No React, no
 * browser: the pages call them and the tests check them directly.
 */
import type { Preset, SampleGarment } from "@/lib/presets";
import type { TryOnSettings } from "@/lib/tryon/types";

type Category = TryOnSettings["category"];

export type CategoryFilter = Category | "all";

/** Lower-case, accents stripped, spaces collapsed — so "  T-Shirt " finds "black tee-shirt". */
export const normalise = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Samples in a category whose name matches every word of the query, in either
 * language (`names` returns the names to search, e.g. English and Hindi).
 */
export function filterSamples(samples: SampleGarment[], opts: { category: CategoryFilter; query: string; names: (s: SampleGarment) => string[] }): SampleGarment[] {
  const words = normalise(opts.query).split(" ").filter(Boolean);
  return samples.filter((s) => {
    if (opts.category !== "all" && s.category !== opts.category) return false;
    if (words.length === 0) return true;
    const hay = normalise(opts.names(s).join(" "));
    return words.every((w) => hay.includes(w));
  });
}

/** How many samples each category tab would show, plus "all". */
export function categoryCounts(samples: SampleGarment[]): Record<CategoryFilter, number> {
  const counts: Record<CategoryFilter, number> = { all: samples.length, tops: 0, bottoms: 0, "one-pieces": 0 };
  for (const s of samples) counts[s.category]++;
  return counts;
}

export type GenderFilter = "all" | Preset["gender"];
export type WearingFilter = "any" | Preset["wearing"];

/** Models matching the filters. `suits` null = don't filter by garment type. */
export function filterPresets(presets: Preset[], opts: { gender: GenderFilter; wearing: WearingFilter; suits: Category | null }): Preset[] {
  return presets.filter(
    (p) => (opts.gender === "all" || p.gender === opts.gender) && (opts.wearing === "any" || p.wearing === opts.wearing) && (!opts.suits || p.suits.includes(opts.suits)),
  );
}

export type Fit = "suits" | "not-suited" | "unrated";

/** Whether a model suits a garment type. Own photos and unknown types are unrated, never guessed. */
export function fitFor(preset: Preset | undefined, category: Category | null): Fit {
  if (!preset || !category) return "unrated";
  return preset.suits.includes(category) ? "suits" : "not-suited";
}

/** The best installed model for a garment type: `suits` is ordered best-first. */
export function bestPresetFor(presets: Preset[], category: Category): Preset | undefined {
  return presets.filter((p) => p.suits.includes(category)).sort((a, b) => a.suits.indexOf(category) - b.suits.indexOf(category))[0];
}

export const MAX_SEED = 2 ** 31 - 1;
export const STANDARD_SEED = 42;

/** A typed seed, or null when it isn't a whole number in the range the API accepts. */
export function parseSeed(text: string): number | null {
  if (!/^\d{1,10}$/.test(text.trim())) return null;
  const n = Number(text.trim());
  return n <= MAX_SEED ? n : null;
}

export type CostKind = "test" | "unknown" | "left" | "none-left";

/** What pressing Create will use, as a kind the page turns into words. */
export function costKind(opts: { test: boolean; photosLeft: number | null }): CostKind {
  if (opts.test) return "test";
  if (opts.photosLeft === null) return "unknown";
  return opts.photosLeft > 0 ? "left" : "none-left";
}

/** Why Create can't be pressed yet, as a code; null when it can. */
export function createBlock(opts: { garment: boolean; category: boolean; person: boolean; configured: boolean }): "incomplete" | "off" | null {
  if (!opts.garment || !opts.category || !opts.person) return "incomplete";
  if (!opts.configured) return "off";
  return null;
}
