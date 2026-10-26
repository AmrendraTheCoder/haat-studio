"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="rounded-full border border-line px-3 py-1 text-xs hover:border-ink print:hidden"
      onClick={async () => {
        await navigator.clipboard?.writeText(text).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

/** Makes this report the one the post maker grounds captions in, then opens the studio. */
export function UseForPosts({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn-primary !px-6 !py-3 print:hidden"
      onClick={() => {
        try {
          localStorage.setItem("haat.research", JSON.stringify(id));
        } catch {
          // The post maker just won't pick it up automatically.
        }
        router.push("/studio");
      }}
    >
      Use this for my posts →
    </button>
  );
}

export function PrintButton() {
  return (
    <button type="button" className="btn-ghost print:hidden" onClick={() => window.print()}>
      Print / save as PDF
    </button>
  );
}
