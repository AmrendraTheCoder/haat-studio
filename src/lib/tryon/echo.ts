import { EngineError, type Engine } from "./types";

/**
 * A test engine for exercising the studio without a GPU or a token. It does
 * no try-on: it walks through the same queued → running events as the real
 * engine and returns the model photo unchanged. Results carry engine "echo",
 * the UI labels them as test output, and they can never be featured.
 *
 *   TRYON_ENGINES=echo                  succeed after ~2.5s
 *   TRYON_ENGINES=echo ECHO_FAIL=quota  fail the way ZeroGPU does when the quota is spent
 *   TRYON_ENGINES=echo ECHO_FAIL=error  fail with an unexplained engine error
 *
 * Point DATA_DIR somewhere disposable while testing so echo results stay
 * out of the real gallery.
 */
export const ECHO_ID = "echo";

export function echo(): Engine {
  return {
    id: ECHO_ID,
    label: "Echo test engine · no try-on",
    configured: true,
    async run(input, onEvent, signal) {
      const pause = (ms: number) =>
        new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, ms);
          signal.addEventListener("abort", () => (clearTimeout(t), reject(signal.reason)), { once: true });
        });

      onEvent({ type: "queued", position: 1, etaSeconds: 3 });
      await pause(700);
      onEvent({ type: "queued", position: 0, etaSeconds: 2 });
      await pause(500);
      if (process.env.ECHO_FAIL === "quota") {
        throw new EngineError("You have exceeded your GPU quota (60s requested vs. 12s left). Try again in 0:13:21", "quota", 801);
      }
      onEvent({ type: "running", etaSeconds: 2 });
      await pause(1300);
      if (process.env.ECHO_FAIL === "error") throw new EngineError("echo: simulated engine failure", "unknown");
      return input.person;
    },
  };
}
