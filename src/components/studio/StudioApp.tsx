"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PasscodeField } from "@/components/shared/Passcode";
import { StudioHeader } from "@/components/site/site";
import { checkImageFile, fileFrom, resultUrl } from "@/lib/client/check";
import { passcodeHeaders } from "@/lib/client/passcode";
import { readEvents } from "@/lib/client/events";
import { useI18n } from "@/lib/i18n/client";
import type { Messages } from "@/lib/i18n/messages";
import { PRESETS, type SampleGarment } from "@/lib/presets";
import type { Setup } from "@/lib/site";
import type { ResultMeta, StreamEvent } from "@/lib/tryon/types";
import { formatWait } from "@/lib/wait";
import { Notice, RecentGrid, Stepper } from "./parts";
import { ResultStep } from "./ResultStep";
import { ModelStep, ProductStep } from "./Steps";
import type { ErrorKind, Inputs, LogEntry, PersonChoice, Picked, Run, SubmitInput, View } from "./types";

/** First generations use a fixed seed, so asking twice is a cache hit. Variations draw a new one. */
const FIRST_SEED = 42;
const randomSeed = () => Math.floor(Math.random() * 2_000_000_000);

const logOf = (r: Run): LogEntry[] => (r.phase === "idle" ? [] : r.log);
const startOf = (r: Run): number => (r.phase === "working" || r.phase === "error" ? r.startedAt : (logOf(r)[0]?.at ?? Date.now()));
const keyOf = (r: Run): string | null =>
  r.phase === "working" || r.phase === "error" ? r.key : r.phase === "done" ? r.result.key : null;
const setUrl = (key: string | null) => window.history.replaceState(null, "", key ? `/studio?r=${key}` : "/studio");
const release = (p: Picked | null | undefined) => p?.owned && URL.revokeObjectURL(p.url);

function errorKind(e: Extract<StreamEvent, { type: "error" }>): ErrorKind {
  const tried = e.attempts.filter((a) => a.kind !== "skipped");
  if (tried.some((a) => a.kind === "input")) return "input";
  if (tried.length > 0 && tried.every((a) => a.kind === "quota")) return "quota";
  return "other";
}

/** The server's sentence for a failed job, in the seller's language where we can say it ourselves. */
function errorMessage(e: Extract<StreamEvent, { type: "error" }>, kind: ErrorKind, t: Messages): string {
  if (kind === "quota") {
    const wait = Math.min(...e.attempts.map((a) => a.retryAfterSeconds ?? Infinity));
    return t.result.quota(Number.isFinite(wait) ? formatWait(wait) : null);
  }
  const tried = e.attempts.filter((a) => a.kind !== "skipped");
  if (tried.length > 0 && tried.every((a) => a.kind === "timeout")) return t.studio.queueLong;
  return e.message;
}

export function StudioApp({
  setup,
  initialRecent,
  initialFeatured,
  initialKey,
  badLink,
}: {
  setup: Setup;
  initialRecent: ResultMeta[];
  initialFeatured: string[];
  initialKey: string | null;
  badLink: boolean;
}) {
  const { t } = useI18n();
  const [inputs, setInputs] = useState<Inputs>(() => {
    const first = PRESETS.find((p) => setup.presets.includes(p.id));
    return { garment: null, category: null, photoType: "flat-lay", person: first ? { kind: "preset", id: first.id } : null, quality: "balanced" };
  });
  const [view, setView] = useState<View>(initialKey ? "result" : "product");
  // A link to a result starts in "working" with an empty log; the effect below re-attaches.
  const [run, setRun] = useState<Run>(
    initialKey
      ? { phase: "working", key: initialKey, startedAt: 0, log: [], settings: null, personPreview: null, garmentPreview: null }
      : { phase: "idle" },
  );
  const [recent, setRecent] = useState(initialRecent);
  const [featured, setFeatured] = useState(initialFeatured);
  const [quota, setQuota] = useState(setup.quota);
  // The header, model step and result all read the live quota, not the page-load one.
  const live: Setup = { ...setup, quota };
  const [productError, setProductError] = useState<string | null>(null);
  const [productNote, setProductNote] = useState<string | null>(badLink ? t.studio.badLink : null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const [lastRequest, setLastRequest] = useState<SubmitInput | null>(null);
  const attached = useRef(false);

  const working = run.phase === "working";

  // Each step starts at the top; otherwise "Continue" lands you mid-way down the next one.
  const firstView = useRef(true);
  useEffect(() => {
    if (firstView.current) return void (firstView.current = false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view]);

  // Revoke object URLs for photos the seller replaced or removed.
  useEffect(() => {
    const g = inputs.garment;
    return () => void release(g);
  }, [inputs.garment]);
  useEffect(() => {
    const p = inputs.person;
    return () => void (p?.kind === "upload" && release(p.picked));
  }, [inputs.person]);

  const refreshLists = useCallback(async () => {
    const get = (url: string) => fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const [r, f, q] = (await Promise.all([get("/api/results"), get("/api/featured"), get("/api/quota")])) as [ResultMeta[] | null, ResultMeta[] | null, Setup["quota"]];
    if (r) setRecent(r);
    if (f) setFeatured(f.map((m) => m.key));
    if (q) setQuota(q);
  }, []);

  /** Feeds a job's NDJSON stream into `run`. Ends in done, error, or — if the stream breaks — offline. */
  const consume = useCallback(
    async (res: Response) => {
      let terminal = false;
      try {
        await readEvents(res, (e) => {
          const entry: LogEntry = { at: e.at ?? Date.now(), e };
          if (e.type === "accepted") setUrl(e.key);
          if (e.type === "done") {
            terminal = true;
            setRun((r) => ({ phase: "done", result: e.result, cached: e.cached, log: [...logOf(r), entry] }));
            setUrl(e.result.key);
            void refreshLists();
          } else if (e.type === "error") {
            terminal = true;
            setUrl(null); // failures aren't saved, so the link would lead nowhere
            void refreshLists(); // a refusal tells us the real quota balance
            const kind = errorKind(e);
            setRun((r) => ({
              phase: "error",
              kind,
              message: errorMessage(e, kind, t),
              attempts: e.attempts,
              log: [...logOf(r), entry],
              startedAt: startOf(r),
              key: null,
            }));
          } else {
            setRun((r) => (r.phase === "working" ? { ...r, key: e.type === "accepted" ? e.key : r.key, log: [...r.log, entry] } : r));
          }
        });
      } catch {
        // The stream broke mid-way; handled below.
      }
      if (!terminal) {
        setRun((r) => {
          const key = keyOf(r);
          return {
            phase: "error",
            kind: "offline",
            message: key ? t.result.offlineMid : t.common.unreachable,
            attempts: [],
            log: logOf(r),
            startedAt: startOf(r),
            key,
          };
        });
      }
    },
    [refreshLists, t],
  );

  const reconnect = useCallback(
    async (key: string) => {
      setView("result");
      setRun({ phase: "working", key, startedAt: Date.now(), log: [], settings: null, personPreview: null, garmentPreview: null });
      let res: Response;
      try {
        res = await fetch(`/api/tryon/${key}`, { cache: "no-store" });
      } catch {
        setRun({ phase: "error", kind: "offline", message: t.common.unreachable, attempts: [], log: [], startedAt: Date.now(), key });
        return;
      }
      if (!res.ok) {
        setUrl(null);
        setRun({
          phase: "error",
          kind: "missing",
          message: res.status === 404 ? t.result.missing : t.common.serverAnswered(res.status),
          attempts: [],
          log: [],
          startedAt: Date.now(),
          key: null,
        });
        return;
      }
      await consume(res);
    },
    [consume, t],
  );

  useEffect(() => {
    if (badLink) setUrl(null);
  }, [badLink]);

  useEffect(() => {
    if (!initialKey || attached.current) return;
    attached.current = true;
    void reconnect(initialKey);
  }, [initialKey, reconnect]);

  async function submit(input: SubmitInput) {
    setLastRequest(input);
    const startedAt = Date.now();
    setView("result");
    setRun({
      phase: "working",
      key: null,
      startedAt,
      log: [{ at: startedAt, e: { type: "uploading" } }],
      settings: input.settings,
      personPreview: input.personPreview,
      garmentPreview: input.garmentPreview,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });

    const form = new FormData();
    form.set("garment", input.garment);
    if (input.person.kind === "preset") form.set("preset", input.person.id);
    else form.set("person", input.person.file);
    for (const [k, v] of Object.entries(input.settings)) form.set(k, String(v));

    let res: Response;
    try {
      res = await fetch("/api/tryon", { method: "POST", body: form, headers: passcodeHeaders() });
    } catch {
      setRun((r) => ({ phase: "error", kind: "offline", message: t.common.unreachable, attempts: [], log: logOf(r), startedAt, key: null }));
      return;
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      const status = res.status;
      setRun((r) => ({
        phase: "error",
        kind: status === 400 || status === 409 ? "input" : "other",
        message: body?.error ?? t.common.serverAnswered(status),
        attempts: [],
        log: logOf(r),
        startedAt,
        key: null,
      }));
      return;
    }
    await consume(res);
  }

  /* ── Inputs ── */

  const pickGarment = useCallback(async (file: File, note?: string) => {
    setProductError(null);
    setProductNote(note ?? null);
    const problem = await checkImageFile(file, "product", t);
    if (problem) return setProductError(problem);
    const picked: Picked = { file, url: URL.createObjectURL(file), owned: true };
    setInputs((i) => ({ ...i, garment: picked }));
  }, [t]);

  async function pickSample(s: SampleGarment) {
    setLoadingSample(true);
    setProductError(null);
    setProductNote(null);
    try {
      const file = await fileFrom(`/samples/${s.file}`, s.file);
      setInputs((i) => ({
        ...i,
        garment: { file, url: `/samples/${s.file}`, owned: false },
        category: s.category,
        photoType: s.photoType,
        person: setup.presets.includes(s.preset) ? { kind: "preset", id: s.preset } : i.person,
      }));
      setProductNote(t.studio.sampleLoaded(t.product.samples[s.id] ?? s.label));
    } catch (err) {
      setProductError(t.studio.sampleFailed((err as Error).message));
    } finally {
      setLoadingSample(false);
    }
  }

  async function pickPersonFile(file: File) {
    setModelError(null);
    const problem = await checkImageFile(file, "model", t);
    if (problem) return setModelError(problem);
    setInputs((i) => ({ ...i, person: { kind: "upload", picked: { file, url: URL.createObjectURL(file), owned: true } } }));
  }

  /** Puts a saved result's inputs back into the steps — for "another model" and "another variation". */
  async function loadFromResult(r: ResultMeta) {
    const garment = await fileFrom(resultUrl(r.key, "garment.jpg"), "garment.jpg");
    const preset = PRESETS.find((p) => p.id === r.personId && setup.presets.includes(p.id));
    const personFile = preset ? null : await fileFrom(resultUrl(r.key, "person.jpg"), "person.jpg");
    const person: PersonChoice = preset
      ? { kind: "preset", id: preset.id }
      : { kind: "upload", picked: { file: personFile!, url: resultUrl(r.key, "person.jpg"), owned: false } };
    setInputs((i) => ({
      ...i,
      garment: { file: garment, url: resultUrl(r.key, "garment.jpg"), owned: false },
      category: r.settings.category,
      photoType: r.settings.photoType,
      person,
      quality: r.settings.quality,
    }));
    return { garment, person: preset ? ({ kind: "preset", id: preset.id } as const) : ({ kind: "upload", file: personFile! } as const) };
  }

  async function variation(r: ResultMeta) {
    try {
      const loaded = await loadFromResult(r);
      await submit({
        ...loaded,
        settings: { ...r.settings, seed: randomSeed() },
        garmentPreview: resultUrl(r.key, "garment.jpg"),
        personPreview: resultUrl(r.key, "person.jpg"),
      });
    } catch (err) {
      setRun({ phase: "error", kind: "other", message: t.result.reloadFailed((err as Error).message), attempts: [], log: [], startedAt: Date.now(), key: null });
    }
  }

  async function anotherModel(r: ResultMeta) {
    try {
      await loadFromResult(r);
      setView("model");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setModelError(t.studio.reloadProductFailed((err as Error).message));
      setView("model");
    }
  }

  function newProduct() {
    setInputs((i) => ({ ...i, garment: null, category: null, photoType: "flat-lay" }));
    setRun({ phase: "idle" });
    setProductError(null);
    setProductNote(null);
    setLastRequest(null);
    setUrl(null);
    setView("product");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function create() {
    const { garment, category, person } = inputs;
    if (!garment || !category || !person || !setup.engine.configured) return;
    const preset = person.kind === "preset" ? PRESETS.find((p) => p.id === person.id) : undefined;
    void submit({
      garment: garment.file,
      person: person.kind === "preset" ? { kind: "preset", id: person.id } : { kind: "upload", file: person.picked.file },
      settings: { category, photoType: inputs.photoType, quality: inputs.quality, seed: FIRST_SEED },
      garmentPreview: garment.url,
      personPreview: preset ? `/presets/${preset.file}` : person.kind === "upload" ? person.picked.url : "",
    });
  }

  async function feature(key: string, on: boolean): Promise<string | null> {
    const res = await fetch("/api/featured", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...passcodeHeaders() },
      body: JSON.stringify({ key, on }),
    }).catch(() => null);
    if (!res) return t.common.unreachable;
    const body = (await res.json().catch(() => null)) as { featured?: string[]; error?: string } | null;
    if (!res.ok || !body?.featured) return body?.error ?? t.common.serverAnswered(res.status);
    setFeatured(body.featured);
    return null;
  }

  function openResult(r: ResultMeta) {
    setRun({ phase: "done", result: r, cached: true, log: [] });
    setView("result");
    setUrl(r.key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function go(v: View) {
    setView(v);
    if (v !== "result") setUrl(null);
    else setUrl(keyOf(run));
  }

  const reachable = { product: true, model: Boolean(inputs.garment && inputs.category), result: run.phase !== "idle" };
  const runKey = keyOf(run);

  return (
    <>
      <StudioHeader setup={live} />

      <main className="mx-auto max-w-5xl px-4 pt-6 pb-20 sm:px-6">
        {!setup.engine.configured && (
          <div className="mb-6">
            <Notice tone="warn">
              <strong>{t.studio.demoTitle}</strong>{" "}
              {setup.engine.label === "misconfigured" ? (
                t.studio.configProblem(setup.engine.missing ?? "")
              ) : (
                <>
                  {t.studio.demoBody}{" "}
                  <a className="underline" href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer">
                    huggingface.co/settings/tokens
                  </a>{" "}
                  {t.studio.demoBodyEnd}
                </>
              )}
            </Notice>
          </div>
        )}

        <div className="mb-6 empty:hidden">
          <PasscodeField required={setup.passcodeRequired} />
        </div>

        <Stepper
          view={view}
          reachable={reachable}
          complete={{ product: reachable.model, model: Boolean(reachable.model && inputs.person), result: run.phase === "done" }}
          onGo={go}
          lockedReason={working ? t.studio.locked : null}
        />

        <div className="mt-8">
          {view === "product" && (
            <ProductStep
              inputs={inputs}
              setup={setup}
              error={productError}
              note={productNote}
              busyLoading={loadingSample}
              onFile={pickGarment}
              onClear={() => {
                setProductError(null);
                setProductNote(null);
                setInputs((i) => ({ ...i, garment: null }));
              }}
              onSample={(s) => void pickSample(s)}
              onCategory={(category) => setInputs((i) => ({ ...i, category }))}
              onPhotoType={(photoType) => setInputs((i) => ({ ...i, photoType }))}
              onContinue={() => setView("model")}
            />
          )}
          {view === "model" && (
            <ModelStep
              inputs={inputs}
              setup={live}
              error={modelError}
              onPerson={(person) => {
                setModelError(null);
                setInputs((i) => ({ ...i, person }));
              }}
              onPersonFile={(f) => void pickPersonFile(f)}
              onClearPerson={() => {
                setModelError(null);
                setInputs((i) => ({ ...i, person: null }));
              }}
              onQuality={(quality) => setInputs((i) => ({ ...i, quality }))}
              onBack={() => setView("product")}
              onCreate={create}
            />
          )}
          {view === "result" && run.phase !== "idle" && (
            <ResultStep
              run={run}
              quota={quota}
              curation={setup.curation}
              featured={featured}
              onFeature={feature}
              onVariation={(r) => void variation(r)}
              onAnotherModel={(r) => void anotherModel(r)}
              onNewProduct={newProduct}
              onRetry={lastRequest && setup.engine.configured ? () => void submit(lastRequest) : null}
              onReconnect={run.phase === "error" && run.key ? () => void reconnect(run.key!) : null}
              onGo={go}
            />
          )}
        </div>

        <div id="recent" className="scroll-mt-20">
          <RecentGrid results={recent} featured={featured} activeKey={runKey} onOpen={openResult} disabled={working} />
        </div>
      </main>
    </>
  );
}
