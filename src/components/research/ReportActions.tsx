"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="min-h-11 rounded-full border border-line px-4 py-1 text-xs hover:border-ink print:hidden"
      onClick={async () => {
        await navigator.clipboard?.writeText(text).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? t.common.copied : (label ?? t.common.copy)}
    </button>
  );
}

/** Makes this report the one the post maker grounds captions in, then opens the studio. */
export function UseForPosts({ id }: { id: string }) {
  const router = useRouter();
  const { t } = useI18n();
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
      {t.report.useForPosts}
    </button>
  );
}

export function PrintButton() {
  const { t } = useI18n();
  return (
    <button type="button" className="btn-ghost print:hidden" onClick={() => window.print()}>
      {t.report.print}
    </button>
  );
}
