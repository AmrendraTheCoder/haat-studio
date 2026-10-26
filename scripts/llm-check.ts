/**
 * Which text-AI providers can write captions and research right now?
 *
 *   npm run llm:check
 *
 * Free model ids are withdrawn without notice (stiche-v2 lost its whole set
 * once), so this asks each configured one for a tiny JSON answer. Costs one
 * small request per configured provider.
 */
import { z } from "zod";
import { chainFromEnv, completeJSON } from "../src/lib/llm";

const probe = z.object({ ok: z.literal(true) });
let working = 0;

console.log("");
for (const c of chainFromEnv()) {
  if (!c.configured) {
    console.log(`  –  ${c.id.padEnd(40)} skipped: ${c.missing}`);
    continue;
  }
  const t0 = Date.now();
  try {
    await completeJSON(probe, { system: "Reply with JSON only.", prompt: 'Return exactly {"ok": true}', maxTokens: 20, temperature: 0 }, [c]);
    working++;
    console.log(`  ✓  ${c.id.padEnd(40)} ${Date.now() - t0} ms`);
  } catch (err) {
    console.log(`  ✗  ${c.id.padEnd(40)} ${(err as Error).message.slice(0, 160)}`);
  }
}
console.log(
  working
    ? `\n${working} provider(s) ready — captions and research will be AI-written.\n`
    : "\nNo provider answered — captions and research fall back to clearly labelled templates.\nAdd a free GROQ_API_KEY (console.groq.com) to .env.\n",
);
process.exit(0);
