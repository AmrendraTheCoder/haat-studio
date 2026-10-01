"use client";

import type { Preset } from "@/lib/presets";
import { Dropzone } from "./controls";

export type PersonChoice = { kind: "preset"; id: string } | { kind: "upload"; file: File; url: string };

export function ModelPicker({
  presets,
  installed,
  value,
  onChange,
}: {
  presets: Preset[];
  installed: string[];
  value: PersonChoice | null;
  onChange: (choice: PersonChoice) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {presets.map((p) => {
        const ready = installed.includes(p.id);
        const active = value?.kind === "preset" && value.id === p.id;
        return (
          <button
            key={p.id}
            type="button"
            disabled={!ready}
            onClick={() => onChange({ kind: "preset", id: p.id })}
            aria-pressed={active}
            title={ready ? p.label : `${p.label} — run npm run setup`}
            className={`group relative aspect-[2/3] overflow-hidden rounded-xl border bg-paper transition ${
              active ? "border-accent ring-2 ring-accent" : "border-line hover:border-muted"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {ready ? (
              <img src={`/presets/${p.file}`} alt={p.label} className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center p-2 text-[11px] text-muted">not installed</span>
            )}
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-4 pb-1 text-left text-[10px] leading-tight text-white">
              {p.label}
            </span>
          </button>
        );
      })}
      <Dropzone
        className={`aspect-[2/3] text-xs ${value?.kind === "upload" ? "border-solid border-accent ring-2 ring-accent" : ""}`}
        previewUrl={value?.kind === "upload" ? value.url : null}
        onFile={(file) => onChange({ kind: "upload", file, url: URL.createObjectURL(file) })}
        title="Your own"
        hint="Front-facing, full body"
      />
    </div>
  );
}
