"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PasscodeField } from "@/components/shared/Passcode";
import { resultUrl } from "@/lib/client/check";
import { passcodeHeaders } from "@/lib/client/passcode";
import { TEST_ENGINES } from "@/lib/engines";
import { loadFonts, renderPost, type Draft, type Look } from "@/lib/posts/render";
import { CTAS, FORMATS, LANGUAGES, PALETTES, TEMPLATES, TONES, postSchema, type Cta, type PostFormat } from "@/lib/posts/spec";
import type { Report } from "@/lib/research/schema";
import type { Setup } from "@/lib/site";
import type { ResultMeta } from "@/lib/tryon/types";

const BRAND_KEY = "haat.brand";
const RESEARCH_KEY = "haat.research";

const store = {
  get<T>(key: string): T | null {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Not remembered; the form still works.
    }
  },
};

type Fields = { shopName: string; handle: string; product: string; price: string; mrp: string; offer: string; cta: Cta };

export function PostMaker({ result, setup }: { result: ResultMeta; setup: Setup }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [imgError, setImgError] = useState(false);
  const [fields, setFields] = useState<Fields>({ shopName: "", handle: "", product: "", price: "", mrp: "", offer: "", cta: "dm" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [look, setLook] = useState<Look>({ format: "post", template: "panel", palette: "paper" });
  const [tone, setTone] = useState<keyof typeof TONES>("friendly");
  const [language, setLanguage] = useState<keyof typeof LANGUAGES>("english");
  const [research, setResearch] = useState<Report | null>(null);
  const [caption, setCaption] = useState<{ text: string; via: string } | null>(null);
  const [captionState, setCaptionState] = useState<"idle" | "working" | "error">("idle");
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Remembered shop details and the latest research, from this browser.
  const hydrated = useRef(false);
  useEffect(() => {
    hydrated.current = true;
    const brand = store.get<Partial<Fields>>(BRAND_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from browser storage
    if (brand) setFields((f) => ({ ...f, shopName: brand.shopName ?? "", handle: brand.handle ?? "", cta: brand.cta ?? f.cta }));
    const id = store.get<string>(RESEARCH_KEY);
    if (id) {
      fetch(`/api/research/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((rep: Report | null) => {
          setResearch(rep);
          if (rep?.answers.shopName) setFields((f) => (f.shopName ? f : { ...f, shopName: rep.answers.shopName }));
        })
        .catch(() => {});
    }
  }, []);

  // Only after the stored values were read: saving on the first render would
  // overwrite them with the empty initial form.
  const [brandLoaded, setBrandLoaded] = useState(false);
  useEffect(() => {
    if (!hydrated.current) return;
    if (!brandLoaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- skip the first pass, which still holds the empty form
      setBrandLoaded(true);
      return;
    }
    store.set(BRAND_KEY, { shopName: fields.shopName, handle: fields.handle, cta: fields.cta });
  }, [fields.shopName, fields.handle, fields.cta, brandLoaded]);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = async () => {
      await loadFonts();
      if (!cancelled) setImg(image);
    };
    image.onerror = () => !cancelled && setImgError(true);
    image.src = resultUrl(result.key, "result.png");
    return () => {
      cancelled = true;
    };
  }, [result.key]);

  const parsed = useMemo(
    () => postSchema.safeParse({ ...fields, mrp: fields.mrp || undefined }),
    [fields],
  );
  const errors = useMemo(() => {
    const out: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) out[String(i.path[0])] ??= i.message;
    return out;
  }, [parsed]);

  const draft: Draft = useMemo(() => {
    const n = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : null);
    return {
      shopName: fields.shopName.trim(),
      handle: fields.handle.trim().replace(/^@+/, "").replace(/[^A-Za-z0-9._]/g, ""),
      product: fields.product,
      price: n(fields.price),
      mrp: n(fields.mrp),
      offer: fields.offer.trim(),
      cta: fields.cta,
    };
  }, [fields]);

  useEffect(() => {
    if (!img || !canvas.current) return;
    // A short timer rather than requestAnimationFrame: it coalesces fast
    // typing the same way, but keeps running where frames are paused
    // (background tabs, embedded previews), so the canvas is never left blank.
    const timer = setTimeout(() => canvas.current && renderPost(canvas.current, img, draft, look), 40);
    return () => clearTimeout(timer);
  }, [img, draft, look]);

  const set = (k: keyof Fields) => (v: string) => {
    setFields((f) => ({ ...f, [k]: v }));
    setCaption(null);
  };
  const blur = (k: keyof Fields) => () => setTouched((t) => ({ ...t, [k]: true }));
  const err = (k: keyof Fields) => (touched[k] ? errors[k] : undefined);

  const downloadReason = !img ? "Loading the photo…" : !parsed.success ? Object.values(errors)[0] : null;
  const badgeHint = look.template === "badge" && !draft.mrp && !draft.offer ? "Add an MRP or an offer line — the badge shows the discount, or your offer words." : null;

  async function download() {
    if (!canvas.current || !img || downloadReason) return;
    setDownloading(true);
    // Redraw now rather than trust the last animation frame: browsers pause
    // those in background tabs, and the file must match the current fields.
    renderPost(canvas.current, img, draft, look);
    canvas.current.toBlob((blob) => {
      setDownloading(false);
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `haat-post-${result.key.slice(0, 8)}-${look.format}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, "image/png");
  }

  async function writeCaption() {
    if (!parsed.success) {
      setTouched({ product: true, price: true, mrp: true, handle: true, offer: true, shopName: true });
      return;
    }
    setCaptionState("working");
    setCaptionError(null);
    try {
      const res = await fetch("/api/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...passcodeHeaders() },
        body: JSON.stringify({ post: parsed.data, category: result.settings.category, tone, language, researchId: research?.id }),
      });
      const body = (await res.json().catch(() => null)) as { caption?: string; hashtags?: string[]; via?: string; error?: string } | null;
      if (!res.ok || !body?.caption) throw new Error(body?.error ?? `The server answered ${res.status}.`);
      setCaption({ text: `${body.caption}\n\n${(body.hashtags ?? []).join(" ")}`, via: body.via ?? "template" });
      setCaptionState("idle");
    } catch (e) {
      setCaptionError((e as Error).message);
      setCaptionState("error");
    }
  }

  const fmt = FORMATS[look.format];

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-20 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/studio?r=${result.key}`} className="text-sm text-ink-2 hover:text-ink">
          ← Back to the photo
        </Link>
        <span className="kicker">Phase 4 · Post maker</span>
      </div>
      <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">Turn it into a post.</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        Your shop name, price and offer are set as real text — always spelled right. Nothing is drawn over the garment.
      </p>
      {TEST_ENGINES.has(result.engine) && (
        <p className="mt-3 rounded-xl border border-marigold/50 bg-[oklch(93%_0.06_80)] px-4 py-2 text-sm">This photo came from the echo test engine, not a real try-on.</p>
      )}
      <div className="mt-4">
        <PasscodeField required={setup.passcodeRequired} />
      </div>

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="lg:sticky lg:top-6">
          <div className="grid place-items-center rounded-3xl border border-line bg-paper-2 p-3 sm:p-5">
            {imgError ? (
              <p className="p-10 text-center text-sm text-danger">This photo couldn&rsquo;t be loaded. Go back and open it from your recent photos.</p>
            ) : (
              <canvas
                ref={canvas}
                width={fmt.width}
                height={fmt.height}
                aria-label="Post preview"
                className={`h-auto w-auto max-w-full rounded-lg shadow-xl ${img ? "" : "skeleton"}`}
                style={{ maxHeight: "74vh", aspectRatio: `${fmt.width} / ${fmt.height}` }}
              />
            )}
          </div>
          <div role="radiogroup" aria-label="Size" className="mt-3 grid grid-cols-3 gap-2">
            {(Object.keys(FORMATS) as PostFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={look.format === f}
                onClick={() => setLook((l) => ({ ...l, format: f }))}
                className={`rounded-xl border px-3 py-2 text-sm ${look.format === f ? "border-ink bg-ink text-paper" : "border-line bg-paper-glow hover:border-ink"}`}
              >
                <span className="font-semibold">{FORMATS[f].label}</span> <span className="font-mono text-[11px] opacity-70">{FORMATS[f].ratio}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="card space-y-3 p-5">
            <h2 className="text-lg font-bold tracking-tight">What&rsquo;s on the post</h2>
            <Field label="Product name" required error={err("product")}>
              <input value={fields.product} onChange={(e) => set("product")(e.target.value)} onBlur={blur("product")} maxLength={40} placeholder="Cotton A-line kurti" className="input" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price (₹)" required error={err("price")}>
                <input value={fields.price} onChange={(e) => set("price")(e.target.value.replace(/[^\d]/g, ""))} onBlur={blur("price")} inputMode="numeric" placeholder="1299" className="input" />
              </Field>
              <Field label="MRP (₹)" hint="optional" error={err("mrp")}>
                <input value={fields.mrp} onChange={(e) => set("mrp")(e.target.value.replace(/[^\d]/g, ""))} onBlur={blur("mrp")} inputMode="numeric" placeholder="1599" className="input" />
              </Field>
            </div>
            <Field label="Offer line" hint="optional" error={err("offer")}>
              <input value={fields.offer} onChange={(e) => set("offer")(e.target.value)} onBlur={blur("offer")} maxLength={22} placeholder="Diwali sale" className="input" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Shop name" hint="remembered" error={err("shopName")}>
                <input value={fields.shopName} onChange={(e) => set("shopName")(e.target.value)} onBlur={blur("shopName")} maxLength={30} placeholder="Kadam Studio" className="input" />
              </Field>
              <Field label="Instagram handle" hint="remembered" error={err("handle")}>
                <input value={fields.handle} onChange={(e) => set("handle")(e.target.value)} onBlur={blur("handle")} maxLength={31} placeholder="@kadam.studio" className="input" />
              </Field>
            </div>
            <Field label="How do people order?">
              <select value={fields.cta} onChange={(e) => set("cta")(e.target.value)} className="input">
                {(Object.keys(CTAS) as Cta[]).map((c) => (
                  <option key={c} value={c}>
                    {CTAS[c]}
                  </option>
                ))}
              </select>
            </Field>
          </section>

          <section className="card space-y-3 p-5">
            <h2 className="text-lg font-bold tracking-tight">Look</h2>
            <div role="radiogroup" aria-label="Template" className="grid grid-cols-3 gap-2">
              {(Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={look.template === t}
                  onClick={() => setLook((l) => ({ ...l, template: t }))}
                  className={`rounded-xl border px-2 py-2 text-left ${look.template === t ? "border-ink bg-ink text-paper" : "border-line bg-paper-glow hover:border-ink"}`}
                >
                  <span className="block text-sm font-semibold">{TEMPLATES[t].label}</span>
                  <span className="block text-[11px] leading-tight opacity-70">{TEMPLATES[t].hint}</span>
                </button>
              ))}
            </div>
            {badgeHint && <p className="text-xs text-ink-2">{badgeHint}</p>}
            <div role="radiogroup" aria-label="Colours" className="flex flex-wrap gap-2">
              {(Object.keys(PALETTES) as (keyof typeof PALETTES)[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={look.palette === p}
                  onClick={() => setLook((l) => ({ ...l, palette: p }))}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${look.palette === p ? "border-ink ring-2 ring-ink" : "border-line hover:border-ink"}`}
                >
                  <span className="flex">
                    <span className="size-4 rounded-full border border-black/10" style={{ background: PALETTES[p].bg }} />
                    <span className="-ml-1.5 size-4 rounded-full border border-black/10" style={{ background: PALETTES[p].accent }} />
                  </span>
                  {PALETTES[p].label}
                </button>
              ))}
            </div>
            <button type="button" onClick={download} disabled={Boolean(downloadReason) || downloading} className="btn-primary w-full !py-3 !text-base">
              {downloading ? "Preparing…" : `Download ${FORMATS[look.format].label.toLowerCase()} (${fmt.width}×${fmt.height})`}
            </button>
            {downloadReason && <p className="text-center text-xs text-ink-3">{downloadReason}</p>}
          </section>

          <section className="card space-y-3 p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight">Caption & hashtags</h2>
              <span className={`chip ${setup.llm ? "!border-good/40 !text-good" : ""}`}>{setup.llm ? "AI on" : "Template · AI off"}</span>
            </div>
            <p className="text-xs text-ink-3">
              {research ? (
                <>
                  Using your research for <strong className="text-ink-2">{research.answers.product}</strong> ({research.answers.city}).{" "}
                  <Link className="underline" href={`/research/${research.id}`}>
                    View
                  </Link>
                </>
              ) : (
                <>
                  No market research yet —{" "}
                  <Link className="underline" href="/research">
                    run it
                  </Link>{" "}
                  and captions will speak to your buyers.
                </>
              )}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tone">
                <select value={tone} onChange={(e) => setTone(e.target.value as keyof typeof TONES)} className="input">
                  {Object.entries(TONES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Language">
                <select value={language} onChange={(e) => setLanguage(e.target.value as keyof typeof LANGUAGES)} className="input">
                  {Object.entries(LANGUAGES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <button type="button" onClick={writeCaption} disabled={captionState === "working"} className="btn-ghost w-full">
              {captionState === "working" ? "Writing…" : caption ? "Write another" : "Write caption"}
            </button>
            {captionError && <p className="text-sm text-danger">{captionError}</p>}
            {caption && (
              <>
                <textarea
                  value={caption.text}
                  onChange={(e) => setCaption({ ...caption, text: e.target.value })}
                  rows={8}
                  className="input font-[inherit] text-sm leading-relaxed"
                  aria-label="Caption"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-ink-3">
                    {caption.via === "template" ? "Template caption — only your own words. Add a free AI key for tailored ones." : `Written by ${caption.via}. Read it before posting.`}
                  </span>
                  <button
                    type="button"
                    className="btn-primary !px-4 !py-1.5"
                    onClick={async () => {
                      await navigator.clipboard?.writeText(caption.text).catch(() => {});
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? "Copied ✓" : "Copy"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({ label, hint, required, error, children }: { label: string; hint?: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between text-sm font-semibold">
        <span>
          {label}
          {required && <span className="text-accent-strong"> *</span>}
        </span>
        {hint && <span className="font-mono text-[10px] font-normal text-ink-3">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}
