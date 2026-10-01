import { Client, handle_file, type Status } from "@gradio/client";
import { env } from "@/lib/env";
import { EngineError, QUALITY_STEPS, type Engine } from "./types";

/**
 * FASHN VTON 1.5 on its official Hugging Face Space (ZeroGPU, free).
 *
 * Verified 2026-10-02: the endpoint accepts anonymous calls and queues them,
 * then refuses with "exceeded your ZeroGPU runs limit". An HF token is what
 * buys GPU time, so without one this engine reports itself unconfigured
 * rather than pretending to work.
 *
 * Parameter names come from the Space's /gradio_api/info. If FASHN renames
 * one, `npm run engine:check` fails before a seller sees it.
 */
export const FASHN_SPACE = "fashn-ai/fashn-vton-1.5";
export const FASHN_ENDPOINT = "/try_on";
export const FASHN_PARAMETERS = [
  "person_image",
  "garment_image",
  "category",
  "garment_photo_type",
  "num_timesteps",
  "guidance_scale",
  "seed",
  "segmentation_free",
] as const;

export function fashnSpace(token = env().HF_TOKEN): Engine {
  return {
    id: "fashn-space",
    label: "FASHN VTON 1.5 · Hugging Face ZeroGPU",
    configured: Boolean(token),
    missing: token ? undefined : "HF_TOKEN is not set — anonymous calls get no ZeroGPU quota",

    async run(input, onEvent, signal) {
      let client: Client;
      try {
        client = await Client.connect(FASHN_SPACE, {
          token: token as `hf_${string}`,
          events: ["data", "status"],
        });
      } catch (err) {
        throw new EngineError(`could not reach the Space: ${(err as Error).message}`, "unavailable");
      }
      signal.throwIfAborted();

      const job = client.submit(FASHN_ENDPOINT, {
        person_image: handle_file(new Blob([new Uint8Array(input.person)], { type: "image/jpeg" })),
        garment_image: handle_file(new Blob([new Uint8Array(input.garment)], { type: "image/jpeg" })),
        category: input.settings.category,
        garment_photo_type: input.settings.photoType,
        num_timesteps: QUALITY_STEPS[input.settings.quality],
        guidance_scale: 1.5,
        seed: input.settings.seed,
        segmentation_free: true,
      } satisfies Record<(typeof FASHN_PARAMETERS)[number], unknown>);

      // Cancelling frees our place in the Space's queue; without it a
      // timed-out request still spends the GPU quota after we stop listening.
      const cancel = () => void job.cancel().catch(() => {});
      signal.addEventListener("abort", cancel, { once: true });

      try {
        for await (const msg of job) {
          if (msg.type === "status") {
            const status = msg as Status & { original_msg?: string };
            if (status.stage === "error") throw classify(status);
            if (status.original_msg === "process_starts") {
              onEvent({ type: "running", etaSeconds: status.eta ?? null });
            } else if (status.stage === "pending" && status.position !== undefined) {
              onEvent({ type: "queued", position: status.position, etaSeconds: status.eta ?? null });
            }
          } else if (msg.type === "data") {
            const file = (msg.data as { url?: string }[])[0];
            if (!file?.url) throw new EngineError("the Space returned no image", "unknown");
            const res = await fetch(file.url, { signal, headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new EngineError(`downloading the result failed: HTTP ${res.status}`, "unavailable");
            return Buffer.from(await res.arrayBuffer());
          }
        }
      } finally {
        signal.removeEventListener("abort", cancel);
      }

      signal.throwIfAborted();
      throw new EngineError("the Space closed the stream without a result", "unknown");
    },
  };
}

/**
 * ZeroGPU's wording is the only signal we get, so classify on it. Observed:
 *   "You have exceeded your ZeroGPU runs limit. Authenticate with a Hugging Face token…"
 * and documented for signed-in users:
 *   "You have exceeded your GPU quota (60s requested vs. 12s left). Try again in 0:13:21"
 */
export function classify(status: Pick<Status, "message" | "title">): EngineError {
  const text = [status.title, typeof status.message === "string" ? status.message : ""]
    .filter(Boolean)
    .join(": ") || "the Space reported an error without a message";

  if (/quota|runs limit/i.test(text)) {
    const wait = text.match(/try again in (\d+):(\d{2}):(\d{2})/i);
    const seconds = wait ? Number(wait[1]) * 3600 + Number(wait[2]) * 60 + Number(wait[3]) : undefined;
    return new EngineError(text, "quota", seconds);
  }
  if (/no gpu was available|gpu task aborted|worker error|sleeping|building|restart/i.test(text)) {
    return new EngineError(text, "unavailable");
  }
  if (/please upload/i.test(text)) return new EngineError(text, "input");
  return new EngineError(text, "unknown");
}
