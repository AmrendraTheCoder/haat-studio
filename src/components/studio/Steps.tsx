"use client";

import { useState } from "react";
import { radioKeyDown, rovingTabIndex } from "@/lib/client/roving";
import { useI18n } from "@/lib/i18n/client";
import { PRESETS, SAMPLE_GARMENTS, type SampleGarment } from "@/lib/presets";
import type { Setup } from "@/lib/site";
import { ActionBar, Choices, Dropzone, ICONS, Notice, QuotaMeter } from "./parts";
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
  const samples = SAMPLE_GARMENTS.filter((s) => setup.samples.includes(s.id));
  const reason = !inputs.garment ? p.reasonNoPhoto : !inputs.category ? p.reasonNoCategory : null;

  return (
    <div className="rise">
      <h1 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">{p.h1}</h1>
      <p className="mt-2 text-ink-2">{p.lead}</p>

      <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <Dropzone
            className="aspect-square"
            previewUrl={inputs.garment?.url ?? null}
            onFile={onFile}
            onClear={onClear}
            title={busyLoading ? t.common.loading : p.dropTitle}
            hint={p.dropHint}
            pasteTarget
          />
          {error && <Notice tone="error">{error}</Notice>}
          {note && !error && <Notice tone="info">{note}</Notice>}
          {samples.length > 0 && (
            <div>
              <p className="kicker !text-2xs">{p.trySample}</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {samples.map((s) => {
                  const label = p.samples[s.id] ?? s.label;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSample(s)}
                      title={label}
                      className="overflow-hidden rounded-xl border border-line bg-white transition-colors hover:border-ink"
                    >
                      <img src={`/samples/${s.file}`} alt={label} className="aspect-square w-full object-contain p-1.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">
              {p.kindLegend} <span className="font-normal text-ink-3">{t.common.required}</span>
            </legend>
            <Choices
              label={p.kindLabel}
              value={inputs.category}
              onChange={onCategory}
              options={CATEGORIES.map((c) => ({ value: c, ...p.categories[c], icon: ICONS[c] }))}
            />
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">{p.photoLegend}</legend>
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
          <div className="rounded-xl bg-paper-2 p-4 text-xs leading-relaxed text-ink-2">
            <p className="font-semibold text-ink">{p.tipsTitle}</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              {p.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <ActionBar reason={reason}>
        <span />
        <button type="button" className="btn-primary !px-6 !py-3" disabled={reason !== null} onClick={onContinue}>
          {t.common.continue} <span aria-hidden>→</span>
        </button>
      </ActionBar>
    </div>
  );
}

/* ── Step 2: the model ───────────────────────────────────────────────── */

const QUALITIES: Quality[] = ["fast", "balanced", "best"];

export function ModelStep({
  inputs,
  setup,
  error,
  onPerson,
  onPersonFile,
  onClearPerson,
  onQuality,
  onBack,
  onCreate,
}: {
  inputs: Inputs;
  setup: Setup;
  error: string | null;
  onPerson: (p: PersonChoice) => void;
  onPersonFile: (file: File) => void;
  onClearPerson: () => void;
  onQuality: (q: Quality) => void;
  onBack: () => void;
  onCreate: () => void;
}) {
  const { t } = useI18n();
  const m = t.model;
  const [showQuality, setShowQuality] = useState(false);
  const installed = PRESETS.filter((p) => setup.presets.includes(p.id));
  const category = inputs.category;
  const chosen = inputs.person?.kind === "preset" ? PRESETS.find((p) => p.id === (inputs.person as { id: string }).id) : undefined;
  const mismatch = chosen && category && !chosen.suits.includes(category) ? chosen : undefined;
  // `suits` is ordered best-first, so the preset listing this category earliest is the strongest suggestion.
  const better =
    mismatch && category
      ? installed.filter((p) => p.suits.includes(category)).sort((a, b) => a.suits.indexOf(category) - b.suits.indexOf(category))[0]
      : undefined;
  const presetText = (id: string, fallback: { label: string; note: string }) => m.presets[id] ?? fallback;
  const reason = !inputs.person ? m.reasonNoPerson : !setup.engine.configured ? m.reasonOff : null;

  return (
    <div className="rise">
      <h1 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">{m.h1}</h1>
      <p className="mt-2 text-ink-2">{m.lead}</p>

      {installed.length < PRESETS.length && (
        <div className="mt-4">
          <Notice tone="warn">{installed.length === 0 ? m.noneInstalled : m.someMissing}</Notice>
        </div>
      )}

      <div role="radiogroup" aria-label={m.groupLabel} className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PRESETS.map((p, i) => {
          const ready = setup.presets.includes(p.id);
          const active = inputs.person?.kind === "preset" && inputs.person.id === p.id;
          const text = presetText(p.id, p);
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={rovingTabIndex(active, i, inputs.person?.kind === "preset")}
              onKeyDown={radioKeyDown}
              disabled={!ready}
              onClick={() => onPerson({ kind: "preset", id: p.id })}
              className={`overflow-hidden rounded-2xl border text-left transition-colors disabled:opacity-40 ${
                active ? "border-ink ring-2 ring-ink" : "border-line hover:border-ink"
              }`}
            >
              <div className="aspect-[3/4] bg-paper-3">
                {ready && <img src={`/presets/${p.file}`} alt="" className="size-full object-cover" />}
              </div>
              <div className={`p-2.5 ${active ? "bg-ink text-paper" : "bg-paper-glow"}`}>
                <p className="text-sm font-semibold">{text.label}</p>
                <p className={`mt-0.5 text-2xs leading-snug ${active ? "text-paper/70" : "text-ink-3"}`}>{ready ? text.note : m.notInstalled}</p>
                {ready && category && (
                  <p className={`mt-1.5 font-mono text-2xs ${p.suits.includes(category) ? (active ? "text-paper" : "text-good") : "text-danger"}`}>
                    {p.suits.includes(category) ? m.suits(t.product.categoryPlural[category]) : m.notFor(t.product.categoryPlural[category])}
                  </p>
                )}
              </div>
            </button>
          );
        })}
        <div className={`flex flex-col overflow-hidden rounded-2xl border ${inputs.person?.kind === "upload" ? "border-ink ring-2 ring-ink" : "border-line"}`}>
          <Dropzone
            compact
            className="aspect-[3/4] rounded-none border-0"
            previewUrl={inputs.person?.kind === "upload" ? inputs.person.picked.url : null}
            onFile={(f) => onPersonFile(f)}
            onClear={onClearPerson}
            title={m.ownTitle}
            hint={m.ownHint}
          />
          <div className={`p-2.5 ${inputs.person?.kind === "upload" ? "bg-ink text-paper" : "bg-paper-glow"}`}>
            <p className="text-sm font-semibold">{m.uploadTitle}</p>
            <p className={`mt-0.5 text-2xs leading-snug ${inputs.person?.kind === "upload" ? "text-paper/70" : "text-ink-3"}`}>{m.uploadHint}</p>
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

      <div className="mt-6 rounded-2xl border border-line">
        <button
          type="button"
          onClick={() => setShowQuality((s) => !s)}
          aria-expanded={showQuality}
          className="flex min-h-11 w-full items-center justify-between px-4 py-3 text-sm"
        >
          <span>
            <span className="font-semibold">{m.quality}</span> {m.qualities[inputs.quality].title}
          </span>
          <span className="text-ink-3">{showQuality ? m.hide : m.change}</span>
        </button>
        {showQuality && (
          <div className="border-t border-line p-4">
            <Choices label={m.qualityLabel} value={inputs.quality} onChange={onQuality} options={QUALITIES.map((q) => ({ value: q, ...m.qualities[q] }))} />
            <p className="mt-3 text-xs text-ink-3">{m.qualityNote}</p>
          </div>
        )}
      </div>

      {setup.quota && (
        <div className="mt-4">
          <QuotaMeter quota={setup.quota} />
        </div>
      )}

      {/* Say what pressing Create costs before it's pressed: time, and free quota. */}
      <ActionBar reason={reason ?? (setup.quota?.photosLeft === 0 ? t.quota.likelyRefused : m.expectation)}>
        <button type="button" className="btn-ghost" onClick={onBack}>
          <span aria-hidden>←</span> {t.common.back}
        </button>
        <button type="button" className="btn-primary !px-6 !py-3" disabled={reason !== null} onClick={onCreate}>
          {m.create} <span aria-hidden>→</span>
        </button>
      </ActionBar>
    </div>
  );
}
