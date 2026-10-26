"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PasscodeField } from "@/components/shared/Passcode";
import { passcodeHeaders } from "@/lib/client/passcode";
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
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [state]);

  const parsed = useMemo(() => answersSchema.safeParse({ ...form, costPerPiece: form.costPerPiece || undefined }), [form]);
  const errors = useMemo(() => {
    const out: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) out[String(i.path[0])] ??= i.message;
    if (!form.category) out.category = "Pick the closest category";
    if (!form.gender) out.gender = "Who mostly buys?";
    if (!form.goal) out.goal = "Pick your main goal";
    return out;
  }, [parsed, form]);
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
        throw new Error(body?.fields ? Object.values(body.fields).join(" ") : (body?.error ?? `The server answered ${res.status}.`));
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
      <p className="kicker">Phase 5 · Market research</p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.05em] sm:text-5xl">Tell us about your shop.</h1>
      <p className="mt-3 text-lg text-ink-2">Ten quick answers. You get who your buyers are, what to post this week, prices to check and the selling days coming up.</p>

      <div className="mt-5 space-y-3">
        {!setup.llm && (
          <p className="rounded-xl border border-marigold/50 bg-[oklch(93%_0.06_80)] px-4 py-3 text-sm">
            <strong>AI research is off on this server.</strong> You&rsquo;ll get a starter plan built only from your answers, clearly labelled. To switch on
            tailored research (free, no card): add <code className="font-mono">GROQ_API_KEY</code> to <code className="font-mono">.env</code>.
          </p>
        )}
        <PasscodeField required={setup.passcodeRequired} />
      </div>

      <div className="mt-8 space-y-8">
        <Section n={1} title="Your shop">
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label="Shop name" hint="optional" value={form.shopName} onChange={(v) => set("shopName", v)} placeholder="Kadam Studio" max={40} />
            <Text label="What do you sell?" value={form.product} onChange={(v) => set("product", v)} placeholder="Cotton kurtis" max={80} error={e("product")} />
          </div>
          <Choice label="Closest category" error={e("category")}>
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <Pick key={k} on={form.category === k} onClick={() => set("category", k as Form["category"])}>
                {v}
              </Pick>
            ))}
          </Choice>
        </Section>

        <Section n={2} title="Where you sell">
          <Text label="City or region" value={form.city} onChange={(v) => set("city", v)} placeholder="Jaipur" max={60} error={e("city")} />
          <Choice label="Where do people buy from you?" hint="pick all that apply" error={e("channels")}>
            {Object.entries(CHANNELS).map(([k, v]) => (
              <Pick key={k} on={form.channels.includes(k as keyof typeof CHANNELS)} onClick={() => set("channels", toggle(form.channels, k as keyof typeof CHANNELS))}>
                {v}
              </Pick>
            ))}
          </Choice>
        </Section>

        <Section n={3} title="Your prices">
          <div className="grid grid-cols-3 gap-3">
            <Text label="Lowest price ₹" value={form.priceMin} onChange={(v) => set("priceMin", digits(v))} placeholder="499" numeric error={e("priceMin")} />
            <Text label="Highest price ₹" value={form.priceMax} onChange={(v) => set("priceMax", digits(v))} placeholder="1299" numeric error={e("priceMax")} />
            <Text label="Your cost per piece ₹" hint="optional" value={form.costPerPiece} onChange={(v) => set("costPerPiece", digits(v))} placeholder="400" numeric error={e("costPerPiece")} />
          </div>
          <p className="text-xs text-ink-3">Cost per piece lets us work out your profit and margin. It stays on this server.</p>
        </Section>

        <Section n={4} title="Who buys">
          <Choice label="Age" hint="pick all that apply" error={e("ages")}>
            {AGES.map((a) => (
              <Pick key={a} on={form.ages.includes(a)} onClick={() => set("ages", toggle(form.ages, a))}>
                {a}
              </Pick>
            ))}
          </Choice>
          <Choice label="Mostly" error={e("gender")}>
            {(["women", "men", "all"] as const).map((g) => (
              <Pick key={g} on={form.gender === g} onClick={() => set("gender", g)}>
                {{ women: "Women", men: "Men", all: "Everyone" }[g]}
              </Pick>
            ))}
          </Choice>
        </Section>

        <Section n={5} title="Your main goal right now">
          <Choice label="Goal" error={e("goal")}>
            {Object.entries(GOALS).map(([k, v]) => (
              <Pick key={k} on={form.goal === k} onClick={() => set("goal", k as Form["goal"])}>
                {v}
              </Pick>
            ))}
          </Choice>
        </Section>
      </div>

      <div className="sticky bottom-0 -mx-4 mt-10 border-t border-line bg-paper/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <button type="button" onClick={submit} disabled={state === "working"} className="btn-primary w-full !py-3.5 !text-base">
          {state === "working" ? `Researching… ${Math.round((now - startedAt) / 1000)}s` : "Get my research →"}
        </button>
        <p className="mt-2 text-center text-xs text-ink-3">
          {state === "working"
            ? setup.llm
              ? "The AI is writing your report — usually 10–40 seconds."
              : "Building your starter plan…"
            : showErrors && missing > 0
              ? `${missing} answer${missing > 1 ? "s" : ""} still need${missing > 1 ? "" : "s"} attention above.`
              : "Nothing is posted anywhere. The report is saved on this server so you can come back to it."}
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
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between text-sm font-semibold">
        {label}
        {hint && <span className="font-mono text-[10px] font-normal text-ink-3">{hint}</span>}
      </span>
      <input className="input" value={value} onChange={(ev) => onChange(ev.target.value)} placeholder={placeholder} maxLength={max} inputMode={numeric ? "numeric" : undefined} />
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

function Choice({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">
        {label} {hint && <span className="font-mono text-[10px] font-normal text-ink-3">{hint}</span>}
      </legend>
      <div className="flex flex-wrap gap-2">{children}</div>
      {error && <span className="mt-1.5 block text-xs text-danger">{error}</span>}
    </fieldset>
  );
}

function Pick({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${on ? "border-ink bg-ink text-paper" : "border-line bg-paper-glow hover:border-ink"}`}
    >
      {children}
    </button>
  );
}
