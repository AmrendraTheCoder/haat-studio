import type { Attempt, ModelChoice, ResultMeta, StreamEvent, TryOnSettings } from "@/lib/tryon/types";

export type Category = TryOnSettings["category"];
export type PhotoType = TryOnSettings["photoType"];
export type Quality = TryOnSettings["quality"];

/** A chosen photo: the file to upload and a URL to preview it. */
export interface Picked {
  file: File;
  url: string;
  /** Object URLs we created and must revoke; remote URLs we must not. */
  owned: boolean;
}

export type PersonChoice = { kind: "preset"; id: string } | { kind: "upload"; picked: Picked };

export interface Inputs {
  garment: Picked | null;
  /** Deliberately no default: a wrong category wastes a generation. */
  category: Category | null;
  photoType: PhotoType;
  person: PersonChoice | null;
  quality: Quality;
  /** Fixed by default so asking twice reuses the saved photo; "another variation" draws a new one. */
  seed: number;
  /** Which try-on AI: FASHN VTON 1.5 as released, or with the Haat LoRA adapter. */
  model: ModelChoice;
}

export type View = "product" | "model" | "review" | "result";

/** A client-side marker for the upload that happens before the server answers. */
export type LogEvent = StreamEvent | { type: "uploading" };
export interface LogEntry {
  at: number;
  e: LogEvent;
}

export type ErrorKind = "quota" | "input" | "missing" | "offline" | "other";

export type Run =
  | { phase: "idle" }
  | {
      phase: "working";
      key: string | null;
      startedAt: number;
      log: LogEntry[];
      settings: TryOnSettings | null;
      /** Shown while generating; null when re-attaching from a link. */
      personPreview: string | null;
      garmentPreview: string | null;
    }
  | { phase: "done"; result: ResultMeta; cached: boolean; log: LogEntry[] }
  | {
      phase: "error";
      kind: ErrorKind;
      message: string;
      attempts: Attempt[];
      log: LogEntry[];
      startedAt: number;
      /** Set when the job may still be running server-side, so the page can re-attach. */
      key: string | null;
    };

export interface SubmitInput {
  garment: File;
  person: { kind: "preset"; id: string } | { kind: "upload"; file: File };
  settings: TryOnSettings;
  model: ModelChoice;
  garmentPreview: string;
  personPreview: string;
}
