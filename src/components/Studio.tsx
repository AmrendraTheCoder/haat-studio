"use client";

import { useCallback, useRef, useState } from "react";
import { readEvents } from "@/lib/client/events";
import { PRESETS, SAMPLE_GARMENTS, type SampleGarment } from "@/lib/presets";
import type { ResultMeta, TryOnSettings } from "@/lib/tryon/types";
import { Dropzone, Segmented, Step } from "./controls";
import { Gallery } from "./Gallery";
import { ModelPicker, type PersonChoice } from "./ModelPicker";
import { fileUrl, Output, type RunState } from "./Output";

export interface Setup {
  engine: { label: string; configured: boolean; missing?: string };
  /** Ids whose photos are actually on disk. */
  presets: string[];
  samples: string[];
}

type Garment = { file: File; url: string };

/** First generations use a fixed seed, so repeating one is a cache hit. Variations draw a new one. */
const FIRST_SEED = 42;
const randomSeed = () => Math.floor(Math.random() * 2_000_000_000);

async function asFile(url: string, name: string): Promise<File> {
  const blob = await (await fetch(url)).blob();
  return new File([blob], name, { type: blob.type });
}

export function Studio({ setup, initialResults }: { setup: Setup; initialResults: ResultMeta[] }) {
  const [garment, setGarment] = useState<Garment | null>(null);
  const [category, setCategory] = useState<TryOnSettings["category"]>("tops");
  const [photoType, setPhotoType] = useState<TryOnSettings["photoType"]>("flat-lay");
  const [quality, setQuality] = useState<TryOnSettings["quality"]>("balanced");
  const [person, setPerson] = useState<PersonChoice | null>(() => {
    const first = PRESETS.find((p) => setup.presets.includes(p.id));
    return first ? { kind: "preset", id: first.id } : null;
  });
  const [run, setRun] = useState<RunState>({ phase: "idle" });
  const [results, setResults] = useState(initialResults);
  const outputRef = useRef<HTMLDivElement>(null);

  const busy = run.phase === "working";
  const samples = SAMPLE_GARMENTS.filter((s) => setup.samples.includes(s.id));

  const refresh = useCallback(async () => {
    const res = await fetch("/api/results", { cache: "no-store" });
    if (res.ok) setResults((await res.json()) as ResultMeta[]);
  }, []);

  const showOutput = () => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });

  const chooseGarment = (file: File) =>
    setGarment((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { file, url: URL.createObjectURL(file) };
    });

  async function submit(input: { garment: File; person: PersonChoice; settings: TryOnSettings }) {
    const form = new FormData();
    form.set("garment", input.garment);
    if (input.person.kind === "preset") form.set("preset", input.person.id);
    else form.set("person", input.person.file);
    for (const [k, v] of Object.entries(input.settings)) form.set(k, String(v));

    setRun({ phase: "working", since: Date.now(), step: "preparing", position: null, etaSeconds: null, runningSince: null });
    showOutput();

    let finished = false;
    try {
      const res = await fetch("/api/tryon", { method: "POST", body: form });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        finished = true;
        setRun({ phase: "error", message: body?.error ?? `The server answered ${res.status}.`, attempts: [] });
        return;
      }
      await readEvents(res, (e) => {
        if (e.type === "done") {
          finished = true;
          setRun({ phase: "done", result: e.result, cached: e.cached });
        } else if (e.type === "error") {
          finished = true;
          setRun({ phase: "error", message: e.message, attempts: e.attempts });
        } else if (e.type !== "accepted") {
          setRun((r) => {
            if (r.phase !== "working") return r;
            if (e.type === "waiting") return { ...r, step: "waiting" };
            if (e.type === "queued") return { ...r, step: "queued", position: e.position, etaSeconds: e.etaSeconds };
            return { ...r, step: "running", etaSeconds: e.etaSeconds ?? r.etaSeconds, runningSince: r.runningSince ?? Date.now() };
          });
        }
      });
      if (!finished) {
        setRun({
          phase: "error",
          message: "Lost the connection to the server. If the generation had started, it will appear in the gallery when it finishes.",
          attempts: [],
        });
      }
    } catch (err) {
      setRun({ phase: "error", message: `Couldn't reach the server: ${(err as Error).message}`, attempts: [] });
    } finally {
      void refresh();
    }
  }

  async function pickSample(s: SampleGarment) {
    chooseGarment(await asFile(`/samples/${s.file}`, s.file));
    setCategory(s.category);
    setPhotoType(s.photoType);
    if (setup.presets.includes(s.preset)) setPerson({ kind: "preset", id: s.preset });
  }

  /** Re-runs any displayed result — including one opened from the gallery — with a fresh seed. */
  async function variation(r: ResultMeta) {
    const garmentFile = await asFile(fileUrl(r.key, "garment.jpg"), "garment.jpg");
    const choice: PersonChoice = setup.presets.includes(r.personId)
      ? { kind: "preset", id: r.personId }
      : { kind: "upload", file: await asFile(fileUrl(r.key, "person.jpg"), "person.jpg"), url: fileUrl(r.key, "person.jpg") };
    await submit({ garment: garmentFile, person: choice, settings: { ...r.settings, seed: randomSeed() } });
  }

  const blocker = !setup.engine.configured
    ? "Generation is off until the setup note above is resolved."
    : !garment
      ? "Add a garment photo, or pick a sample."
      : !person
        ? "Choose a model."
        : null;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 py-6">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-2xl font-semibold tracking-tight">
            Haat <span className="text-accent">Studio</span>
          </span>
          <span className="hidden text-sm text-muted sm:inline">Garment photo in, on-model photo out.</span>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
            setup.engine.configured ? "border-line text-muted" : "border-warn/40 bg-warn-soft text-warn"
          }`}
        >
          <span className={`size-1.5 rounded-full ${setup.engine.configured ? "bg-ok" : "bg-warn"}`} />
          {setup.engine.configured ? setup.engine.label : "Setup needed"}
        </span>
      </header>

      <SetupNotes setup={setup} />

      <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-8">
        <div className="space-y-7 rounded-2xl border border-line bg-card p-5">
          <Step n={1} title="Garment photo">
            <Dropzone
              className="aspect-[4/3]"
              previewUrl={garment?.url ?? null}
              onFile={chooseGarment}
              title="Drop a product photo"
              hint="JPEG, PNG or WebP · up to 15 MB"
            />
            {samples.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="mr-1 text-muted">Or try a sample:</span>
                {samples.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => void pickSample(s)}
                    className="rounded-full border border-line px-2.5 py-1 text-ink hover:border-muted"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </Step>

          <Step n={2} title="About the garment">
            <Segmented
              label="Category"
              value={category}
              onChange={setCategory}
              options={[
                { value: "tops", label: "Top" },
                { value: "bottoms", label: "Bottom" },
                { value: "one-pieces", label: "Full outfit" },
              ]}
            />
            <Segmented
              label="Photo type"
              value={photoType}
              onChange={setPhotoType}
              options={[
                { value: "flat-lay", label: "Flat or on hanger" },
                { value: "model", label: "Worn by someone" },
              ]}
            />
          </Step>

          <Step n={3} title="Model">
            <ModelPicker presets={PRESETS} installed={setup.presets} value={person} onChange={setPerson} />
          </Step>

          <Step n={4} title="Quality" aside={<span className="text-xs text-muted">More steps use more free GPU time</span>}>
            <Segmented
              label="Quality"
              value={quality}
              onChange={setQuality}
              options={[
                { value: "fast", label: "Fast", hint: "20 steps" },
                { value: "balanced", label: "Balanced", hint: "30 steps" },
                { value: "best", label: "Best", hint: "50 steps" },
              ]}
            />
          </Step>

          <div>
            <button
              type="button"
              disabled={blocker !== null || busy}
              onClick={() =>
                garment && person && void submit({ garment: garment.file, person, settings: { category, photoType, quality, seed: FIRST_SEED } })
              }
              className="w-full rounded-xl bg-accent py-3 text-base font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Generating…" : "Put it on the model"}
            </button>
            {blocker && <p className="mt-2 text-center text-xs text-muted">{blocker}</p>}
          </div>
        </div>

        <div ref={outputRef} className="scroll-mt-6 lg:sticky lg:top-6 lg:self-start">
          <Output run={run} onVariation={(r) => void variation(r)} busy={busy} />
        </div>
      </div>

      <Gallery
        results={results}
        onOpen={(r) => {
          setRun({ phase: "done", result: r, cached: true });
          showOutput();
        }}
      />

      <footer className="mt-16 border-t border-line pt-6 text-xs leading-relaxed text-muted">
        Try-on by FASHN VTON 1.5 (Apache-2.0), running on Hugging Face ZeroGPU. Results are generated images: check colour,
        print and shape against the real product before posting.
      </footer>
    </div>
  );
}

function SetupNotes({ setup }: { setup: Setup }) {
  const notes: React.ReactNode[] = [];
  if (!setup.engine.configured) {
    notes.push(
      <>
        <strong>Generation is off:</strong> {setup.engine.missing}. Create a free <em>read</em> token at{" "}
        <a className="underline" href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer">
          huggingface.co/settings/tokens
        </a>
        , add it to <code>.env</code> as <code>HF_TOKEN=hf_…</code>, then reload.
      </>,
    );
  }
  if (setup.presets.length < PRESETS.length || setup.samples.length < SAMPLE_GARMENTS.length) {
    notes.push(
      <>
        <strong>Model photos or samples are missing.</strong> Run <code>npm run setup</code> in the project folder, then reload.
      </>,
    );
  }
  if (notes.length === 0) return null;
  return (
    <div className="mb-6 space-y-2">
      {notes.map((note, i) => (
        <p key={i} className="rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-ink">
          {note}
        </p>
      ))}
    </div>
  );
}
