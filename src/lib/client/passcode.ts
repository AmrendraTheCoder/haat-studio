const KEY = "haat.passcode";
const HEADER = "x-studio-passcode";

/** Browser storage can be missing or blocked (private windows); every access is guarded. */
export function readPasscode(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function savePasscode(value: string) {
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch {
    // Not persisted; the user re-enters it next visit.
  }
}

/** Headers for any request that creates something. Empty when no passcode is stored. */
export function passcodeHeaders(): Record<string, string> {
  const p = readPasscode();
  return p ? { [HEADER]: p } : {};
}
