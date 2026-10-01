import type { StreamEvent } from "@/lib/tryon/types";

/** Reads the NDJSON body of `/api/tryon`, calling `onEvent` per line. Returns once the server closes the stream. */
export async function readEvents(res: Response, onEvent: (e: StreamEvent) => void): Promise<void> {
  if (!res.body) return;
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) onEvent(JSON.parse(line) as StreamEvent);
    }
  }
}
