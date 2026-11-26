"use client";

import Link from "next/link";
import { cloneElement, useEffect, useId, useMemo, useRef, useState } from "react";
import { HelpTip, type HelpTopic } from "@/components/shared/HelpTip";
import { PasscodeField } from "@/components/shared/Passcode";
import { resultUrl } from "@/lib/client/check";
import { passcodeHeaders } from "@/lib/client/passcode";
import { radioKeyDown, rovingTabIndex } from "@/lib/client/roving";
import { canShareFiles, shareImage } from "@/lib/client/share";
import { TEST_ENGINES } from "@/lib/engines";
import { useI18n } from "@/lib/i18n/client";
import { loadFonts, renderPost, type Draft, type Look } from "@/lib/posts/render";
import { CTAS, FORMATS, LANGUAGES, PALETTES, TEMPLATES, TONES, discountPct, inr, postSchema, type Cta, type PostFormat } from "@/lib/posts/spec";
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
  const { t: msg, locale } = useI18n();
  const T = msg.post;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [imgError, setImgError] = useState(false);
  const [fields, setFields] = useState<Fields>({ shopName: "", handle: "", product: "", price: "", mrp: "", offer: "", cta: "dm" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [look, setLook] = useState<Look>({ format: "post", template: "panel", palette: "paper" });
  const [tone, setTone] = useState<keyof typeof TONES>("friendly");
  const [language, setLanguage] = useState<keyof typeof LANGUAGES>(locale === "hi" ? "hinglish" : "english");
  const [research, setResearch] = useState<Report | null>(null);
  const [caption, setCaption] = useState<{ text: string; via: string } | null>(null);
  const [captionState, setCaptionState] = useState<"idle" | "working" | "error">("idle");
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [shareable, setShareable] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection needs the browser
  useEffect(() => setShareable(canShareFiles()), []);

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
    if (!parsed.success) for (const i of parsed.error.issues) out[String(i.path[0])] ??= T.errors[String(i.path[0])] ?? i.message;
    return out;
  }, [parsed, T]);

  const draft: Draft = useMemo(() => {
    const n = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : null);
    return {
      shopName: fields.shopName.trim(),
      handle: fields.handle.trim().replace(/^@+/, "").replace(/[^A-Za-z0-9._]/g, ""),
      product: fields.product,
      price: n(fields.price),
      mrp: n(fields.mrp),
      offer: fields.offer.trim(),
      cta: T.ctas[fields.cta],
      words: T.canvas,
    };
  }, [fields, T]);

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
  const blur = (k: keyof Fields) => () => setTouched((was) => ({ ...was, [k]: true }));
  const err = (k: keyof Fields) => (touched[k] ? errors[k] : undefined);

  const downloadReason = !img ? T.loadingPhoto : !parsed.success ? Object.values(errors)[0] : null;
  const badgeHint = look.template === "badge" && !draft.mrp && !draft.offer ? T.badgeHint : null;

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

  /** Phone share sheet with the post and, if written, its caption — the shortest path to posting. */
  async function share() {
    if (!canvas.current || !img || downloadReason) return;
    setShareNote(null);
    renderPost(canvas.current, img, draft, look);
    const blob = await new Promise<Blob | null>((resolve) => canvas.current!.toBlob(resolve, "image/png"));
    if (!blob) return setShareNote(T.shareImgFailed);
    if (caption) await navigator.clipboard?.writeText(caption.text).catch(() => {});
    const outcome = await shareImage(blob, `haat-post-${result.key.slice(0, 8)}-${look.format}.png`, caption?.text);
    if (outcome === "shared" && caption) setShareNote(T.shared);
    if (outcome === "failed") setShareNote(T.shareFailed);
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
      if (!res.ok || !body?.caption) throw new Error(body?.error ?? msg.common.serverAnswered(res.status));
      setCaption({ text: `${body.caption}\n\n${(body.hashtags ?? []).join(" ")}`, via: body.via ?? "template" });
      setCaptionState("idle");
    } catch (e) {
      setCaptionError((e as Error).message);
      setCaptionState("error");
    }
  }

  const fmt = FORMATS[look.format];
  const X = msg.postX;
  const off = draft.price && draft.mrp && draft.mrp > draft.price ? discountPct({ price: draft.price, mrp: draft.mrp }) : null;
  const reviewRows: [string, string, boolean][] = [
    [X.rows.product, fields.product.trim() || X.none, Boolean(errors.product)],
    [X.rows.price, draft.price !== null ? inr(draft.price) : X.none, Boolean(errors.price)],
    [X.rows.mrp, draft.mrp !== null ? `${inr(draft.mrp)}${off !== null ? ` · ${X.off(off)}` : ""}` : X.none, Boolean(errors.mrp)],
    [X.rows.offer, draft.offer || X.none, Boolean(errors.offer)],
    [X.rows.shop, draft.shopName || X.none, Boolean(errors.shopName)],
    [X.rows.handle, draft.handle ? `@${draft.handle}` : X.none, Boolean(errors.handle)],
    [X.rows.cta, T.ctas[fields.cta], false],
    [X.rows.template, T.templates[look.template].label, false],
    [X.rows.colours, T.palettes[look.palette], false],
    [X.rows.size, `${msg.result.sizes[look.format]} · ${fmt.width}×${fmt.height}`, false],
    [X.rows.caption, caption ? X.captionReady(caption.text.length) : X.captionNone, false],
  ];

  return (
    <main className="app-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/studio?r=${result.key}`} className="inline-flex min-h-11 items-center rounded-lg text-sm font-medium text-ink-2 hover:text-ink">
          {T.back}
        </Link>
        <span className="kicker">{T.kicker}</span>
      </div>
      <h1 className="mt-2 h-page sm:text-4xl">{T.h1}</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        {T.lead}
      </p>
      {TEST_ENGINES.has(result.engine) && (
        <p className="mt-4 rounded-xl border border-marigold/60 bg-marigold-wash px-4 py-3 text-sm">{T.testNote}</p>
      )}
      <div className="mt-4">
        <PasscodeField required={setup.passcodeRequired} />
      </div>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="lg:sticky lg:top-24">
          <div className="dot-grid grid place-items-center rounded-3xl border border-line bg-paper-2 p-4 sm:p-8">
            {imgError ? (
              <p className="p-10 text-center text-sm text-danger">{T.imgError}</p>
            ) : (
              <canvas
                ref={canvas}
                width={fmt.width}
                height={fmt.height}
                aria-label={T.preview}
                className={`h-auto w-auto max-w-full rounded-lg shadow-[var(--shadow-float)] ${img ? "" : "skeleton"}`}
                style={{ maxHeight: "70vh", aspectRatio: `${fmt.width} / ${fmt.height}` }}
              />
            )}
          </div>
          <p id="post-size" className="mt-4 flex items-center gap-2 text-sm font-medium">
            {T.sizeLabel} <HelpTip topic="postSize" />
          </p>
          <div role="radiogroup" aria-labelledby="post-size" className="mt-2 grid grid-cols-3 gap-2">
            {(Object.keys(FORMATS) as PostFormat[]).map((f, i) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={look.format === f}
                tabIndex={rovingTabIndex(look.format === f, i, true)}
                onKeyDown={radioKeyDown}
                onClick={() => setLook((l) => ({ ...l, format: f }))}
                className="option min-h-11 px-3 py-2 text-sm"
              >
                <span className="font-semibold">{msg.result.sizes[f]}</span> <span className="text-2xs text-ink-3 tabular-nums">{FORMATS[f].ratio}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="card space-y-4 p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
              {T.whatsOn} <HelpTip topic="postFields" />
            </h2>
            <Field label={T.product} required error={err("product")}>
              <input value={fields.product} onChange={(e) => set("product")(e.target.value)} onBlur={blur("product")} maxLength={40} placeholder={T.productPh} className="input" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={T.price} required error={err("price")}>
                <input value={fields.price} onChange={(e) => set("price")(e.target.value.replace(/[^\d]/g, ""))} onBlur={blur("price")} inputMode="numeric" placeholder="1299" className="input" />
              </Field>
              <Field label={T.mrp} hint={msg.common.optional} error={err("mrp")}>
                <input value={fields.mrp} onChange={(e) => set("mrp")(e.target.value.replace(/[^\d]/g, ""))} onBlur={blur("mrp")} inputMode="numeric" placeholder="1599" className="input" />
              </Field>
            </div>
            <Field label={T.offer} hint={msg.common.optional} error={err("offer")}>
              <input value={fields.offer} onChange={(e) => set("offer")(e.target.value)} onBlur={blur("offer")} maxLength={22} placeholder={T.offerPh} className="input" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={T.shopName} help="postShop" hint={msg.common.remembered} error={err("shopName")}>
                <input value={fields.shopName} onChange={(e) => set("shopName")(e.target.value)} onBlur={blur("shopName")} maxLength={30} placeholder="Kadam Studio" className="input" />
              </Field>
              <Field label={T.handle} hint={msg.common.remembered} error={err("handle")}>
                <input value={fields.handle} onChange={(e) => set("handle")(e.target.value)} onBlur={blur("handle")} maxLength={31} placeholder="@kadam.studio" className="input" />
              </Field>
            </div>
            <Field label={T.howOrder} help="postCta">
              <select value={fields.cta} onChange={(e) => set("cta")(e.target.value)} className="input">
                {(Object.keys(CTAS) as Cta[]).map((c) => (
                  <option key={c} value={c}>
                    {T.ctas[c]}
                  </option>
                ))}
              </select>
            </Field>
          </section>

          <section className="card space-y-4 p-5 sm:p-6">
            <h2 className="text-base font-semibold tracking-tight">{T.look}</h2>
            <p id="post-template" className="flex items-center gap-2 text-sm font-medium">
              {T.templateLabel} <HelpTip topic="template" />
            </p>
            <div role="radiogroup" aria-labelledby="post-template" className="grid grid-cols-3 gap-2">
              {(Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]).map((t, i) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={look.template === t}
                  tabIndex={rovingTabIndex(look.template === t, i, true)}
                  onKeyDown={radioKeyDown}
                  onClick={() => setLook((l) => ({ ...l, template: t }))}
                  className="option min-h-11 px-3 py-2.5 text-left"
                >
                  <span className="block text-sm font-semibold">{T.templates[t].label}</span>
                  <span className="mt-0.5 block text-2xs leading-tight text-ink-3">{T.templates[t].hint}</span>
                </button>
              ))}
            </div>
            {badgeHint && <p className="text-xs text-ink-2">{badgeHint}</p>}
            <p id="post-colours" className="flex items-center gap-2 text-sm font-medium">
              {T.coloursLabel} <HelpTip topic="palette" />
            </p>
            <div role="radiogroup" aria-labelledby="post-colours" className="flex flex-wrap gap-2">
              {(Object.keys(PALETTES) as (keyof typeof PALETTES)[]).map((p, i) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={look.palette === p}
                  tabIndex={rovingTabIndex(look.palette === p, i, true)}
                  onKeyDown={radioKeyDown}
                  onClick={() => setLook((l) => ({ ...l, palette: p }))}
                  className="option flex min-h-11 items-center gap-2 !rounded-full px-3.5 py-1.5 text-sm font-medium"
                >
                  <span className="flex">
                    <span className="size-4 rounded-full border border-black/10" style={{ background: PALETTES[p].bg }} />
                    <span className="-ml-1.5 size-4 rounded-full border border-black/10" style={{ background: PALETTES[p].accent }} />
                  </span>
                  {T.palettes[p]}
                </button>
              ))}
            </div>
          </section>

          <section className="card space-y-4 p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                {T.captionTitle} <HelpTip topic="caption" />
              </h2>
              <span className={`chip ${setup.llm ? "!border-good/30 !bg-good-wash !text-good" : ""}`}>{setup.llm ? T.aiOn : T.aiOff}</span>
            </div>
            <p className="text-xs leading-relaxed text-ink-3">
              {research ? (
                <>
                  {T.usingResearch} <strong className="text-ink-2">{research.answers.product}</strong> ({research.answers.city}).{" "}
                  <Link className="underline" href={`/research/${research.id}`}>
                    {T.view}
                  </Link>
                </>
              ) : (
                <>
                  {T.noResearch}{" "}
                  <Link className="underline" href="/research">
                    {T.runIt}
                  </Link>{" "}
                  {T.noResearchEnd}
                </>
              )}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label={T.tone} help="tone">
                <select value={tone} onChange={(e) => setTone(e.target.value as keyof typeof TONES)} className="input">
                  {(Object.keys(TONES) as (keyof typeof TONES)[]).map((k) => (
                    <option key={k} value={k}>
                      {T.tones[k]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={T.language}>
                <select value={language} onChange={(e) => setLanguage(e.target.value as keyof typeof LANGUAGES)} className="input">
                  {(Object.keys(LANGUAGES) as (keyof typeof LANGUAGES)[]).map((k) => (
                    <option key={k} value={k}>
                      {T.languages[k]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <button type="button" onClick={writeCaption} disabled={captionState === "working"} className="btn-ghost w-full">
              {captionState === "working" ? T.writing : caption ? T.writeAnother : T.write}
            </button>
            {captionError && <p className="text-sm text-danger">{captionError}</p>}
            {caption && (
              <>
                <textarea
                  value={caption.text}
                  onChange={(e) => setCaption({ ...caption, text: e.target.value })}
                  rows={8}
                  className="input font-[inherit] text-sm leading-relaxed"
                  aria-label={T.captionAria}
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xs text-ink-3">
                    {caption.via === "template" ? T.viaTemplate : T.viaAi(caption.via)}
                  </span>
                  <button
                    type="button"
                    className="btn-primary !px-4"
                    onClick={async () => {
                      await navigator.clipboard?.writeText(caption.text).catch(() => {});
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? msg.common.copied : msg.common.copy}
                  </button>
                </div>
              </>
            )}
          </section>

          {/* Review: everything that will be on the post, then download or share. */}
          <section aria-labelledby="post-review" className="card overflow-hidden">
            <div className="border-b border-line px-5 py-4 sm:px-6">
              <h2 id="post-review" className="flex items-center gap-2 text-base font-semibold tracking-tight">
                {X.reviewTitle} <HelpTip topic="postReview" />
              </h2>
              <p className="mt-0.5 text-xs text-ink-3">{X.reviewLead}</p>
            </div>
            <dl className="divide-y divide-line text-sm">
              {reviewRows.map(([k, v, bad]) => (
                <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-3 px-5 py-2.5 sm:px-6">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className={`min-w-0 font-medium break-words ${bad ? "text-danger" : ""}`}>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="space-y-3 border-t border-line bg-paper-2/60 p-5 sm:p-6">
              <button type="button" onClick={download} disabled={Boolean(downloadReason) || downloading} className="btn-primary w-full !py-3 !text-base">
                {downloading ? T.preparing : T.download(msg.result.sizes[look.format], fmt.width, fmt.height)}
              </button>
              {shareable && (
                <button type="button" onClick={share} disabled={Boolean(downloadReason)} className="btn-ghost w-full !py-3 !text-base">
                  {T.share}
                </button>
              )}
              {downloadReason && <p className="text-center text-xs text-ink-3">{downloadReason}</p>}
              {shareNote && <p className="text-center text-xs text-ink-2">{shareNote}</p>}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  hint,
  help,
  required,
  error,
  children,
}: {
  label: string;
  hint?: string;
  help?: HelpTopic;
  required?: boolean;
  error?: string;
  children: React.ReactElement<Record<string, unknown>>;
}) {
  const errorId = useId();
  const inputId = useId();
  // A <div>, not a wrapping <label>: the help button must not become the label's control.
  return (
    <div>
      <div className="mb-1.5 flex min-h-5 items-center justify-between gap-2 text-sm font-medium">
        <span className="inline-flex items-center gap-2">
          <label htmlFor={inputId}>
            {label}
            {required && (
              <span className="text-accent-strong" aria-hidden>
                {" "}
                *
              </span>
            )}
          </label>
          {help && <HelpTip topic={help} />}
        </span>
        {hint && <span className="text-2xs font-normal text-ink-3">{hint}</span>}
      </div>
      {cloneElement(children, { id: inputId, "aria-invalid": Boolean(error), "aria-describedby": error ? errorId : undefined, "aria-required": required || undefined })}
      {error && (
        <span id={errorId} className="mt-1 block text-xs text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
