import { createHash } from "node:crypto";

// PostHog LLM analytics for the Muse calls of /a, no SDK: off until POSTHOG_KEY is set. Fire and forget; the trace id is a
// salted hash of the match id, never the id itself.
const anon = (x: string) => createHash("sha256").update((process.env.POSTHOG_SALT ?? "") + x).digest("hex").slice(0, 24);

export function aiGeneration(p: { kind: string; match: number | string; model?: string; input: number; output: number; ms: number; cost: number; text?: string }) {
  const key = process.env.POSTHOG_KEY;
  if (!key) return;
  const trace = anon(String(p.match));
  void fetch(`${(process.env.POSTHOG_HOST ?? "https://eu.i.posthog.com").replace(/\/$/, "")}/i/v0/e/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      event: "$ai_generation",
      distinct_id: trace,
      properties: {
        $ai_model: p.model ?? "muse",
        $ai_provider: "muse",
        $ai_input_tokens: p.input,
        $ai_output_tokens: p.output,
        $ai_latency: p.ms / 1000,
        $ai_total_cost_usd: p.cost,
        $ai_trace_id: trace,
        $ai_output_choices: [{ role: "assistant", content: (p.text ?? "").slice(0, 4000) }],
        kind: p.kind,
        $process_person_profile: false,
      },
    }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => {});
}
