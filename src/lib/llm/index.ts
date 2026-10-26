import type { z } from "zod";
import { env } from "@/lib/env";

/**
 * The single place text AI is called — captions and market research both go
 * through `completeJSON`. Same lessons as stiche-v2's `complete()`:
 *
 * - every provider here is a free tier, and any one key is enough;
 * - free model ids disappear without notice, so the chain falls through and
 *   reports every candidate's failure, not just the last;
 * - model output is never trusted: it is parsed and validated against a zod
 *   schema, and a malformed answer counts as a failure, not a result.
 *
 * Callers always have a deterministic fallback for when nothing answers.
 */

export interface Candidate {
  id: string;
  configured: boolean;
  missing?: string;
  chat(req: ChatRequest): Promise<string>;
}

export interface ChatRequest {
  system: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
}

export interface LlmAttempt {
  id: string;
  error: string;
}

export class LlmUnavailable extends Error {
  constructor(readonly attempts: LlmAttempt[]) {
    super(
      attempts.length === 0
        ? "No text-AI provider is configured"
        : `No text-AI provider answered: ${attempts.map((a) => `${a.id}: ${a.error}`).join("; ")}`,
    );
    this.name = "LlmUnavailable";
  }
}

const PROVIDERS: Record<string, { baseUrl: string; key: () => string | undefined; keyName: string }> = {
  groq: { baseUrl: "https://api.groq.com/openai/v1", key: () => env().GROQ_API_KEY, keyName: "GROQ_API_KEY" },
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", key: () => env().GEMINI_API_KEY, keyName: "GEMINI_API_KEY" },
  hf: { baseUrl: "https://router.huggingface.co/v1", key: () => env().HF_TOKEN, keyName: "HF_TOKEN" },
};

/** `groq/llama-3.3-70b-versatile` → Groq's OpenAI-compatible endpoint, and so on. */
export function candidate(id: string, fetchImpl: typeof fetch = fetch): Candidate {
  const slash = id.indexOf("/");
  const providerName = id.slice(0, slash);
  const model = id.slice(slash + 1);
  const provider = PROVIDERS[providerName];
  if (!provider || slash < 0) {
    return { id, configured: false, missing: `unknown provider in "${id}"`, chat: () => Promise.reject(new Error("unknown provider")) };
  }
  const key = provider.key();
  return {
    id,
    configured: Boolean(key),
    missing: key ? undefined : `${provider.keyName} is not set`,
    async chat(req) {
      const res = await fetchImpl(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        signal: AbortSignal.timeout(env().LLM_TIMEOUT_MS),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.prompt },
          ],
          max_tokens: req.maxTokens,
          temperature: req.temperature,
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content;
      if (!text) throw new Error("empty completion");
      return text;
    },
  };
}

export const chainFromEnv = (): Candidate[] =>
  env()
    .LLM_CHAIN.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id) => candidate(id));

/** Whether any configured provider exists — lets the UI say "AI is off" up front. */
export const llmConfigured = () => chainFromEnv().some((c) => c.configured);

/**
 * Pulls the first JSON object out of a model reply: tolerates ```json fences
 * and chatter before or after. Throws when there is no parseable object.
 */
export function extractJSON(text: string): unknown {
  const unfenced = text.replace(/```(?:json)?/gi, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in reply");
  return JSON.parse(unfenced.slice(start, end + 1));
}

export async function completeJSON<S extends z.ZodType>(
  schema: S,
  req: ChatRequest,
  candidates: Candidate[] = chainFromEnv(),
): Promise<{ data: z.infer<S>; via: string }> {
  const attempts: LlmAttempt[] = [];
  for (const c of candidates) {
    if (!c.configured) continue;
    try {
      const parsed = schema.safeParse(extractJSON(await c.chat(req)));
      if (parsed.success) return { data: parsed.data, via: c.id };
      attempts.push({ id: c.id, error: `answer didn't match the format: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}` });
    } catch (err) {
      attempts.push({ id: c.id, error: (err as Error).message });
    }
  }
  throw new LlmUnavailable(attempts);
}
