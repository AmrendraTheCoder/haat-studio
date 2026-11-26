"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { useId, useState } from "react";
import { HelpTip } from "@/components/shared/HelpTip";
import { radioKeyDown, rovingTabIndex } from "@/lib/client/roving";
import { useI18n } from "@/lib/i18n/client";
import { messages } from "@/lib/i18n/messages";
import { ALL_SAMPLES, PRESETS, type SampleGarment } from "@/lib/presets";
import { STANDARD_SEED, bestPresetFor, categoryCounts, filterPresets, filterSamples, fitFor, parseSeed, type CategoryFilter, type GenderFilter, type WearingFilter } from "@/lib/ui/catalogue";
import type { Setup } from "@/lib/site";
import { ActionBar, Choices, Dropzone, ICONS, Notice, QuotaMeter } from "./parts";
import { QUALITY_STEPS, type ModelChoice } from "@/lib/tryon/types";
import type { Category, Inputs, PersonChoice, PhotoType, Quality } from "./types";

const CATEGORIES: Category[] = ["tops", "bottoms", "one-pieces"];

/* ── Step 1: the product ─────────────────────────────────────────────── */

export function ProductStep({
  inputs,
  setup,
  error,
  note,
  busyLoading,
  onFile,
  onClear,
  onSample,
  onCategory,
  onPhotoType,
  onContinue,
}: {
  inputs: Inputs;
  setup: Setup;
  error: string | null;
  note: string | null;
  busyLoading: boolean;
  onFile: (file: File, note?: string) => void;
  onClear: () => void;
  onSample: (s: SampleGarment) => void;
  onCategory: (c: Category) => void;
  onPhotoType: (p: PhotoType) => void;
  onContinue: () => void;
}) {
  const { t } = useI18n();
  const p = t.product;
  const samples = ALL_SAMPLES.filter((s) => setup.samples.includes(s.id));
  const reason = !inputs.garment ? p.reasonNoPhoto : !inputs.category ? p.reasonNoCategory : null;

  return (
    <div className="rise">
      <PageHeader title={p.h1} lead={p.lead} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] xl:gap-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{t.help.topics.productPhoto.title}</h2>
            <HelpTip topic="productPhoto" />
          </div>
          <Dropzone
            className="aspect-square lg:aspect-[5/4]"
            previewUrl={inputs.garment?.url ?? null}
            onFile={onFile}
            onClear={onClear}
            title={busyLoading ? t.common.loading : p.dropTitle}
            hint={p.dropHint}
            pasteTarget
          />
          {error && <Notice tone="error">{error}</Notice>}
          {note && !error && <Notice tone="info">{note}</Notice>}
        </div>

        <div className="card grid gap-6 p-5 sm:p-6 xl:grid-cols-2">
          <fieldset className="xl:col-span-2">
            <legend className="mb-3 flex items-center gap-2 text-sm font-semibold">
              {p.kindLegend} <span className="font-normal text-ink-3">{t.common.required}</span> <HelpTip topic="category" />
            </legend>
            <Choices
              label={p.kindLabel}
              value={inputs.category}
              onChange={onCategory}
              options={CATEGORIES.map((c) => ({ value: c, ...p.categories[c], icon: ICONS[c] }))}
            />
          </fieldset>
          <fieldset>
            <legend className="mb-3 flex items-center gap-2 text-sm font-semibold">
              {p.photoLegend} <HelpTip topic="photoType" />
            </legend>
            <Choices
              label={p.photoLabel}
              columns={2}
              value={inputs.photoType}
              onChange={onPhotoType}
              options={[
                { value: "flat-lay", ...p.photoTypes["flat-lay"], icon: ICONS["flat-lay"] },
                { value: "model", ...p.photoTypes.model, icon: ICONS.model },
              ]}
            />
          </fieldset>
          <div className="rounded-xl border border-line bg-paper-2 p-4 text-xs leading-relaxed text-ink-2">
            <p className="font-semibold text-ink">{p.tipsTitle}</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              {p.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {samples.length > 0 && <SamplePicker samples={samples} selectedUrl={inputs.garment?.url ?? null} busy={busyLoading} onSample={onSample} />}

      <ActionBar reason={reason}>
        <span />
        <button type="button" className="btn-primary !px-6 !py-3" disabled={reason !== null} onClick={onContinue}>
          {t.common.continue} <span aria-hidden>→</span>
        </button>
      </ActionBar>
    </div>
  );
}

/** Every sample garment on this server: category tabs, search in either language, a dense grid. */
function SamplePicker({ samples, selectedUrl, busy, onSample }: { samples: SampleGarment[]; selectedUrl: string | null; busy: boolean; onSample: (s: SampleGarment) => void }) {
  const { t } = useI18n();
  const S = t.sampleX;
  const [tab, setTab] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const searchId = useId();
  const counts = categoryCounts(samples);
  const name = (s: SampleGarment) => t.product.samples[s.id] ?? s.label;
  const shown = filterSamples(samples, { category: tab, query, names: (s) => [s.label, messages.en.product.samples[s.id] ?? "", messages.hi.product.samples[s.id] ?? ""] });
  const tabs: CategoryFilter[] = ["all", ...CATEGORIES];

  return (
    <section aria-labelledby="samples-title" className="card mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line px-5 py-4 sm:px-6">
        <div className="mr-auto">
          <h2 id="samples-title" className="flex items-center gap-2 text-base font-semibold">
            {S.title} <HelpTip topic="samples" />
          </h2>
          <p className="text-sm text-ink-3">{S.lead}</p>
        </div>
        <div role="radiogroup" aria-label={S.tabsLabel} className="inline-flex flex-wrap rounded-lg border border-line bg-paper-2 p-0.5">
          {tabs.map((c, i) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={tab === c}
              tabIndex={rovingTabIndex(tab === c, i, true)}
              onKeyDown={radioKeyDown}
              onClick={() => setTab(c)}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium ${tab === c ? "bg-paper-glow text-ink shadow-[var(--shadow-card)]" : "text-ink-2 hover:text-ink"}`}
            >
              {c === "all" ? S.all : t.product.categories[c].title}
              <span className="text-xs text-ink-3 tabular-nums">{counts[c]}</span>
            </button>
          ))}
        </div>
        <div className="flex w-full items-center gap-2 sm:w-72">
          <label htmlFor={searchId} className="sr-only">
            {S.search}
          </label>
          <input id={searchId} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={S.searchPh} className="input" />
          <HelpTip topic="sampleFilter" />
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <p className="mb-3 text-xs text-ink-3" aria-live="polite">
          {S.count(shown.length)}
        </p>
        {shown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong/60 p-8 text-center text-sm text-ink-3">
            <p>{S.none}</p>
            <button type="button" onClick={() => (setQuery(""), setTab("all"))} className="btn-ghost mt-3">
              {S.clear}
            </button>
          </div>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-9">
            {shown.map((s) => {
              const on = selectedUrl === `/samples/${s.file}`;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={busy}
                    onClick={() => onSample(s)}
                    className="option group flex h-full w-full flex-col overflow-hidden text-left disabled:opacity-60"
                  >
                    <span className="relative block aspect-square w-full shrink-0 overflow-hidden bg-paper-glow">
                      <img src={`/samples/${s.file}`} alt="" loading="lazy" className="absolute inset-0 size-full object-contain p-2 transition-transform group-hover:scale-[1.03]" />
                      <span className={`absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-2xs font-semibold ${s.catalogue ? "bg-paper-2 text-ink-2" : "bg-accent-wash text-accent-strong"}`}>
                        {s.catalogue ? S.catalogue : S.studio}
                      </span>
                    </span>
                    <span className="block flex-1 border-t border-line px-2.5 py-2 text-xs leading-snug font-medium text-ink">{name(s)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 text-2xs leading-relaxed text-ink-3">{S.note}</p>
      </div>
    </section>
  );
}

/* ── Step 2: the model ───────────────────────────────────────────────── */

const QUALITIES: Quality[] = ["fast", "balanced", "best"];
const WEARING: WearingFilter[] = ["any", "separates", "one-piece"];
const GENDERS: GenderFilter[] = ["all", "women", "men"];

export function ModelStep({
  inputs,
  setup,
  error,
  onPerson,
  onPersonFile,
  onClearPerson,
  onQuality,
  onModel,
  onSeed,
  onBack,
  onReview,
}: {
  inputs: Inputs;
  setup: Setup;
  error: string | null;
  onPerson: (p: PersonChoice) => void;
  onPersonFile: (file: File) => void;
  onClearPerson: () => void;
  onQuality: (q: Quality) => void;
  onModel: (m: ModelChoice) => void;
  onSeed: (seed: number) => void;
  onBack: () => void;
  onReview: () => void;
}) {
  const { t } = useI18n();
  const m = t.model;
  const X = t.modelX;
  const [showAdvanced, setShowAdvanced] = useState(inputs.quality !== "balanced" || inputs.seed !== STANDARD_SEED);
  const [suitsOnly, setSuitsOnly] = useState(false);
  const [wearing, setWearing] = useState<WearingFilter>("any");
  const [gender, setGender] = useState<GenderFilter>("all");
  const [seedText, setSeedText] = useState(String(inputs.seed));
  const seedId = useId();
  const seedErrorId = useId();
  const installed = PRESETS.filter((p) => setup.presets.includes(p.id));
  const category = inputs.category;
  const shown = filterPresets(PRESETS, { gender, wearing, suits: suitsOnly ? category : null });
  const chosen = inputs.person?.kind === "preset" ? PRESETS.find((p) => p.id === (inputs.person as { id: string }).id) : undefined;
  const mismatch = chosen && category && !chosen.suits.includes(category) ? chosen : undefined;
  // `suits` is ordered best-first, so the preset listing this category earliest is the strongest suggestion.
  const better = mismatch && category ? bestPresetFor(installed, category) : undefined;
  const presetText = (id: string, fallback: { label: string; note: string }) => m.presets[id] ?? fallback;
  const seedBad = parseSeed(seedText) === null;
  const reason = !inputs.person ? m.reasonNoPerson : seedBad ? X.seedError : null;
  const setSeed = (n: number) => {
    setSeedText(String(n));
    onSeed(n);
  };
  const filtered = suitsOnly || wearing !== "any" || gender !== "all";
  const clearFilters = () => {
    setSuitsOnly(false);
    setWearing("any");
    setGender("all");
  };

  return (
    <div className="rise">
      <PageHeader title={m.h1} lead={m.lead} />

      {installed.length < PRESETS.length && (
        <div className="mt-4">
          <Notice tone="warn">{installed.length === 0 ? m.noneInstalled : m.someMissing}</Notice>
        </div>
      )}

      {/* Filters: by fit for this garment, and by what the model already wears. */}
      <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-line bg-paper-glow px-4 py-2.5 shadow-[var(--shadow-card)]">
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          {X.filterLabel} <HelpTip topic="modelFilter" />
        </span>
        {category && (
          <button type="button" aria-pressed={suitsOnly} onClick={() => setSuitsOnly((v) => !v)} className="option inline-flex min-h-11 items-center !rounded-full px-4 text-sm font-medium">
            {X.suitsOnly(t.product.categoryPlural[category])}
          </button>
        )}
        <Segmented
          label={X.gender}
          id="gender-label"
          value={gender}
          options={GENDERS.map((g) => ({ value: g, label: g === "all" ? X.genderAll : g === "men" ? X.men : X.women }))}
          onChange={setGender}
        />
        <div className="flex items-center gap-2">
          <span id="wearing-label" className="text-sm text-ink-3">
            {X.wearing}
          </span>
          <div role="radiogroup" aria-labelledby="wearing-label" className="inline-flex rounded-lg border border-line bg-paper-2 p-0.5">
            {WEARING.map((w, i) => (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={wearing === w}
                tabIndex={rovingTabIndex(wearing === w, i, true)}
                onKeyDown={radioKeyDown}
                onClick={() => setWearing(w)}
                className={`min-h-10 rounded-md px-3 text-sm font-medium transition-colors ${wearing === w ? "bg-paper-glow text-ink shadow-[var(--shadow-card)]" : "text-ink-2 hover:text-ink"}`}
              >
                {w === "any" ? X.wearingAny : w === "separates" ? X.separates : X.onePiece}
              </button>
            ))}
          </div>
        </div>
        {filtered && (
          <button type="button" onClick={clearFilters} className="ml-auto inline-flex min-h-11 items-center text-sm font-medium text-accent-strong hover:underline">
            {X.clear}
          </button>
        )}
      </div>

      <div className="mt-5 flex items-center gap-2">
        <h2 id="model-group" className="text-sm font-semibold">
          {m.groupLabel}
        </h2>
        <HelpTip topic="model" />
      </div>
      <div role="radiogroup" aria-labelledby="model-group" className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5">
        {shown.map((p, i) => {
          const ready = setup.presets.includes(p.id);
          const active = inputs.person?.kind === "preset" && inputs.person.id === p.id;
          const text = presetText(p.id, p);
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={rovingTabIndex(active, i, shown.some((x) => inputs.person?.kind === "preset" && inputs.person.id === x.id))}
              onKeyDown={radioKeyDown}
              disabled={!ready}
              onClick={() => onPerson({ kind: "preset", id: p.id })}
              className={`overflow-hidden rounded-2xl border bg-paper-glow text-left shadow-[var(--shadow-card)] transition-colors disabled:opacity-40 ${
                active ? "border-accent-strong ring-2 ring-accent-strong" : "border-line hover:border-line-strong"
              }`}
            >
              <div className="relative aspect-[3/4] bg-paper-3">
                {ready && <img src={`/presets/${p.file}`} alt="" className="size-full object-cover" />}
                {ready && category && (
                  <span
                    className={`absolute top-2 left-2 rounded-md px-2 py-1 text-xs font-bold shadow-[var(--shadow-card)] ${
                      fitFor(p, category) === "suits" ? "bg-good text-paper-glow" : "bg-danger text-paper-glow"
                    }`}
                  >
                    {fitFor(p, category) === "suits" ? m.suits(t.product.categoryPlural[category]) : m.notFor(t.product.categoryPlural[category])}
                  </span>
                )}
              </div>
              <div className={`p-3 ${active ? "bg-accent-wash" : "bg-paper-glow"}`}>
                <p className="text-sm font-semibold">{text.label}</p>
                <p className="mt-0.5 text-2xs leading-snug text-ink-3">{ready ? text.note : m.notInstalled}</p>
                <p className="mt-1.5 text-2xs text-ink-3">
                  {p.gender === "men" ? X.men : X.women} · {p.wearing === "separates" ? X.separates : X.onePiece}
                </p>
              </div>
            </button>
          );
        })}
        {shown.length === 0 && (
          <div className="col-span-2 grid place-items-center rounded-2xl border border-dashed border-line-strong/60 bg-paper-glow p-6 text-center text-sm text-ink-3 sm:col-span-3">
            <div>
              <p>{X.noMatch}</p>
              <button type="button" onClick={clearFilters} className="mt-2 inline-flex min-h-11 items-center font-semibold text-accent-strong">
                {X.clear}
              </button>
            </div>
          </div>
        )}
        <div className={`flex flex-col overflow-hidden rounded-2xl border bg-paper-glow shadow-[var(--shadow-card)] ${inputs.person?.kind === "upload" ? "border-accent-strong ring-2 ring-accent-strong" : "border-line"}`}>
          <Dropzone
            compact
            className="aspect-[3/4] rounded-none border-0"
            previewUrl={inputs.person?.kind === "upload" ? inputs.person.picked.url : null}
            onFile={(f) => onPersonFile(f)}
            onClear={onClearPerson}
            title={m.ownTitle}
            hint={m.ownHint}
          />
          <div className={`flex items-start justify-between gap-1 border-t border-line p-3 ${inputs.person?.kind === "upload" ? "bg-accent-wash" : "bg-paper-glow"}`}>
            <div>
              <p className="text-sm font-semibold">{m.uploadTitle}</p>
              <p className="mt-0.5 text-2xs leading-snug text-ink-3">{m.uploadHint}</p>
            </div>
            <HelpTip topic="ownModel" />
          </div>
        </div>
      </div>
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      {mismatch && category && (
        <div className="mt-3">
          <Notice tone="warn">
            <strong>{m.mismatch(presetText(mismatch.id, mismatch).label, t.product.categoryOne[category])}</strong>{" "}
            {mismatch.wearing === "one-piece" && category === "bottoms" ? m.mismatchDress : m.mismatchOther}{" "}
            {better && (
              <button type="button" className="min-h-11 font-semibold underline" onClick={() => onPerson({ kind: "preset", id: better.id })}>
                {m.useInstead(presetText(better.id, better).label)}
              </button>
            )}
          </Notice>
        </div>
      )}
      {inputs.person?.kind === "upload" && category === "bottoms" && (
        <div className="mt-3">
          <Notice tone="info">{m.bottomTip}</Notice>
        </div>
      )}

      <ModelPicker setup={setup} value={inputs.model} quality={inputs.quality} onChange={onModel} />

      {/* Advanced: quality (refinement steps) and seed — both real request settings. */}
      <div className="card mt-6">
        <div className="flex items-center gap-1 pr-4">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            aria-controls="advanced-settings"
            className="flex min-h-12 flex-1 items-center gap-3 px-4 py-3 text-left text-sm"
          >
            <svg viewBox="0 0 20 20" className={`size-4 shrink-0 text-ink-3 transition-transform ${showAdvanced ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="m7.5 5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-semibold">{X.advanced}</span>
            <span className="truncate text-ink-3">
              {m.qualities[inputs.quality].title} · {X.seed} {inputs.seed}
            </span>
          </button>
          <HelpTip topic="advanced" />
        </div>
        {showAdvanced && (
          <div id="advanced-settings" className="grid gap-6 border-t border-line p-4 sm:p-5 md:grid-cols-[1.4fr_1fr]">
            <fieldset>
              <legend className="mb-3 flex items-center gap-2 text-sm font-semibold">
                {m.qualityLabel} <HelpTip topic="quality" />
              </legend>
              <Choices label={m.qualityLabel} value={inputs.quality} onChange={onQuality} options={QUALITIES.map((q) => ({ value: q, ...m.qualities[q] }))} />
              <p className="mt-3 text-xs leading-relaxed text-ink-3">{m.qualityNote}</p>
            </fieldset>
            <div>
              <div className="mb-3 flex items-center gap-2">
                <label htmlFor={seedId} className="text-sm font-semibold">
                  {X.seed}
                </label>
                <HelpTip topic="seed" />
              </div>
              <input
                id={seedId}
                className="input font-mono tabular-nums"
                inputMode="numeric"
                value={seedText}
                aria-invalid={seedBad}
                aria-describedby={seedBad ? seedErrorId : undefined}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d]/g, "").slice(0, 10);
                  setSeedText(v);
                  const n = parseSeed(v);
                  if (n !== null) onSeed(n);
                }}
              />
              {seedBad ? (
                <p id={seedErrorId} className="mt-1.5 text-xs text-danger">
                  {X.seedError}
                </p>
              ) : (
                <p className="mt-1.5 text-xs leading-relaxed text-ink-3">{X.seedHint}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-ghost !px-3" onClick={() => setSeed(Math.floor(Math.random() * 2_000_000_000))}>
                  {X.randomSeed}
                </button>
                {inputs.seed !== STANDARD_SEED && (
                  <button type="button" className="btn-ghost !px-3" onClick={() => setSeed(STANDARD_SEED)}>
                    {X.resetSeed}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {setup.quota && (
        <div className="mt-4">
          <QuotaMeter quota={setup.quota} />
        </div>
      )}

      <ActionBar
        reason={
          reason ??
          (!setup.models[inputs.model].available
            ? t.tuned.unavailable(setup.models[inputs.model].reason ?? "")
            : setup.quota?.photosLeft === 0 && !setup.models[inputs.model].local
              ? t.quota.likelyRefused
              : m.expectation)
        }
      >
        <button type="button" className="btn-ghost" onClick={onBack}>
          <span aria-hidden>←</span> {t.common.back}
        </button>
        <button type="button" className="btn-primary !px-6 !py-3" disabled={reason !== null} onClick={onReview}>
          {t.review.toReview} <span aria-hidden>→</span>
        </button>
      </ActionBar>
    </div>
  );
}

/** A small single-choice filter (radio group with arrow keys), labelled by visible text. */
function Segmented<T extends string>({ label, id, value, options, onChange }: { label: string; id: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span id={id} className="text-sm text-ink-3">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={id} className="inline-flex rounded-lg border border-line bg-paper-2 p-0.5">
        {options.map((o, i) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            tabIndex={rovingTabIndex(value === o.value, i, true)}
            onKeyDown={radioKeyDown}
            onClick={() => onChange(o.value)}
            className={`min-h-10 rounded-md px-3 text-sm font-medium transition-colors ${value === o.value ? "bg-paper-glow text-ink shadow-[var(--shadow-card)]" : "text-ink-2 hover:text-ink"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Which try-on AI: Standard (FASHN as released) or Haat-tuned (LoRA) ── */

/** Minutes for one tuned photo on this project's 8 GB laptop at half size: ~2.7 s a step plus ~30 s to load (measured). */
export const localMinutes = (q: Quality) => Math.max(1, Math.ceil((QUALITY_STEPS[q] * 2.7 + 30) / 60));

function ModelPicker({ setup, value, quality, onChange }: { setup: Setup; value: ModelChoice; quality: Quality; onChange: (m: ModelChoice) => void }) {
  const { t } = useI18n();
  const T = t.tuned;
  const headingId = useId();
  const options: ModelChoice[] = ["base", "tuned"];
  const tuned = setup.models.tuned;
  return (
    <section aria-labelledby={headingId} className="card mt-6 p-4 sm:p-5">
      <h2 id={headingId} className="text-sm font-semibold">
        {T.label}
      </h2>
      <p className="mt-1 text-xs text-ink-3">{T.lead}</p>
      <div role="radiogroup" aria-labelledby={headingId} className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((o, i) => {
          const avail = setup.models[o];
          const active = o === value;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={active}
              aria-disabled={!avail.available}
              tabIndex={rovingTabIndex(active, i, true)}
              onKeyDown={radioKeyDown}
              onClick={() => avail.available && onChange(o)}
              className={`option flex min-h-11 flex-col items-start gap-1 px-4 py-3 text-left ${active ? "text-accent-strong" : ""} ${avail.available ? "" : "cursor-not-allowed opacity-60"}`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                {T.options[o].title}
                {o === "tuned" && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-2xs font-semibold text-accent-strong">LoRA</span>}
              </span>
              <span className="text-xs text-ink-3">{T.options[o].hint}</span>
              {!avail.available && <span className="text-2xs text-ink-3">{T.unavailable(avail.reason ?? "")}</span>}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-2">
        {T.measured} {tuned.available && (tuned.local ? T.local(localMinutes(quality)) : T.hosted)}
      </p>
    </section>
  );
}
