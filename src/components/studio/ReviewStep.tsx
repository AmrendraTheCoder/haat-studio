"use client";

import type { ReactNode } from "react";
import { HelpTip } from "@/components/shared/HelpTip";
import { TEST_ENGINES } from "@/lib/engines";
import { useI18n } from "@/lib/i18n/client";
import { ALL_SAMPLES, PRESETS } from "@/lib/presets";
import type { Setup } from "@/lib/site";
import { QUALITY_STEPS } from "@/lib/tryon/types";
import { STANDARD_SEED, costKind, createBlock, fitFor } from "@/lib/ui/catalogue";
import { ActionBar, QuotaMeter } from "./parts";
import type { Inputs, View } from "./types";

/**
 * Step 3: every choice in one list, each with a way back to change it, and
 * what pressing Create will cost — before anything is spent.
 */
export function ReviewStep({ inputs, setup, onEdit, onCreate }: { inputs: Inputs; setup: Setup; onEdit: (v: View) => void; onCreate: () => void }) {
  const { t } = useI18n();
  const R = t.review;
  const { garment, category, person } = inputs;
  const preset = person?.kind === "preset" ? PRESETS.find((p) => p.id === person.id) : undefined;
  const presetText = preset ? (t.model.presets[preset.id] ?? preset) : null;
  const personUrl = preset ? `/presets/${preset.file}` : person?.kind === "upload" ? person.picked.url : null;
  const sample = ALL_SAMPLES.find((s) => garment?.url === `/samples/${s.file}`);
  const fit = fitFor(preset, category);
  const test = TEST_ENGINES.has(setup.engine.id);
  const quota = setup.quota;
  const block = createBlock({ garment: Boolean(garment), category: Boolean(category), person: Boolean(person), configured: setup.engine.configured });
  const reason = block === "incomplete" ? t.studio.steps.finishEarlier : block === "off" ? t.model.reasonOff : null;

  const kind = costKind({ test, photosLeft: quota ? quota.photosLeft : null });
  const cost = kind === "test" ? R.costTest : kind === "unknown" ? R.costUnknown : R.cost(quota?.photosLeft ?? 0);

  return (
    <div className="rise">
      <div className="flex items-center gap-2">
        <h1 className="h-page">{R.h1}</h1>
        <HelpTip topic="review" />
      </div>
      <p className="mt-2 max-w-2xl text-ink-2">{R.lead}</p>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="review-summary" className="card overflow-hidden">
          <div className="flex items-center gap-4 border-b border-line bg-paper-2/60 p-5">
            <h2 id="review-summary" className="mr-auto text-sm font-semibold">
              {R.summary}
            </h2>
            {garment && <img src={garment.url} alt={R.rows.garment} className="size-20 rounded-xl border border-line bg-paper-glow object-contain p-1.5" />}
            <span aria-hidden className="text-ink-3">+</span>
            {personUrl && <img src={personUrl} alt={R.rows.model} className="h-24 w-[4.5rem] rounded-xl border border-line object-cover" />}
          </div>
          <dl className="divide-y divide-line">
            <Row label={R.rows.garment} edit={() => onEdit("product")} editLabel={R.editAria(R.rows.garment)}>
              {sample ? (t.product.samples[sample.id] ?? sample.label) : R.uploaded}
            </Row>
            <Row label={R.rows.category} edit={() => onEdit("product")} editLabel={R.editAria(R.rows.category)}>
              {category ? t.product.categories[category].title : "—"}
            </Row>
            <Row label={R.rows.photoType} edit={() => onEdit("product")} editLabel={R.editAria(R.rows.photoType)}>
              {t.product.photoTypes[inputs.photoType].title}
            </Row>
            <Row label={R.rows.model} edit={() => onEdit("model")} editLabel={R.editAria(R.rows.model)}>
              {presetText ? presetText.label : R.ownModel}
            </Row>
            <Row label={R.rows.fit} edit={() => onEdit("model")} editLabel={R.editAria(R.rows.fit)}>
              {fit === "unrated" || !category ? (
                <span className="text-ink-2">{R.ownFit}</span>
              ) : fit === "suits" ? (
                <span className="font-semibold text-good">{t.model.suits(t.product.categoryPlural[category])}</span>
              ) : (
                <span className="font-semibold text-danger">{t.model.notFor(t.product.categoryPlural[category])}</span>
              )}
            </Row>
            <Row label={R.rows.quality} edit={() => onEdit("model")} editLabel={R.editAria(R.rows.quality)}>
              {R.qualityValue(t.model.qualities[inputs.quality].title, QUALITY_STEPS[inputs.quality])}
            </Row>
            <Row label={R.rows.seed} edit={() => onEdit("model")} editLabel={R.editAria(R.rows.seed)}>
              <span className="tabular-nums">{inputs.seed === STANDARD_SEED ? R.seedDefault(inputs.seed) : R.seedCustom(inputs.seed)}</span>
            </Row>
          </dl>
        </section>

        <aside aria-labelledby="review-cost" className="space-y-4 lg:sticky lg:top-24">
          <section className="card p-5">
            <h2 id="review-cost" className="text-sm font-semibold">
              {R.costTitle}
            </h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="text-xs font-medium text-ink-3">{R.rows.time}</dt>
                <dd className="mt-0.5">{R.time}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-ink-3">{R.rows.cost}</dt>
                <dd className={`mt-0.5 font-semibold ${quota?.photosLeft === 0 ? "text-danger" : ""}`}>{cost}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-ink-3">{R.rows.reuse}</dt>
                <dd className="mt-0.5 text-ink-2">{R.reuse}</dd>
              </div>
            </dl>
            {/* On wide screens the main action sits with its cost; phones use the sticky bar below. */}
            <div className="mt-5 hidden border-t border-line pt-5 lg:block">
              <button type="button" className="btn-primary w-full !py-3 !text-base" disabled={reason !== null} onClick={onCreate}>
                {R.create} <span aria-hidden>→</span>
              </button>
              <p className="mt-2 text-center text-xs text-ink-3">{reason ?? (quota?.photosLeft === 0 ? t.quota.likelyRefused : t.model.expectation)}</p>
            </div>
          </section>
          {quota && <QuotaMeter quota={quota} />}
        </aside>
      </div>

      <div className="lg:hidden">
      <ActionBar reason={reason ?? (quota?.photosLeft === 0 ? t.quota.likelyRefused : t.model.expectation)}>
        <button type="button" className="btn-ghost" onClick={() => onEdit("model")}>
          <span aria-hidden>←</span> {t.common.back}
        </button>
        <button type="button" className="btn-primary !px-6 !py-3" disabled={reason !== null} onClick={onCreate}>
          {R.create} <span aria-hidden>→</span>
        </button>
      </ActionBar>
      </div>
      <div className="mt-6 hidden lg:block">
        <button type="button" className="btn-ghost" onClick={() => onEdit("model")}>
          <span aria-hidden>←</span> {t.common.back}
        </button>
      </div>
    </div>
  );
}

function Row({ label, edit, editLabel, children }: { label: string; edit: () => void; editLabel: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 px-5 py-1 sm:grid-cols-[11rem_1fr_auto]">
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="min-w-0 text-sm font-medium break-words">{children}</dd>
      <dd>
        <button type="button" onClick={edit} aria-label={editLabel} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-accent-strong hover:bg-accent-wash">
          {t.review.edit}
        </button>
      </dd>
    </div>
  );
}
