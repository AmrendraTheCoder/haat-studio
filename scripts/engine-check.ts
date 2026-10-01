/**
 * Is the free engine usable right now? Spends no GPU quota.
 *
 *   npm run engine:check
 *
 * Checks the three things that have changed under us without notice in
 * the past (see stiche-v2's "the whole model catalogue rotted"): the token,
 * whether the Space is up, and whether its API still takes the parameters
 * the adapter sends. Run it first whenever generation starts failing.
 */
import { env } from "../src/lib/env";
import { FASHN_ENDPOINT, FASHN_PARAMETERS, FASHN_SPACE } from "../src/lib/tryon/fashn-space";
import { CATEGORIES, PHOTO_TYPES } from "../src/lib/tryon/types";

let failures = 0;
const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const fail = (msg: string) => {
  failures++;
  console.log(`  ✗ ${msg}`);
};

const getJson = async <T>(url: string, token?: string): Promise<T> => {
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
};

const { HF_TOKEN } = env();
console.log(`\n${FASHN_SPACE}\n`);

// 1. Token
if (!HF_TOKEN) {
  fail("HF_TOKEN is not set — anonymous calls are refused with 'exceeded your ZeroGPU runs limit'");
} else {
  try {
    const me = await getJson<{ name: string; auth?: { accessToken?: { role?: string } } }>("https://huggingface.co/api/whoami-v2", HF_TOKEN);
    ok(`token belongs to ${me.name}${me.auth?.accessToken?.role ? ` (${me.auth.accessToken.role})` : ""}`);
  } catch (err) {
    fail(`HF_TOKEN was rejected: ${(err as Error).message}`);
  }
}

// 2. Space runtime
let host: string | undefined;
try {
  const space = await getJson<{ host?: string; runtime?: { stage?: string; hardware?: { current?: string } } }>(
    `https://huggingface.co/api/spaces/${FASHN_SPACE}`,
  );
  host = space.host;
  const stage = space.runtime?.stage ?? "unknown";
  if (stage === "RUNNING") ok(`Space is RUNNING on ${space.runtime?.hardware?.current ?? "unknown hardware"}`);
  else fail(`Space is ${stage} — generation will fail or wait for a cold start`);
} catch (err) {
  fail(`could not read Space status: ${(err as Error).message}`);
}

// 3. API contract
if (host) {
  try {
    type Param = { parameter_name: string; type: { enum?: string[] } };
    const info = await getJson<{ named_endpoints: Record<string, { parameters: Param[] }> }>(`${host}/gradio_api/info`);
    const endpoint = info.named_endpoints[FASHN_ENDPOINT];
    if (!endpoint) {
      fail(`endpoint ${FASHN_ENDPOINT} is gone; available: ${Object.keys(info.named_endpoints).join(", ")}`);
    } else {
      const remote = endpoint.parameters.map((p) => p.parameter_name);
      const missing = FASHN_PARAMETERS.filter((p) => !remote.includes(p));
      const added = remote.filter((p) => !(FASHN_PARAMETERS as readonly string[]).includes(p));
      if (missing.length || added.length) {
        fail(`parameters changed — we send but Space lacks: [${missing.join(", ")}]; Space has new: [${added.join(", ")}]`);
      } else {
        ok(`${FASHN_ENDPOINT} takes exactly the ${remote.length} parameters we send`);
      }
      const enumOf = (name: string) => endpoint.parameters.find((p) => p.parameter_name === name)?.type.enum ?? [];
      const badValues = [
        ...CATEGORIES.filter((c) => !enumOf("category").includes(c)),
        ...PHOTO_TYPES.filter((t) => !enumOf("garment_photo_type").includes(t)),
      ];
      if (badValues.length) fail(`Space no longer accepts: ${badValues.join(", ")}`);
      else ok("category and photo-type values still accepted");
    }
  } catch (err) {
    fail(`could not read the API schema: ${(err as Error).message}`);
  }
}

console.log(failures ? `\n${failures} problem(s).\n` : "\nReady. (This check used no GPU quota.)\n");
process.exit(failures ? 1 : 0);
