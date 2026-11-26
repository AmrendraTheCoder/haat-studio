"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import type { MarketOptions } from "@/lib/market/catalogue";
import { MARKET_ATTRS, type MarketAttr, type MarketType } from "@/lib/market/engines";
import { HelpTip, type HelpTopic } from "@/components/shared/HelpTip";
import { PasscodeField } from "@/components/shared/Passcode";
import { passcodeHeaders } from "@/lib/client/passcode";
import { useI18n } from "@/lib/i18n/client";
import { AGES, CATEGORIES, CHANNELS, GOALS, answersSchema } from "@/lib/research/schema";
import type { Setup } from "@/lib/site";

const ANSWERS_KEY = "haat.research.answers";
export const RESEARCH_KEY = "haat.research";

type Form = {
  shopName: string;
  product: string;
  category: keyof typeof CATEGORIES | "";
  city: string;
  channels: (keyof typeof CHANNELS)[];
  priceMin: string;
  priceMax: string;
  costPerPiece: string;
  ages: (typeof AGES)[number][];
  gender: "women" | "men" | "all" | "";
  goal: keyof typeof GOALS | "";
  /** Optional comparison with real listings: a product type and its attributes (catalogue spellings). */
  market: { type: MarketType | "" } & Partial<Record<MarketAttr, string>>;
};

const EMPTY: Form = { shopName: "", product: "", category: "", city: "", channels: ["instagram"], priceMin: "", priceMax: "", costPerPiece: "", ages: [], gender: "", goal: "", market: { type: "" } };

/** The answers' `market` field: only a chosen type and the attributes the seller filled in. */
const marketAnswer = (m: Form["market"]) => {
  if (!m.type) return undefined;
  const attrs = Object.fromEntries(Object.entries(m).filter(([k, v]) => k !== "type" && v));
  return { type: m.type, ...attrs };
};

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const digits = (v: string) => v.replace(/[^\d]/g, "");

export function ResearchForm({ setup, market = [] }: { setup: Setup; market?: MarketOptions }) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const Q = t.research;
  const [form, setForm] = useState<Form>(EMPTY);
  const [showErrors, setShowErrors] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);

  // Pre-fill from the last time, if this browser has it.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ANSWERS_KEY);
      if (saved) {
        const restored = { ...EMPTY, ...(JSON.parse(saved) as Partial<Form>) };
        // A saved product type the catalogue no longer has is dropped.
        if (restored.market?.type && !market.some((o) => o.type === restored.market.type)) restored.market = { type: "" };
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from browser storage
        setForm({ ...restored, market: restored.market ?? { type: "" } });
      }
    } catch {
      // Start empty.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once on mount; the catalogue options do not change while the page is open
  }, []);

  useEffect(() => {
    if (state !== "working") return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [state]);

  const parsed = useMemo(() => answersSchema.safeParse({ ...form, costPerPiece: form.costPerPiece || undefined, market: marketAnswer(form.market), language: locale }), [form, locale]);
  const errors = useMemo(() => {
    const out: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) out[String(i.path[0])] ??= Q.errors[String(i.path[0])] ?? i.message;
    if (!form.category) out.category = Q.errors.category;
    if (!form.gender) out.gender = Q.errors.gender;
    if (!form.goal) out.goal = Q.errors.goal;
    return out;
  }, [parsed, form, Q]);
  const missing = Object.keys(errors).length;
  const e = (k: keyof Form) => (showErrors ? errors[k] : undefined);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setReviewing(false);
  };
  const X = t.researchX;
  const rupees = (v: string) => (v ? `₹${Number(v).toLocaleString("en-IN")}` : X.none);
  const reviewRows: [string, string, number][] = [
    [X.rows.shop, form.shopName || X.none, 1],
    [X.rows.product, form.product || X.none, 1],
    [X.rows.category, form.category ? Q.categories[form.category] : X.none, 1],
    [X.rows.city, form.city || X.none, 2],
    [X.rows.channels, form.channels.map((c) => Q.channelNames[c]).join(", ") || X.none, 2],
    [X.rows.prices, `${rupees(form.priceMin)} – ${rupees(form.priceMax)}`, 3],
    [X.rows.cost, rupees(form.costPerPiece), 3],
    [X.rows.age, form.ages.join(", ") || X.none, 4],
    [X.rows.gender, form.gender ? Q.genders[form.gender] : X.none, 4],
    [X.rows.goal, form.goal ? Q.goals[form.goal] : X.none, 5],
    ...(market.length
      ? ([[t.market.type, form.market.type ? [market.find((o) => o.type === form.market.type)?.label, ...MARKET_ATTRS.map((k) => form.market[k])].filter(Boolean).join(" · ") : t.market.none, 6]] as [string, string, number][])
      : []),
  ];

  async function submit() {
    setShowErrors(true);
    if (!parsed.success) return;
    try {
      localStorage.setItem(ANSWERS_KEY, JSON.stringify(form));
    } catch {
      // Not remembered.
    }
    setState("working");
    setServerError(null);
    setStartedAt(Date.now());
    setNow(Date.now());
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...passcodeHeaders() },
        body: JSON.stringify(parsed.data),
      });
      const body = (await res.json().catch(() => null)) as { id?: string; error?: string; fields?: Record<string, string> } | null;
      if (!res.ok || !body?.id) {
        throw new Error(body?.fields ? Object.values(body.fields).join(" ") : (body?.error ?? t.common.serverAnswered(res.status)));
      }
      try {
        localStorage.setItem(RESEARCH_KEY, JSON.stringify(body.id));
      } catch {
        // The post maker just won't find it automatically.
      }
      router.push(`/research/${body.id}`);
    } catch (err) {
      setServerError((err as Error).message);
      setState("error");
    }
  }

  return (
    <main className="app-page">
      <PageHeader kicker={Q.kicker} title={Q.h1} help={<HelpTip topic="research" />} lead={Q.lead} />

      <div className="space-y-3 empty:hidden">
        {!setup.llm && (
          <p className="rounded-xl border border-marigold/60 bg-marigold-wash px-4 py-3 text-sm leading-relaxed">
            <strong>{Q.aiOffTitle}</strong> {Q.aiOffBody}
          </p>
        )}
        <PasscodeField required={setup.passcodeRequired} />
      </div>

      <div className="mt-8 grid items-start gap-5 xl:grid-cols-2">
        <Section n={1} title={Q.sections[0]}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label={Q.shopName} hint={t.common.optional} value={form.shopName} onChange={(v) => set("shopName", v)} placeholder={Q.shopPh} max={40} />
            <Text label={Q.product} value={form.product} onChange={(v) => set("product", v)} placeholder={Q.productPh} max={80} error={e("product")} />
          </div>
          <Choice label={Q.category} error={e("category")}>
            {Object.keys(CATEGORIES).map((k) => (
              <Pick key={k} on={form.category === k} onClick={() => set("category", k as Form["category"])}>
                {Q.categories[k]}
              </Pick>
            ))}
          </Choice>
        </Section>

        <Section n={2} title={Q.sections[1]}>
          <Text label={Q.city} value={form.city} onChange={(v) => set("city", v)} placeholder={Q.cityPh} max={60} error={e("city")} />
          <Choice label={Q.channels} hint={Q.pickAll} error={e("channels")}>
            {Object.keys(CHANNELS).map((k) => (
              <Pick key={k} on={form.channels.includes(k as keyof typeof CHANNELS)} onClick={() => set("channels", toggle(form.channels, k as keyof typeof CHANNELS))}>
                {Q.channelNames[k]}
              </Pick>
            ))}
          </Choice>
        </Section>

        <Section n={3} title={Q.sections[2]} help="researchPrices">
          <div className="grid grid-cols-3 gap-3">
            <Text label={Q.priceMin} value={form.priceMin} onChange={(v) => set("priceMin", digits(v))} placeholder="499" numeric error={e("priceMin")} />
            <Text label={Q.priceMax} value={form.priceMax} onChange={(v) => set("priceMax", digits(v))} placeholder="1299" numeric error={e("priceMax")} />
            <Text label={Q.cost} hint={t.common.optional} value={form.costPerPiece} onChange={(v) => set("costPerPiece", digits(v))} placeholder="400" numeric error={e("costPerPiece")} />
          </div>
          <p className="text-xs text-ink-3">{Q.costNote}</p>
        </Section>

        <Section n={4} title={Q.sections[3]}>
          <Choice label={Q.age} hint={Q.pickAll} error={e("ages")}>
            {AGES.map((a) => (
              <Pick key={a} on={form.ages.includes(a)} onClick={() => set("ages", toggle(form.ages, a))}>
                {a}
              </Pick>
            ))}
          </Choice>
          <Choice label={Q.mostly} error={e("gender")}>
            {(["women", "men", "all"] as const).map((g) => (
              <Pick key={g} on={form.gender === g} onClick={() => set("gender", g)}>
                {Q.genders[g]}
              </Pick>
            ))}
          </Choice>
        </Section>

        <Section n={5} title={Q.sections[4]}>
          <Choice label={Q.goal} error={e("goal")}>
            {Object.keys(GOALS).map((k) => (
              <Pick key={k} on={form.goal === k} onClick={() => set("goal", k as Form["goal"])}>
                {Q.goals[k]}
              </Pick>
            ))}
          </Choice>
        </Section>

        <Section n={6} title={t.market.formTitle}>
          {market.length === 0 ? (
            <p className="text-sm text-ink-3">{t.market.off}</p>
          ) : (
            <>
              <p className="text-sm text-ink-2">{t.market.formLead(market.reduce((n, o) => n + o.listings, 0).toLocaleString("en-IN"))}</p>
              <Choice label={t.market.type}>
                <Pick on={!form.market.type} onClick={() => set("market", { type: "" })}>
                  {t.market.none}
                </Pick>
                {market.map((o) => (
                  <Pick key={o.type} on={form.market.type === o.type} onClick={() => set("market", { type: o.type })}>
                    {o.label.replace(/ \(.*\)$/, "")}
                  </Pick>
                ))}
              </Choice>
              {form.market.type && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {MARKET_ATTRS.filter((k) => market.find((o) => o.type === form.market.type)?.values[k]?.length).map((k) => (
                    <MarketSelect
                      key={k}
                      label={t.market.attrs[k]}
                      any={t.market.any}
                      value={form.market[k] ?? ""}
                      options={market.find((o) => o.type === form.market.type)!.values[k]!}
                      onChange={(v) => set("market", { ...form.market, [k]: v || undefined })}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </Section>
      </div>

      {reviewing && parsed.success && (
        <section id="research-review" aria-labelledby="research-review-title" className="card rise mt-8 scroll-mt-24 overflow-hidden">
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <h2 id="research-review-title" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              {X.reviewTitle} <HelpTip topic="researchReview" />
            </h2>
            <p className="mt-0.5 text-sm text-ink-3">{X.reviewLead}</p>
          </div>
          <dl className="divide-y divide-line text-sm">
            {reviewRows.map(([label, value, section]) => (
              <div key={label} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 px-5 py-1.5 sm:grid-cols-[10rem_1fr_auto] sm:px-6">
                <dt className="text-ink-3">{label}</dt>
                <dd className="min-w-0 font-medium break-words">{value}</dd>
                <dd>
                  <button
                    type="button"
                    onClick={() => {
                      setReviewing(false);
                      requestAnimationFrame(() => document.getElementById(`research-${section}`)?.scrollIntoView({ behavior: "smooth" }));
                    }}
                    aria-label={`${X.edit}: ${label}`}
                    className="inline-flex min-h-11 items-center rounded-lg px-2 font-semibold text-accent-strong hover:bg-accent-wash"
                  >
                    {X.edit}
                  </button>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="sticky bottom-0 -mx-4 mt-8 border-t border-line bg-paper-glow/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:p-5 sm:shadow-[var(--shadow-card)]">
        {!reviewing ? (
          <button
            type="button"
            onClick={() => {
              setShowErrors(true);
              if (!parsed.success || missing > 0) return;
              setReviewing(true);
              setTimeout(() => document.getElementById("research-review")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
            }}
            className="btn-primary w-full !py-3.5 !text-base"
          >
            {X.reviewButton} <span aria-hidden>→</span>
          </button>
        ) : (
        <button type="button" onClick={submit} disabled={state === "working"} className="btn-primary w-full !py-3.5 !text-base">
          {state === "working" ? Q.researching(Math.round((now - startedAt) / 1000)) : Q.submit}
        </button>
        )}
        <p className="mt-2 text-center text-xs text-ink-3">
          {state === "working"
            ? setup.llm
              ? Q.aiWriting
              : Q.building
            : showErrors && missing > 0
              ? Q.missing(missing)
              : Q.nothingPosted}
        </p>
        {serverError && <p className="mt-2 text-center text-sm text-danger">{serverError}</p>}
      </div>
    </main>
  );
}

function Section({ n, title, help, children }: { n: number; title: string; help?: HelpTopic; children: React.ReactNode }) {
  return (
    <section id={`research-${n}`} className="card scroll-mt-24 space-y-5 p-5 sm:p-6">
      <h2 className="flex items-center gap-3 text-lg font-semibold tracking-tight">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-wash text-xs font-semibold text-accent-strong">{n}</span>
        {title}
        {help && <HelpTip topic={help} />}
      </h2>
      {children}
    </section>
  );
}

function Text({ label, hint, value, onChange, placeholder, max, numeric, error }: { label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string; max?: number; numeric?: boolean; error?: string }) {
  const errorId = useId();
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium">
        {label}
        {hint && <span className="text-2xs font-normal text-ink-3">{hint}</span>}
      </span>
      <input
        className="input"
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        placeholder={placeholder}
        maxLength={max}
        inputMode={numeric ? "numeric" : undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <span id={errorId} className="mt-1 block text-xs text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

function Choice({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">
        {label} {hint && <span className="text-2xs font-normal text-ink-3">{hint}</span>}
      </legend>
      <div className="flex flex-wrap gap-2">{children}</div>
      {error && (
        <span role="alert" className="mt-1.5 block text-xs text-danger">
          {error}
        </span>
      )}
    </fieldset>
  );
}

function Pick({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="option inline-flex min-h-11 items-center !rounded-full px-4 py-2 text-sm font-medium"
    >
      {children}
    </button>
  );
}

function MarketSelect({ label, any, value, options, onChange }: { label: string; any: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <select id={id} className="input min-h-11" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{any}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
