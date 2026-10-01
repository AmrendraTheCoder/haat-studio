import type { Job } from "./studio";
import type { StreamEvent } from "./types";

const HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Accel-Buffering": "no",
};

/**
 * One StreamEvent per line, replaying what the job has already emitted and
 * closing after `done` or `error`. If the browser goes away the stream
 * unsubscribes; the job itself keeps running and its result is still saved.
 */
export function streamJob(job: Pick<Job, "subscribe">): Response {
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let closed = false;

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (e: StreamEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        if (e.type === "done" || e.type === "error") {
          closed = true;
          controller.close();
          queueMicrotask(() => unsubscribe());
        }
      };
      unsubscribe = job.subscribe(send);
    },
    cancel() {
      closed = true;
      unsubscribe();
    },
  });

  return new Response(body, { headers: HEADERS });
}

/** A finished result, in the same shape a live job would end with. */
export function streamEvents(events: StreamEvent[]): Response {
  return streamJob({
    subscribe(listener) {
      for (const e of events) listener(e);
      return () => {};
    },
  });
}
