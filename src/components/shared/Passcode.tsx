"use client";

import { useEffect, useState } from "react";
import { readPasscode, savePasscode } from "@/lib/client/passcode";
import { useI18n } from "@/lib/i18n/client";

/**
 * Shown only on servers with STUDIO_PASSCODE set. The passcode is kept in
 * this browser and sent with every request that creates something.
 */
export function PasscodeField({ required }: { required: boolean }) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  // Browser storage only exists after hydration; reading it during render would mismatch the server HTML.
  useEffect(() => {
    const stored = readPasscode();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from browser storage
    setValue(stored);
    setSaved(Boolean(stored));
  }, []);
  if (!required) return null;
  return (
    <form
      className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper-glow px-4 py-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        savePasscode(value.trim());
        setSaved(Boolean(value.trim()));
      }}
    >
      <label htmlFor="passcode" className="font-semibold">
        {t.passcode.label}
      </label>
      <input
        id="passcode"
        type="password"
        autoComplete="current-password"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-1.5"
        placeholder={t.passcode.placeholder}
      />
      <button type="submit" className="btn-primary !px-4 !py-1.5">
        {saved ? t.passcode.saved : t.passcode.save}
      </button>
      <p className="w-full text-xs text-ink-3">{t.passcode.note}</p>
    </form>
  );
}
