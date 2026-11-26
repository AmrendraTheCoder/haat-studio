import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { MARKET_ATTRS, MARKET_TYPES, type Catalogue, type MarketAttr, type MarketType } from "./engines";

/**
 * The compact listings catalogue written by analysis/market.py --app-out. Read once and kept in
 * memory (it is about 1 MB); re-read when the file changes. Null when there is none: everything
 * that uses it must work without it.
 */
let cached: { file: string; mtime: number; data: Catalogue } | null = null;

export async function loadCatalogue(file = path.resolve(/*turbopackIgnore: true*/ process.cwd(), env().MARKET_FILE)): Promise<Catalogue | null> {
  try {
    const { mtimeMs } = await stat(file);
    if (cached && cached.file === file && cached.mtime === mtimeMs) return cached.data;
    const data = JSON.parse(await readFile(file, "utf8")) as Catalogue;
    if (data.version !== 1 || !data.categories) return null;
    cached = { file, mtime: mtimeMs, data };
    return data;
  } catch {
    return null;
  }
}

/** What the research form offers: the product types the catalogue has, and each one's attribute values. */
export type MarketOptions = { type: MarketType; label: string; listings: number; values: Partial<Record<MarketAttr, string[]>> }[];

export function marketOptions(cat: Catalogue | null): MarketOptions {
  if (!cat) return [];
  return MARKET_TYPES.flatMap((type) => {
    const c = cat.categories[type];
    if (!c) return [];
    const values = Object.fromEntries(MARKET_ATTRS.filter((k) => c.values[k]?.length).map((k) => [k, c.values[k].filter((v) => v !== "Other")]));
    return [{ type, label: c.label, listings: c.after_cleaning, values }];
  });
}
