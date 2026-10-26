"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
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
};

const EMPTY: Form = { shopName: "", product: "", category: "", city: "", channels: ["instagram"], priceMin: "", priceMax: "", costPerPiece: "", ages: [], gender: "", goal: "" };

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const digits = (v: string) => v.replace(/[^\d]/g, "");

export function ResearchForm({ setup }: { setup: Setup }) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const Q = t.research;
  const [form, setForm] = useState<Form>(EMPTY);
  const [showErrors, setShowErrors] = useState(false);
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);

  // Pre-fill from the last time, if this browser has it.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ANSWERS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from browser storage
      if (saved) setForm({ ...EMPTY, ...(JSON.parse(saved) as Partial<Form>) });
    } catch {
      // Start empty.
    }
  }, []);

  useEffect(() => {
    if (state !== "working") return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [state]);

  const parsed = useMemo(() => answersSchema.safeParse({ ...form, costPerPiece: form.costPerPiece || undefined, language: locale }), [form, locale]);
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
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

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
    <main className="mx-auto max-w-3xl px-4 pt-8 pb-24 sm:px-6">
      <p className="kicker">{Q.kicker}</p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.05em] sm:text-5xl">{Q.h1}</h1>
      <p className="mt-3 text-lg text-ink-2">{Q.lead}</p>

      <div className="mt-5 space-y-3">
        {!setup.llm && (
          <p className="rounded-xl border border-marigold/50 bg-marigold-wash px-4 py-3 text-sm">
            <strong>{Q.aiOffTitle}</strong> {Q.aiOffBody}
          </p>
        )}
        <PasscodeField required={setup.passcodeRequired} />
      </div>

      <div className="mt-8 space-y-8">
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

        <Section n={3} title={Q.sections[2]}>
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
      </div>

      <div className="sticky bottom-0 -mx-4 mt-10 border-t border-line bg-paper/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <button type="button" onClick={submit} disabled={state === "working"} className="btn-primary w-full !py-3.5 !text-base">
          {state === "working" ? Q.researching(Math.round((now - startedAt) / 1000)) : Q.submit}
        </button>
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

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4 p-5 sm:p-6">
      <h2 className="flex items-center gap-3 text-xl font-bold tracking-tight">
        <span className="grid size-7 place-items-center rounded-full bg-ink font-mono text-xs text-paper">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Text({ label, hint, value, onChange, placeholder, max, numeric, error }: { label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string; max?: number; numeric?: boolean; error?: string }) {
  const errorId = useId();
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between text-sm font-semibold">
        {label}
        {hint && <span className="font-mono text-2xs font-normal text-ink-3">{hint}</span>}
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
      <legend className="mb-2 text-sm font-semibold">
        {label} {hint && <span className="font-mono text-2xs font-normal text-ink-3">{hint}</span>}
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
      className={`min-h-11 rounded-full border px-4 py-2 text-sm transition-colors ${on ? "border-ink bg-ink text-paper" : "border-line bg-paper-glow hover:border-ink"}`}
    >
      {children}
    </button>
  );
}
