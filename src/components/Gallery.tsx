"use client";

import type { ResultMeta } from "@/lib/tryon/types";
import { fileUrl, QUALITY_LABEL } from "./Output";

const ago = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours}h ago` : new Date(iso).toLocaleDateString();
};

export function Gallery({ results, onOpen }: { results: ResultMeta[]; onOpen: (r: ResultMeta) => void }) {
  if (results.length === 0) return null;
  return (
    <section className="mt-14">
      <h2 className="font-display text-xl text-ink">Recent results</h2>
      <p className="mt-1 text-sm text-muted">Saved on this machine. Opening one costs no GPU time.</p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {results.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => onOpen(r)}
            className="group text-left"
          >
            <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-line bg-card">
              <img src={fileUrl(r.key, "result.png")} alt="" loading="lazy" className="size-full object-cover transition-transform group-hover:scale-[1.02]" />
              <img
                src={fileUrl(r.key, "garment.jpg")}
                alt=""
                loading="lazy"
                className="absolute right-2 bottom-2 size-12 rounded-lg border border-line bg-white object-contain p-0.5 shadow"
              />
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {QUALITY_LABEL[r.settings.quality].split(" · ")[0]} · {ago(r.createdAt)}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
