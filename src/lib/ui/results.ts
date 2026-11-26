/**
 * Pure helpers for showing saved results: the quality-check verdict and the
 * library's sorting and filtering. Shared by the result screen and the library.
 */
import { TEST_ENGINES } from "@/lib/engines";
import { PRESETS } from "@/lib/presets";
import type { OutputQuality, QualityCheck, ResultMeta } from "@/lib/tryon/types";

export type CheckState = "pass" | "warn" | "fail";

/** A passed check is "pass" whatever its severity; a failed one takes its severity. */
export const checkState = (c: Pick<QualityCheck, "ok" | "severity">): CheckState => (c.ok ? "pass" : c.severity === "fail" ? "fail" : "warn");

export interface QualitySummary {
  /** The worst state among the checks. */
  overall: CheckState;
  fails: number;
  warns: number;
  total: number;
}

/** The verdict for a result; null when it was saved before the checks existed. */
export function summariseQuality(q: OutputQuality | undefined, known?: (id: string) => boolean): QualitySummary | null {
  if (!q) return null;
  const checks = known ? q.checks.filter((c) => known(c.id)) : q.checks;
  if (checks.length === 0) return null;
  const fails = checks.filter((c) => checkState(c) === "fail").length;
  const warns = checks.filter((c) => checkState(c) === "warn").length;
  return { overall: fails ? "fail" : warns ? "warn" : "pass", fails, warns, total: checks.length };
}

/** A measured value for the help tooltip: whole numbers as they are, small ones to 3 places, others to 1. */
export const formatMeasure = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(Math.abs(n) < 1 ? 3 : 1));

export type LibrarySort = "newest" | "oldest" | "fastest" | "slowest";
export type LibrarySource = "all" | "tryon" | "test";

export const LIBRARY_SORTS: Record<LibrarySort, (a: ResultMeta, b: ResultMeta) => number> = {
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
  fastest: (a, b) => a.totalMs - b.totalMs,
  slowest: (a, b) => b.totalMs - a.totalMs,
};

export interface LibraryFilter {
  sort: LibrarySort;
  category: string; // "all" or a category
  model: string; // "all", "own", or a preset id
  source: LibrarySource;
  featuredOnly: boolean;
}

export const DEFAULT_LIBRARY_FILTER: LibraryFilter = { sort: "newest", category: "all", model: "all", source: "all", featuredOnly: false };

/** True when any filter (not the sort) narrows the list. */
export const isFiltered = (f: LibraryFilter) => f.category !== "all" || f.model !== "all" || f.source !== "all" || f.featuredOnly;

/** Saved results matching the filter, in the chosen order. Never mutates the input. */
export function filterLibrary(results: ResultMeta[], f: LibraryFilter, featured: string[]): ResultMeta[] {
  const isPreset = (id: string) => PRESETS.some((p) => p.id === id);
  return results
    .filter((r) => f.category === "all" || r.settings.category === f.category)
    .filter((r) => f.model === "all" || (f.model === "own" ? !isPreset(r.personId) : r.personId === f.model))
    .filter((r) => f.source === "all" || (f.source === "test") === TEST_ENGINES.has(r.engine))
    .filter((r) => !f.featuredOnly || featured.includes(r.key))
    .sort(LIBRARY_SORTS[f.sort]);
}
