/** Display names for engine ids stored on results. Pure data, safe in the browser. */
export const ENGINE_NAMES: Record<string, string> = {
  "fashn-space": "FASHN VTON 1.5",
  "local-lora": "FASHN VTON 1.5 + Haat LoRA (this computer)",
  "fashn-lora-space": "FASHN VTON 1.5 + Haat LoRA",
  echo: "Echo test engine",
};

/** Results from engines that don't do a real try-on. Labelled as such and never featured. */
export const TEST_ENGINES = new Set(["echo"]);

export const engineName = (id: string) => ENGINE_NAMES[id] ?? id;
