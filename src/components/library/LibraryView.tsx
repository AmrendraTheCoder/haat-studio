"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { HelpTip } from "@/components/shared/HelpTip";
import { secs } from "@/components/studio/Pipeline";
import { resultUrl } from "@/lib/client/check";
import { radioKeyDown, rovingTabIndex } from "@/lib/client/roving";
import { TEST_ENGINES } from "@/lib/engines";
import { useI18n } from "@/lib/i18n/client";
import type { Messages } from "@/lib/i18n/messages";
import { PRESETS } from "@/lib/presets";
import { CATEGORIES, QUALITY_STEPS, type ResultMeta } from "@/lib/tryon/types";
import { DEFAULT_LIBRARY_FILTER, LIBRARY_SORTS, filterLibrary, isFiltered, summariseQuality, type LibraryFilter, type LibrarySort, type LibrarySource } from "@/lib/ui/results";

type ViewMode = "grid" | "list";

/** The quality checks' verdict in a word, with its tone; null for photos saved before the checks. */
function checks(r: ResultMeta, L: Messages["library"]): { text: string; tone: string } | null {
  const q = summariseQuality(r.quality);
  if (!q) return null;
  if (q.overall === "fail") return { text: L.checksFail, tone: "!border-danger/30 !bg-danger-wash !text-danger" };
  if (q.overall === "warn") return { text: L.checksWarn(q.warns), tone: "!border-marigold/60 !bg-marigold-wash !text-ink" };
  return { text: L.checksOk, tone: "!border-good/30 !bg-good-wash !text-good" };
}

export function LibraryView({ results, featured }: { results: ResultMeta[]; featured: string[] }) {
  const { t, locale } = useI18n();
  const L = t.library;
  const [filter, setFilter] = useState<LibraryFilter>(DEFAULT_LIBRARY_FILTER);
  const { sort, category, model, source, featuredOnly } = filter;
  const set = <K extends keyof LibraryFilter>(k: K) => (v: LibraryFilter[K]) => setFilter((f) => ({ ...f, [k]: v }));
  const [setSort, setCategory, setModel, setSource] = [set("sort"), set("category"), set("model"), set("source")];
  const setFeaturedOnly = (fn: (v: boolean) => boolean) => setFilter((f) => ({ ...f, featuredOnly: fn(f.featuredOnly) }));
  const [view, setView] = useState<ViewMode>("grid");

  const shown = useMemo(() => filterLibrary(results, filter, featured), [results, filter, featured]);
  const filtered = isFiltered(filter);
  const clear = () => setFilter((f) => ({ ...DEFAULT_LIBRARY_FILTER, sort: f.sort }));

  const modelName = (r: ResultMeta) => {
    const p = PRESETS.find((x) => x.id === r.personId);
    return p ? (t.model.presets[p.id]?.label ?? p.label) : L.ownModel;
  };
  const when = (iso: string) => new Date(iso).toLocaleString(locale === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  return (
    <main className="app-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="h-page">{L.title}</h1>
            <HelpTip topic="library" />
          </div>
          <p className="mt-2 text-ink-2">{L.lead}</p>
        </div>
        <Link href="/studio" className="btn-primary">
          {t.review.create} <span aria-hidden>→</span>
        </Link>
      </div>

      <section aria-label={L.controls} className="card mt-6 flex flex-wrap items-end gap-x-4 gap-y-3 p-4">
        <Select label={L.sort} value={sort} onChange={(v) => setSort(v as LibrarySort)}>
          {(Object.keys(LIBRARY_SORTS) as LibrarySort[]).map((s) => (
            <option key={s} value={s}>
              {L.sorts[s]}
            </option>
          ))}
        </Select>
        <Select label={L.category} value={category} onChange={setCategory}>
          <option value="all">{L.all}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t.product.categories[c].title}
            </option>
          ))}
        </Select>
        <Select label={L.model} value={model} onChange={setModel}>
          <option value="all">{L.all}</option>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {t.model.presets[p.id]?.label ?? p.label}
            </option>
          ))}
          <option value="own">{L.ownModel}</option>
        </Select>
        <Select label={L.source} value={source} onChange={(v) => setSource(v as LibrarySource)}>
          <option value="all">{L.all}</option>
          <option value="tryon">{L.tryon}</option>
          <option value="test">{L.test}</option>
        </Select>
        <button type="button" aria-pressed={featuredOnly} onClick={() => setFeaturedOnly((v) => !v)} className="option inline-flex min-h-11 items-center !rounded-lg px-3.5 text-sm font-medium">
          ★ {L.featuredOnly}
        </button>
        <span className="self-center">
          <HelpTip topic="librarySort" />
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span id="lib-view" className="inline-flex items-center gap-2 text-xs font-medium text-ink-3">
            {L.view} <HelpTip topic="libraryView" />
          </span>
          <div role="radiogroup" aria-labelledby="lib-view" className="inline-flex rounded-lg border border-line bg-paper-2 p-0.5">
            {(["grid", "list"] as ViewMode[]).map((v, i) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                tabIndex={rovingTabIndex(view === v, i, true)}
                onKeyDown={radioKeyDown}
                onClick={() => setView(v)}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium ${view === v ? "bg-paper-glow text-ink shadow-[var(--shadow-card)]" : "text-ink-2 hover:text-ink"}`}
              >
                <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                  {v === "grid" ? <path d="M3 3h6v6H3V3Zm8 0h6v6h-6V3ZM3 11h6v6H3v-6Zm8 0h6v6h-6v-6Z" /> : <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />}
                </svg>
                {L[v]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <p className="text-ink-3" aria-live="polite">
          {L.count(shown.length, results.length)}
        </p>
        {filtered && (
          <button type="button" onClick={clear} className="inline-flex min-h-11 items-center font-medium text-accent-strong hover:underline">
            {L.clear}
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="mt-2 rounded-2xl border border-dashed border-line-strong/60 bg-paper-glow p-12 text-center text-sm text-ink-3">
          <p>{results.length === 0 ? L.emptyAll : L.empty}</p>
          {filtered && (
            <button type="button" onClick={clear} className="btn-ghost mt-4">
              {L.clear}
            </button>
          )}
        </div>
      ) : view === "grid" ? (
        <ul className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((r) => {
            const c = checks(r, L);
            return (
              <li key={r.key} className="card flex flex-col overflow-hidden">
                <Link href={`/studio?r=${r.key}`} className="group relative block aspect-[2/3] shrink-0 overflow-hidden bg-paper-2" aria-label={`${L.open}: ${modelName(r)}, ${when(r.createdAt)}`}>
                  <img src={resultUrl(r.key, "result.png")} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  <img src={resultUrl(r.key, "garment.jpg")} alt="" loading="lazy" className="absolute right-2 bottom-2 size-12 rounded-lg border border-line bg-paper-glow object-contain p-0.5 shadow-[var(--shadow-raised)]" />
                  {TEST_ENGINES.has(r.engine) && <span className="absolute inset-x-0 top-0 bg-marigold py-0.5 text-center text-2xs font-semibold text-ink uppercase">{t.recent.testEngine}</span>}
                  {featured.includes(r.key) && <span className="absolute top-2 left-2 rounded-md bg-accent-strong px-1.5 py-0.5 text-2xs font-semibold text-paper-glow">★ {L.featured}</span>}
                </Link>
                <div className="flex flex-1 flex-col gap-1.5 p-3">
                  <p className="text-sm font-semibold">{t.product.categories[r.settings.category].title}</p>
                  <p className="text-xs text-ink-3">
                    {modelName(r)} · {when(r.createdAt)}
                  </p>
                  <div>{c ? <span className={`chip !py-0.5 ${c.tone}`}>{c.text}</span> : <span className="text-2xs text-ink-3">{L.notChecked}</span>}</div>
                  <div className="mt-auto flex gap-2 pt-1">
                    <Link href={`/studio?r=${r.key}`} className="btn-ghost flex-1 !px-2 !text-xs">
                      {L.open}
                    </Link>
                    <Link href={`/studio/post?r=${r.key}`} className="btn-ghost flex-1 !px-2 !text-xs">
                      {L.makePost}
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="card mt-2 overflow-x-auto">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b border-line bg-paper-2 text-xs text-ink-3">
              <tr>
                {Object.values(L.cols).map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((r) => {
                const c = checks(r, L);
                return (
                  <tr key={r.key} className="hover:bg-paper-2/60">
                    <Cell>
                      <div className="flex items-center gap-2">
                        <img src={resultUrl(r.key, "result.png")} alt="" loading="lazy" className="h-14 w-10 rounded-md border border-line object-cover" />
                        <img src={resultUrl(r.key, "garment.jpg")} alt="" loading="lazy" className="size-10 rounded-md border border-line bg-paper-glow object-contain p-0.5" />
                      </div>
                    </Cell>
                    <Cell>
                      <p className="font-medium">{t.product.categories[r.settings.category].title}</p>
                      <p className="text-xs text-ink-3">{r.settings.photoType === "flat-lay" ? t.pipeline.flat : t.pipeline.worn}</p>
                    </Cell>
                    <Cell>
                      {modelName(r)}
                      {TEST_ENGINES.has(r.engine) && <span className="chip mt-1 !border-marigold/60 !bg-marigold-wash !py-0 !text-ink">{t.recent.testEngine}</span>}
                    </Cell>
                    <Cell>
                      <p>{t.model.qualities[r.settings.quality].title}</p>
                      <p className="font-mono text-xs text-ink-3 tabular-nums">
                        {QUALITY_STEPS[r.settings.quality]} · {t.modelX.seed} {r.settings.seed}
                      </p>
                    </Cell>
                    <Cell>{c ? <span className={`chip ${c.tone}`}>{c.text}</span> : <span className="text-xs text-ink-3">{L.notChecked}</span>}</Cell>
                    <Cell>
                      <span className="tabular-nums">{secs(r.totalMs)}</span>
                    </Cell>
                    <Cell>
                      <span className="whitespace-nowrap text-ink-2">{when(r.createdAt)}</span>
                    </Cell>
                    <Cell>
                      <div className="flex gap-1">
                        <Link href={`/studio?r=${r.key}`} className="inline-flex min-h-11 items-center rounded-lg px-2 font-semibold text-accent-strong hover:bg-accent-wash">
                          {L.open}
                        </Link>
                        <Link href={`/studio/post?r=${r.key}`} className="inline-flex min-h-11 items-center rounded-lg px-2 font-semibold whitespace-nowrap text-accent-strong hover:bg-accent-wash">
                          {L.makePost}
                        </Link>
                      </div>
                    </Cell>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Cell({ children }: { children: ReactNode }) {
  return <td className="px-4 py-2.5 align-middle">{children}</td>;
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-ink-3">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input !w-auto min-w-[9rem] !py-1.5">
        {children}
      </select>
    </label>
  );
}
