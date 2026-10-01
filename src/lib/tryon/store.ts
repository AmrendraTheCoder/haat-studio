import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { TEST_ENGINES } from "@/lib/engines";
import type { ResultMeta, TryOnSettings } from "./types";

export const RESULT_FILES = ["result.png", "garment.jpg", "person.jpg"] as const;
export type ResultFile = (typeof RESULT_FILES)[number];

export interface ResultStore {
  find(key: string): Promise<ResultMeta | null>;
  save(meta: ResultMeta, files: Record<ResultFile, Buffer>): Promise<void>;
  list(limit: number): Promise<ResultMeta[]>;
  read(key: string, file: ResultFile): Promise<Buffer | null>;
  /** Keys picked to show on the landing page, first = hero. Only keys whose result still exists. */
  featured(): Promise<string[]>;
  setFeatured(key: string, on: boolean): Promise<string[]>;
}

const nextFeatured = (current: string[], key: string, on: boolean) =>
  on ? [key, ...current.filter((k) => k !== key)] : current.filter((k) => k !== key);

const sha256 = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

/**
 * Same garment, same model photo, same settings → same image. The seed is in
 * the settings, so "another variation" is a new seed and therefore a new key;
 * everything else is served from disk instead of spending GPU quota twice.
 *
 * Keyed on the normalised bytes, not on file names: two uploads of the same
 * photo under different names are the same request.
 */
export function cacheKey(garment: Buffer, person: Buffer, settings: TryOnSettings): string {
  const { category, photoType, quality, seed } = settings;
  return sha256([sha256(garment), sha256(person), category, photoType, quality, seed].join("|")).slice(0, 32);
}

const KEY = /^[0-9a-f]{32}$/;

/** One directory per result under `root`. Writes land in a temp dir and are renamed into place. */
export function diskStore(root: string): ResultStore {
  const featuredFile = path.join(root, "featured.json");
  const dir = (key: string) => {
    // Keys arrive in URLs; anything that isn't a key never touches the filesystem.
    if (!KEY.test(key)) throw new Error(`invalid result key: ${key}`);
    return path.join(root, key);
  };

  async function readMeta(key: string): Promise<ResultMeta | null> {
    const file = path.join(dir(key), "meta.json");
    try {
      return JSON.parse(await readFile(file, "utf8")) as ResultMeta;
    } catch {
      return null;
    }
  }

  async function readFeatured(): Promise<string[]> {
    let keys: string[];
    try {
      keys = JSON.parse(await readFile(featuredFile, "utf8")) as string[];
    } catch {
      return [];
    }
    const present = await Promise.all(keys.filter((k) => KEY.test(k)).map(async (k) => ((await readMeta(k)) ? k : null)));
    return present.filter((k): k is string => k !== null);
  }

  return {
    find: readMeta,

    async save(meta, files) {
      const final = dir(meta.key);
      const tmp = path.join(root, `.tmp-${meta.key}-${process.pid}-${Date.now()}`);
      await mkdir(tmp, { recursive: true });
      await Promise.all(RESULT_FILES.map((name) => writeFile(path.join(tmp, name), files[name])));
      // meta.json last: its presence is what marks a result complete.
      await writeFile(path.join(tmp, "meta.json"), JSON.stringify(meta, null, 2));
      await rm(final, { recursive: true, force: true });
      await rename(tmp, final);
    },

    async list(limit) {
      let names: string[];
      try {
        names = await readdir(root);
      } catch {
        return [];
      }
      const metas = await Promise.all(names.filter((n) => KEY.test(n)).map(readMeta));
      return metas
        .filter((m): m is ResultMeta => m !== null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },

    async read(key, file) {
      if (!RESULT_FILES.includes(file)) return null;
      const target = path.join(dir(key), file);
      try {
        return await readFile(target);
      } catch {
        return null;
      }
    },

    featured: readFeatured,

    async setFeatured(key, on) {
      const meta = await readMeta(key);
      if (on && !meta) throw new Error(`no result ${key}`);
      if (on && TEST_ENGINES.has(meta!.engine)) throw new Error("test-engine results can't be featured");
      const keys = nextFeatured(await readFeatured(), key, on);
      await mkdir(root, { recursive: true });
      const tmp = `${featuredFile}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(keys, null, 2));
      await rename(tmp, featuredFile);
      return keys;
    },
  };
}

export function memoryStore(): ResultStore {
  const rows = new Map<string, { meta: ResultMeta; files: Record<ResultFile, Buffer> }>();
  let featured: string[] = [];
  return {
    async find(key) {
      return rows.get(key)?.meta ?? null;
    },
    async save(meta, files) {
      rows.set(meta.key, { meta, files });
    },
    async list(limit) {
      return [...rows.values()].map((r) => r.meta).reverse().slice(0, limit);
    },
    async read(key, file) {
      return rows.get(key)?.files[file] ?? null;
    },
    async featured() {
      return featured.filter((k) => rows.has(k));
    },
    async setFeatured(key, on) {
      if (on && !rows.has(key)) throw new Error(`no result ${key}`);
      if (on && TEST_ENGINES.has(rows.get(key)!.meta.engine)) throw new Error("test-engine results can't be featured");
      featured = nextFeatured(featured, key, on);
      return featured;
    },
  };
}
