"use client";

import { useState } from "react";
import { PRESETS, SAMPLE_GARMENTS, type SampleGarment } from "@/lib/presets";
import type { Setup } from "@/lib/site";
import { ActionBar, Choices, Dropzone, ICONS, Notice } from "./parts";
import type { Category, Inputs, PersonChoice, PhotoType, Quality } from "./types";

export const CATEGORY_TEXT: Record<Category, { title: string; hint: string }> = {
  tops: { title: "Top", hint: "shirts, tees, tops, blouses" },
  bottoms: { title: "Bottom", hint: "jeans, trousers, skirts" },
  "one-pieces": { title: "Full outfit", hint: "dresses, jumpsuits" },
};

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
  const samples = SAMPLE_GARMENTS.filter((s) => setup.samples.includes(s.id));
  const reason = !inputs.garment ? "Add a photo of the garment, or pick a sample." : !inputs.category ? "Choose what kind of garment it is." : null;

  return (
    <div className="rise">
      <h1 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">What are you selling?</h1>
      <p className="mt-2 text-ink-2">One clear photo of the garment on its own. You can paste a copied image too.</p>

      <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <Dropzone
            className="aspect-square"
            previewUrl={inputs.garment?.url ?? null}
            onFile={onFile}
            onClear={onClear}
            title={busyLoading ? "Loading…" : "Add your product photo"}
            hint="Tap to choose, or drop it here · JPEG, PNG or WebP · up to 15 MB"
            pasteTarget
          />
          {error && <Notice tone="error">{error}</Notice>}
          {note && !error && <Notice tone="info">{note}</Notice>}
          {samples.length > 0 && (
            <div>
              <p className="kicker !text-[10px]">No photo handy? Try a sample</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {samples.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSample(s)}
                    title={s.label}
                    className="overflow-hidden rounded-xl border border-line bg-white transition-colors hover:border-ink"
                  >
                    <img src={`/samples/${s.file}`} alt={s.label} className="aspect-square w-full object-contain p-1.5" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">
              What kind of garment? <span className="font-normal text-ink-3">(required)</span>
            </legend>
            <Choices
              label="Garment category"
              value={inputs.category}
              onChange={onCategory}
              options={(Object.keys(CATEGORY_TEXT) as Category[]).map((c) => ({ value: c, ...CATEGORY_TEXT[c], icon: ICONS[c] }))}
            />
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">How is it photographed?</legend>
            <Choices
              label="Photo type"
              columns={2}
              value={inputs.photoType}
              onChange={onPhotoType}
              options={[
                { value: "flat-lay", title: "Flat or on a hanger", hint: "no one wearing it", icon: ICONS["flat-lay"] },
                { value: "model", title: "Worn by someone", hint: "the photo shows a person", icon: ICONS.model },
              ]}
            />
          </fieldset>
          <div className="rounded-xl bg-paper-2 p-4 text-xs leading-relaxed text-ink-2">
            <p className="font-semibold text-ink">For the most faithful result</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              <li>Whole garment in frame, front side up, nothing cut off.</li>
              <li>Plain background, even light, few folds.</li>
              <li>One garment per photo.</li>
            </ul>
          </div>
        </div>
      </div>

      <ActionBar reason={reason}>
        <span />
        <button type="button" className="btn-primary !px-6 !py-3" disabled={reason !== null} onClick={onContinue}>
          Continue <span aria-hidden>→</span>
        </button>
      </ActionBar>
    </div>
  );
}

/* ── Step 2: the model ───────────────────────────────────────────────── */

const QUALITY: { value: Quality; title: string; hint: string }[] = [
  { value: "fast", title: "Fast", hint: "20 steps · least GPU" },
  { value: "balanced", title: "Balanced", hint: "30 steps · recommended" },
  { value: "best", title: "Best", hint: "50 steps · ~1.7× the GPU" },
];

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
  const [showQuality, setShowQuality] = useState(false);
  const installed = PRESETS.filter((p) => setup.presets.includes(p.id));
  const reason = !inputs.person
    ? "Choose a model, or upload a photo of one."
    : !setup.engine.configured
      ? "Generation is switched off on this server (no Hugging Face token) — see the note at the top."
      : null;

  return (
    <div className="rise">
      <h1 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">Who should wear it?</h1>
      <p className="mt-2 text-ink-2">Pick a model, or upload a photo of a real person standing front-on.</p>

      {installed.length < PRESETS.length && (
        <div className="mt-4">
          <Notice tone="warn">
            {installed.length === 0 ? "No model photos are installed" : "Some model photos are missing"} on this server — run{" "}
            <code className="font-mono">npm run setup</code>. You can still upload your own.
          </Notice>
        </div>
      )}

      <div role="radiogroup" aria-label="Model" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PRESETS.map((p) => {
          const ready = setup.presets.includes(p.id);
          const active = inputs.person?.kind === "preset" && inputs.person.id === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
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
                <p className="text-sm font-semibold">{p.label}</p>
                <p className={`mt-0.5 text-[11px] leading-snug ${active ? "text-paper/70" : "text-ink-3"}`}>{ready ? p.note : "Not installed"}</p>
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
            title="Your own model"
            hint="One person, front-on, full body or waist-up"
          />
          <div className={`p-2.5 ${inputs.person?.kind === "upload" ? "bg-ink text-paper" : "bg-paper-glow"}`}>
            <p className="text-sm font-semibold">Upload a photo</p>
            <p className={`mt-0.5 text-[11px] leading-snug ${inputs.person?.kind === "upload" ? "text-paper/70" : "text-ink-3"}`}>
              Arms away from the body, plain background.
            </p>
          </div>
        </div>
      </div>
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-line">
        <button
          type="button"
          onClick={() => setShowQuality((s) => !s)}
          aria-expanded={showQuality}
          className="flex w-full items-center justify-between px-4 py-3 text-sm"
        >
          <span>
            <span className="font-semibold">Quality:</span> {QUALITY.find((q) => q.value === inputs.quality)?.title}
          </span>
          <span className="text-ink-3">{showQuality ? "Hide" : "Change"}</span>
        </button>
        {showQuality && (
          <div className="border-t border-line p-4">
            <Choices label="Quality" value={inputs.quality} onChange={onQuality} options={QUALITY} />
            <p className="mt-3 text-xs text-ink-3">
              More steps can sharpen detail but use more of the free daily GPU time. Balanced is the default.
            </p>
          </div>
        )}
      </div>

      <ActionBar reason={reason}>
        <button type="button" className="btn-ghost" onClick={onBack}>
          <span aria-hidden>←</span> Back
        </button>
        <button type="button" className="btn-primary !px-6 !py-3" disabled={reason !== null} onClick={onCreate}>
          Create photo <span aria-hidden>→</span>
        </button>
      </ActionBar>
    </div>
  );
}
