import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { radioKeyDown, rovingTabIndex } from "@/lib/client/roving";
import { messages } from "@/lib/i18n/messages";
import { ALL_SAMPLES, CATALOGUE_SAMPLES, PRESETS, SAMPLE_GARMENTS, type SampleGarment } from "@/lib/presets";
import { CATEGORIES, PHOTO_TYPES, type OutputQuality, type QualityCheck, type ResultMeta } from "@/lib/tryon/types";
import {
  MAX_SEED,
  STANDARD_SEED,
  bestPresetFor,
  categoryCounts,
  costKind,
  createBlock,
  filterPresets,
  filterSamples,
  fitFor,
  normalise,
  parseSeed,
} from "@/lib/ui/catalogue";
import { HELP_SECTIONS, HELP_TOPICS } from "@/lib/ui/help";
import { DEFAULT_LIBRARY_FILTER, checkState, filterLibrary, formatMeasure, isFiltered, summariseQuality, type LibraryFilter } from "@/lib/ui/results";

const DEVANAGARI = /[ऀ-ॿ]/;
const preset = (id: string) => PRESETS.find((p) => p.id === id)!;
const bothNames = (s: SampleGarment) => [s.label, messages.en.product.samples[s.id] ?? "", messages.hi.product.samples[s.id] ?? ""];
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

/* ── Sample catalogue ─────────────────────────────────────────────────── */

describe("sample search and tabs", () => {
  it("normalises case, spacing and accents", () => {
    expect(normalise("  Black   TEE ")).toBe("black tee");
    expect(normalise("Café")).toBe("cafe");
  });

  it("shows every sample for the All tab with an empty query", () => {
    expect(filterSamples(ALL_SAMPLES, { category: "all", query: "", names: bothNames })).toHaveLength(ALL_SAMPLES.length);
  });

  it("treats a whitespace-only query as empty", () => {
    expect(filterSamples(ALL_SAMPLES, { category: "all", query: "   ", names: bothNames })).toHaveLength(ALL_SAMPLES.length);
  });

  it("limits a tab to its garment type", () => {
    const tops = filterSamples(ALL_SAMPLES, { category: "tops", query: "", names: bothNames });
    expect(tops.length).toBeGreaterThan(0);
    expect(tops.every((s) => s.category === "tops")).toBe(true);
  });

  it("finds the skirt under bottoms", () => {
    expect(ids(filterSamples(ALL_SAMPLES, { category: "bottoms", query: "", names: bothNames }))).toContain("tiered-skirt");
  });

  it("searches English names, ignoring case", () => {
    const hits = filterSamples(ALL_SAMPLES, { category: "all", query: "NAVY", names: bothNames });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((s) => /navy/i.test(bothNames(s).join(" ")))).toBe(true);
  });

  it("searches Hindi names too", () => {
    const hits = filterSamples(ALL_SAMPLES, { category: "all", query: "स्कर्ट", names: bothNames });
    expect(ids(hits)).toEqual(["tiered-skirt"]);
  });

  it("needs every word of a multi-word query", () => {
    const hits = filterSamples(ALL_SAMPLES, { category: "all", query: "black tee", names: bothNames });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((s) => /black/i.test(s.label) && /tee/i.test(s.label))).toBe(true);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterSamples(ALL_SAMPLES, { category: "all", query: "zzz-no-such-garment", names: bothNames })).toEqual([]);
  });

  it("combines the tab and the search", () => {
    expect(filterSamples(ALL_SAMPLES, { category: "bottoms", query: "tee", names: bothNames })).toEqual([]);
  });

  it("counts each tab, and the counts add up to All", () => {
    const c = categoryCounts(ALL_SAMPLES);
    expect(c.all).toBe(ALL_SAMPLES.length);
    expect(c.tops + c.bottoms + c["one-pieces"]).toBe(c.all);
    expect(c.bottoms).toBeGreaterThanOrEqual(1);
  });

  it("counts an empty list as zero everywhere", () => {
    expect(categoryCounts([])).toEqual({ all: 0, tops: 0, bottoms: 0, "one-pieces": 0 });
  });
});

/* ── Models ───────────────────────────────────────────────────────────── */

describe("model filters and fit", () => {
  const all = { gender: "all", wearing: "any", suits: null } as const;

  it("shows every model with no filter", () => {
    expect(filterPresets(PRESETS, all)).toHaveLength(PRESETS.length);
  });

  it("filters by gender", () => {
    expect(ids(filterPresets(PRESETS, { ...all, gender: "men" }))).toEqual(["standing-men"]);
    expect(filterPresets(PRESETS, { ...all, gender: "women" }).every((p) => p.gender === "women")).toBe(true);
  });

  it("filters by what the model wears", () => {
    expect(ids(filterPresets(PRESETS, { ...all, wearing: "one-piece" }))).toEqual(["standing-women"]);
    expect(filterPresets(PRESETS, { ...all, wearing: "separates" }).every((p) => p.wearing === "separates")).toBe(true);
  });

  it("hides models in a dress when the garment is a bottom", () => {
    expect(ids(filterPresets(PRESETS, { ...all, suits: "bottoms" }))).not.toContain("standing-women");
  });

  it("combines filters", () => {
    expect(ids(filterPresets(PRESETS, { gender: "women", wearing: "separates", suits: "bottoms" }))).toEqual(["casual-women"]);
    expect(filterPresets(PRESETS, { gender: "men", wearing: "one-piece", suits: null })).toEqual([]);
  });

  it("never rates an own photo or an unknown garment type", () => {
    expect(fitFor(undefined, "tops")).toBe("unrated");
    expect(fitFor(preset("standing-men"), null)).toBe("unrated");
  });

  it("marks fit from the preset's own suitability list", () => {
    expect(fitFor(preset("standing-women"), "one-pieces")).toBe("suits");
    expect(fitFor(preset("standing-women"), "bottoms")).toBe("not-suited");
  });

  it("suggests the model that lists a garment type first", () => {
    expect(bestPresetFor(PRESETS, "bottoms")?.id).toBe("casual-women");
    expect(bestPresetFor(PRESETS, "one-pieces")?.id).toBe("standing-women");
    expect(bestPresetFor([], "tops")).toBeUndefined();
  });
});

/* ── Review step ──────────────────────────────────────────────────────── */

describe("review step values", () => {
  it("accepts whole-number seeds in the API's range", () => {
    expect(parseSeed("42")).toBe(42);
    expect(parseSeed(" 7 ")).toBe(7);
    expect(parseSeed("0")).toBe(0);
    expect(parseSeed(String(MAX_SEED))).toBe(MAX_SEED);
  });

  it("rejects anything else as a seed", () => {
    for (const bad of ["", "abc", "-1", "1.5", "1e3", String(MAX_SEED + 1), "12345678901"]) expect(parseSeed(bad)).toBeNull();
  });

  it("keeps the standard seed the studio has always used", () => {
    expect(STANDARD_SEED).toBe(42);
  });

  it("says a test engine costs nothing", () => {
    expect(costKind({ test: true, photosLeft: 0 })).toBe("test");
  });

  it("says the cost is unknown without a quota reading", () => {
    expect(costKind({ test: false, photosLeft: null })).toBe("unknown");
  });

  it("says one of the photos left, or none left", () => {
    expect(costKind({ test: false, photosLeft: 3 })).toBe("left");
    expect(costKind({ test: false, photosLeft: 0 })).toBe("none-left");
  });

  it("blocks Create until every input is chosen", () => {
    expect(createBlock({ garment: false, category: true, person: true, configured: true })).toBe("incomplete");
    expect(createBlock({ garment: true, category: false, person: true, configured: true })).toBe("incomplete");
    expect(createBlock({ garment: true, category: true, person: false, configured: true })).toBe("incomplete");
  });

  it("blocks Create when generation is switched off", () => {
    expect(createBlock({ garment: true, category: true, person: true, configured: false })).toBe("off");
  });

  it("allows Create when everything is ready", () => {
    expect(createBlock({ garment: true, category: true, person: true, configured: true })).toBeNull();
  });

  it("words the cost differently for none left and some left, in both languages", () => {
    for (const lang of ["en", "hi"] as const) {
      expect(messages[lang].review.cost(0)).not.toBe(messages[lang].review.cost(3));
      expect(messages[lang].review.cost(3)).toContain("3");
    }
  });
});

/* ── Presets and samples data ─────────────────────────────────────────── */

describe("presets and samples data", () => {
  it("gives every sample a unique id and file", () => {
    expect(new Set(ids(ALL_SAMPLES)).size).toBe(ALL_SAMPLES.length);
    expect(new Set(ALL_SAMPLES.map((s) => s.file)).size).toBe(ALL_SAMPLES.length);
  });

  it("gives every sample a name, a JPEG file, a category and a photo type", () => {
    for (const s of ALL_SAMPLES) {
      expect(s.label.trim().length, s.id).toBeGreaterThan(2);
      expect(s.file, s.id).toMatch(/\.jpe?g$/);
      expect(CATEGORIES, s.id).toContain(s.category);
      expect(PHOTO_TYPES, s.id).toContain(s.photoType);
    }
  });

  it("points every sample at a model that exists", () => {
    for (const s of ALL_SAMPLES) expect(ids(PRESETS), s.id).toContain(s.preset);
  });

  it("suggests a model that suits each sample's garment type", () => {
    for (const s of ALL_SAMPLES) expect(preset(s.preset).suits, s.id).toContain(s.category);
  });

  it("keeps catalogue samples apart from the eval set", () => {
    expect(CATALOGUE_SAMPLES.length).toBeGreaterThanOrEqual(30);
    expect(CATALOGUE_SAMPLES.every((s) => s.catalogue === true)).toBe(true);
    expect(SAMPLE_GARMENTS.some((s) => s.catalogue)).toBe(false);
    expect(ALL_SAMPLES).toHaveLength(SAMPLE_GARMENTS.length + CATALOGUE_SAMPLES.length);
  });

  it("lists catalogue samples as flat-lay tops, as the source listings were", () => {
    expect(CATALOGUE_SAMPLES.every((s) => s.category === "tops" && s.photoType === "flat-lay")).toBe(true);
  });

  it("names every sample in English and Hindi", () => {
    for (const s of ALL_SAMPLES) {
      expect(messages.en.product.samples[s.id], s.id).toBeTruthy();
      expect(messages.hi.product.samples[s.id], s.id).toMatch(DEVANAGARI);
    }
  });

  it("gives every model a gender, what it wears, and at least one garment type", () => {
    for (const p of PRESETS) {
      expect(["men", "women"]).toContain(p.gender);
      expect(["separates", "one-piece"]).toContain(p.wearing);
      expect(p.suits.length).toBeGreaterThan(0);
    }
  });

  it("never says a model in a dress suits bottoms", () => {
    for (const p of PRESETS) if (p.wearing === "one-piece") expect(p.suits).not.toContain("bottoms");
  });

  it("names every model in both languages", () => {
    for (const p of PRESETS) {
      expect(messages.en.model.presets[p.id]?.label, p.id).toBeTruthy();
      expect(messages.hi.model.presets[p.id]?.label, p.id).toBeTruthy();
    }
  });
});

/* ── Quality checks display ───────────────────────────────────────────── */

const check = (id: QualityCheck["id"], ok: boolean, severity: QualityCheck["severity"]): QualityCheck => ({ id, ok, severity, value: 1, limit: 2 });

describe("quality check display", () => {
  it("shows a passed check as pass, whatever its severity", () => {
    expect(checkState({ ok: true, severity: "fail" })).toBe("pass");
    expect(checkState({ ok: true, severity: "warn" })).toBe("pass");
  });

  it("shows a failed check with its severity", () => {
    expect(checkState({ ok: false, severity: "warn" })).toBe("warn");
    expect(checkState({ ok: false, severity: "fail" })).toBe("fail");
  });

  it("shows nothing for results saved before the checks", () => {
    expect(summariseQuality(undefined)).toBeNull();
  });

  it("summarises all-passed checks", () => {
    const q: OutputQuality = { passed: true, checks: [check("blank", true, "fail"), check("colour", true, "warn")] };
    expect(summariseQuality(q)).toEqual({ overall: "pass", fails: 0, warns: 0, total: 2 });
  });

  it("counts warnings", () => {
    const q: OutputQuality = { passed: true, checks: [check("colour", false, "warn"), check("person", false, "warn"), check("size", true, "warn")] };
    expect(summariseQuality(q)).toMatchObject({ overall: "warn", warns: 2 });
  });

  it("lets a failure outrank warnings", () => {
    const q: OutputQuality = { passed: false, checks: [check("changed", false, "fail"), check("colour", false, "warn")] };
    expect(summariseQuality(q)?.overall).toBe("fail");
  });

  it("ignores checks the page has no words for", () => {
    const q = { passed: true, checks: [{ ...check("blank", true, "fail"), id: "future" as QualityCheck["id"] }] };
    expect(summariseQuality(q, (id) => id in messages.en.result.quality.checks)).toBeNull();
  });

  it("formats measured values for the tooltip", () => {
    expect(formatMeasure(45)).toBe("45");
    expect(formatMeasure(0.0812)).toBe("0.081");
    expect(formatMeasure(-33.18)).toBe("-33.2");
  });

  it("has words for every check id, in both languages", () => {
    for (const id of ["blank", "size", "changed", "colour", "person"] as const) {
      for (const lang of ["en", "hi"] as const) {
        const c = messages[lang].result.quality.checks[id];
        expect(c.title && c.ok && c.bad, `${lang}.${id}`).toBeTruthy();
      }
    }
  });

  it("has a word for each state, in both languages", () => {
    for (const lang of ["en", "hi"] as const) expect(Object.keys(messages[lang].result.quality.states).sort()).toEqual(["fail", "pass", "warn"]);
  });
});

/* ── Library ──────────────────────────────────────────────────────────── */

const meta = (key: string, o: Partial<ResultMeta> & { category?: ResultMeta["settings"]["category"] } = {}): ResultMeta => ({
  key,
  engine: o.engine ?? "fashn-space",
  settings: { category: o.category ?? "tops", photoType: "flat-lay", quality: "balanced", seed: 42 },
  personId: o.personId ?? "standing-men",
  createdAt: o.createdAt ?? "2026-10-26T07:00:00Z",
  totalMs: o.totalMs ?? 30_000,
  queueMs: 0,
});
const LIB = [
  meta("a", { createdAt: "2026-10-26T07:00:00Z", totalMs: 33_000 }),
  meta("b", { createdAt: "2026-10-27T07:00:00Z", totalMs: 21_000, category: "bottoms", personId: "casual-women" }),
  meta("c", { createdAt: "2026-10-25T07:00:00Z", totalMs: 40_000, engine: "echo", personId: "upload" }),
];
const lib = (f: Partial<LibraryFilter>, featured: string[] = []) => filterLibrary(LIB, { ...DEFAULT_LIBRARY_FILTER, ...f }, featured).map((r) => r.key);

describe("library sorting and filtering", () => {
  it("sorts newest first by default", () => {
    expect(lib({})).toEqual(["b", "a", "c"]);
  });

  it("sorts oldest first", () => {
    expect(lib({ sort: "oldest" })).toEqual(["c", "a", "b"]);
  });

  it("sorts by time taken", () => {
    expect(lib({ sort: "fastest" })).toEqual(["b", "a", "c"]);
    expect(lib({ sort: "slowest" })).toEqual(["c", "a", "b"]);
  });

  it("filters by garment type", () => {
    expect(lib({ category: "bottoms" })).toEqual(["b"]);
  });

  it("filters by model, with own photos grouped", () => {
    expect(lib({ model: "casual-women" })).toEqual(["b"]);
    expect(lib({ model: "own" })).toEqual(["c"]);
  });

  it("separates real try-ons from test-engine output", () => {
    expect(lib({ source: "test" })).toEqual(["c"]);
    expect(lib({ source: "tryon" })).toEqual(["b", "a"]);
  });

  it("shows only featured photos when asked", () => {
    expect(lib({ featuredOnly: true }, ["a"])).toEqual(["a"]);
    expect(lib({ featuredOnly: true }, [])).toEqual([]);
  });

  it("knows when the list is filtered, ignoring the sort", () => {
    expect(isFiltered(DEFAULT_LIBRARY_FILTER)).toBe(false);
    expect(isFiltered({ ...DEFAULT_LIBRARY_FILTER, sort: "oldest" })).toBe(false);
    expect(isFiltered({ ...DEFAULT_LIBRARY_FILTER, source: "test" })).toBe(true);
  });

  it("never reorders the list it was given", () => {
    const before = LIB.map((r) => r.key);
    lib({ sort: "oldest" });
    expect(LIB.map((r) => r.key)).toEqual(before);
  });
});

/* ── Help ─────────────────────────────────────────────────────────────── */

describe("help text", () => {
  it("lists every help topic exactly once", () => {
    expect(new Set(HELP_TOPICS).size).toBe(HELP_TOPICS.length);
    expect([...HELP_TOPICS].sort()).toEqual(Object.keys(messages.en.help.topics).sort());
  });

  it("has a title and an explanation for every topic, in English and Hindi", () => {
    for (const id of HELP_TOPICS) {
      for (const lang of ["en", "hi"] as const) {
        const t = messages[lang].help.topics[id];
        expect(t.title.trim(), `${lang}.${id}`).not.toBe("");
        expect(t.body.length, `${lang}.${id}`).toBeGreaterThan(40);
      }
    }
  });

  it("writes the Hindi help in Devanagari", () => {
    for (const id of HELP_TOPICS) expect(messages.hi.help.topics[id].body, id).toMatch(DEVANAGARI);
  });

  it("names every help section in both languages", () => {
    for (const s of HELP_SECTIONS) {
      expect(messages.en.help.sections[s.id]).toBeTruthy();
      expect(messages.hi.help.sections[s.id]).toMatch(DEVANAGARI);
    }
  });

  it("puts every studio control's help in the studio section", () => {
    const studio = HELP_SECTIONS.find((s) => s.id === "studio")!.topics;
    for (const id of ["productPhoto", "samples", "category", "photoType", "model", "quality", "seed", "review"] as const) expect(studio).toContain(id);
  });
});

/* ── i18n for the new screens ─────────────────────────────────────────── */

const keysDeep = (o: unknown, prefix = ""): string[] =>
  o && typeof o === "object" && !Array.isArray(o)
    ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keysDeep(v, prefix ? `${prefix}.${k}` : k))
    : [prefix];

describe("new screens in both languages", () => {
  for (const block of ["shell", "review", "modelX", "sampleX", "postX", "researchX", "library"] as const) {
    it(`has the same ${block} keys in English and Hindi`, () => {
      expect(keysDeep(messages.hi[block]).sort()).toEqual(keysDeep(messages.en[block]).sort());
    });
  }

  it("has a review label for the new step in both languages", () => {
    expect(messages.en.studio.steps.review).toBeTruthy();
    expect(messages.hi.studio.steps.review).toMatch(DEVANAGARI);
  });

  it("counts samples and photos in words", () => {
    expect(messages.en.sampleX.count(1)).toBe("1 sample");
    expect(messages.en.sampleX.count(5)).toBe("5 samples");
    expect(messages.en.library.count(3, 3)).toBe("3 photos");
    expect(messages.en.library.count(1, 3)).toBe("1 of 3 photos");
    expect(messages.hi.library.count(1, 3)).toContain("3");
  });

  it("labels the seed as standard or custom", () => {
    expect(messages.en.review.seedDefault(42)).toContain("standard");
    expect(messages.en.review.seedCustom(7)).toContain("custom");
  });
});

/* ── Accessibility helpers ────────────────────────────────────────────── */

describe("radio-group keyboard helpers", () => {
  it("puts only the selected option in the Tab order", () => {
    expect(rovingTabIndex(true, 2, true)).toBe(0);
    expect(rovingTabIndex(false, 0, true)).toBe(-1);
  });

  it("puts the first option in the Tab order when nothing is selected", () => {
    expect(rovingTabIndex(false, 0, false)).toBe(0);
    expect(rovingTabIndex(false, 1, false)).toBe(-1);
  });

  // A minimal stand-in for three radio buttons in one group — no browser needed.
  const group = () => {
    const log: string[] = [];
    const container = { querySelectorAll: () => radios };
    const radios = ["a", "b", "c"].map((name) => ({
      name,
      focus: () => log.push(`focus ${name}`),
      click: () => log.push(`click ${name}`),
      closest: () => container,
    }));
    const press = (from: number, key: string) => {
      let prevented = false;
      radioKeyDown({ key, currentTarget: radios[from], preventDefault: () => (prevented = true) } as never);
      return { log, prevented };
    };
    return { press };
  };

  it("moves to and selects the next option with the arrow keys, wrapping round", () => {
    const g = group();
    expect(g.press(0, "ArrowRight").log).toEqual(["focus b", "click b"]);
    expect(g.press(0, "ArrowLeft").log.slice(-2)).toEqual(["focus c", "click c"]);
  });

  it("jumps to the ends with Home and End", () => {
    const g = group();
    expect(g.press(1, "End").log).toEqual(["focus c", "click c"]);
    expect(g.press(1, "Home").log.slice(-2)).toEqual(["focus a", "click a"]);
  });

  it("leaves other keys alone", () => {
    const g = group();
    const r = g.press(0, "Enter");
    expect(r.log).toEqual([]);
    expect(r.prevented).toBe(false);
  });
});

/* ── Shell, titles and icons ──────────────────────────────────────────── */

describe("app shell and site chrome", () => {
  const src = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");
  /** The JSX between an element's opening tag (found by a marker inside it) and its closing tag. */
  const element = (file: string, marker: string, tag: string) => {
    const s = src(file);
    const at = s.indexOf(marker);
    expect(at).toBeGreaterThan(-1);
    const start = s.lastIndexOf(`<${tag}`, at);
    return s.slice(start, s.indexOf(`</${tag}>`, at));
  };

  it("keeps the language switch out of the app's top bar", () => {
    expect(element("src/components/site/AppShell.tsx", 'data-testid="topbar"', "header")).not.toContain("LanguageToggle");
  });

  it("puts the language switch in the sidebar (which is also the phone menu)", () => {
    const side = src("src/components/site/AppShell.tsx");
    const nav = side.slice(side.indexOf("function SideNav"), side.indexOf("export function StatusChip"));
    expect(nav).toContain("<LanguageToggle");
  });

  it("keeps the language switch out of the public header bar, but in its menu and footer", () => {
    const site = src("src/components/site/site.tsx");
    const nav = site.slice(site.indexOf("export function SiteNav"), site.indexOf("function SiteMenu"));
    expect(nav).not.toContain("<LanguageToggle");
    expect(site.slice(site.indexOf("function SiteMenu"), site.indexOf("export function SiteFooter"))).toContain("<LanguageToggle");
    expect(site.slice(site.indexOf("export function SiteFooter"))).toContain("<LanguageToggle");
  });

  it("names both languages in themselves on the switch", () => {
    const c = src("src/lib/i18n/client.tsx");
    expect(c).toContain('role="radiogroup"');
    expect(c).toContain("radioKeyDown");
    expect(c).toContain("हिन्दी");
    expect(messages.hi.common.language).toMatch(DEVANAGARI);
  });

  it("has a page title for every route, in both languages", () => {
    for (const k of ["home", "studio", "post", "research", "library", "help", "design"] as const) {
      expect(messages.en.meta[k]).toBeTruthy();
      expect(messages.hi.meta[k]).toMatch(DEVANAGARI);
    }
    expect(messages.en.meta.report("Shop")).toContain("Shop");
  });

  it("ships brand icons through Next's file conventions", () => {
    for (const f of ["src/app/icon.svg", "src/app/apple-icon.png", "src/app/favicon.ico"]) expect(existsSync(f)).toBe(true);
    expect(src("src/app/icon.svg")).toContain("#C8105A");
  });

  it("never calls the app a demo in the shell's status", () => {
    const words = [messages.en.nav.engine, messages.hi.nav.engine].flatMap((e) => [e.setup, e.setupHint("HF_TOKEN is not set")]);
    for (const w of words) expect(w).not.toMatch(/demo|डेमो/i);
    expect(src("src/components/site/AppShell.tsx")).not.toMatch(/engine\.demo/);
  });
});
