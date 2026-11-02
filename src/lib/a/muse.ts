import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { addSpent } from "./guard";
import { aiGeneration } from "./ph";
import { getMatch } from "./source";
import type { Data } from "./types";

// Server side of /a: one place that calls Meta Muse (OpenAI-compatible Chat Completions), writes the token usage of
// every call to .a-cache/usage.jsonl and keeps "Объясни" answers on disk. The key never leaves process.env.

// A_CACHE_DIR on Cloud Run: the app folder there is read-only for the server user.
export const CACHE = process.env.A_CACHE_DIR || join(process.cwd(), ".a-cache");
const PRICE: Record<string, [number, number]> = { "muse-spark-1.3-contributor": [0.1, 0.2], "muse-spark-1.3": [1.25, 4.25] };
// Reasoning eats max_tokens first; below about 4000 a layout comes back cut.
const MAX = Math.max(6000, Number(process.env.LLM_MAX_TOKENS ?? 8000));

export type Call = { id: string; type: "function"; function: { name: string; arguments: string } };
type Msg = { role: "system" | "user" | "assistant"; content: string | null; tool_calls?: Call[] } | { role: "tool"; tool_call_id: string; content: string };
/** Tools for one call, and where the calls the model made land. */
export type ToolUse = { tools: unknown[]; calls: Call[]; model?: string };
export type Usage = { prompt_tokens?: number; completion_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number }; prompt_tokens_details?: { cached_tokens?: number } };

export const ready = () => !!(process.env.LLM_BASE_URL && process.env.LLM_API_KEY && process.env.LLM_MODEL);

export async function logUsage(kind: string, match: number | string, u: Usage | undefined, ms: number, extra: Record<string, unknown> = {}, model = process.env.LLM_MODEL, text = "") {
  const [pin, pout] = PRICE[model ?? ""] ?? [5, 15];
  const cost = ((u?.prompt_tokens ?? 0) * pin + (u?.completion_tokens ?? 0) * pout) / 1e6;
  addSpent(cost);
  aiGeneration({ kind, match, model, input: u?.prompt_tokens ?? 0, output: u?.completion_tokens ?? 0, ms, cost, text });
  await mkdir(CACHE, { recursive: true });
  await appendFile(join(CACHE, "usage.jsonl"), JSON.stringify({ at: new Date().toISOString(), kind, match, model, prompt: u?.prompt_tokens ?? 0, completion: u?.completion_tokens ?? 0, reasoning: u?.completion_tokens_details?.reasoning_tokens ?? 0, cached: u?.prompt_tokens_details?.cached_tokens ?? 0, cost: Number(cost.toFixed(6)), ms, ...extra }) + "\n");
}

function body(messages: Msg[], stream: boolean, tools?: unknown[], model = process.env.LLM_MODEL) {
  const effort = process.env.LLM_REASONING_EFFORT ?? "low";
  return JSON.stringify({
    model,
    messages,
    max_tokens: MAX,
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
    ...(tools?.length ? { tools } : {}),
    ...(effort && effort !== "default" ? { reasoning_effort: effort } : {}),
  });
}

const url = () => `${(process.env.LLM_BASE_URL ?? "").replace(/\/$/, "")}/chat/completions`;
const headers = () => ({ Authorization: `Bearer ${process.env.LLM_API_KEY}`, "Content-Type": "application/json" });

/** One answer, whole. */
export async function museOnce(messages: Msg[], kind: string, match: number | string, signal?: AbortSignal) {
  const t = Date.now();
  const r = await fetch(url(), { method: "POST", headers: headers(), body: body(messages, false), signal });
  if (!r.ok) throw new Error(`Muse ${r.status}`);
  const j = await r.json();
  await logUsage(kind, match, j.usage, Date.now() - t, { finish: j.choices?.[0]?.finish_reason }, process.env.LLM_MODEL, String(j.choices?.[0]?.message?.content ?? ""));
  return String(j.choices?.[0]?.message?.content ?? "");
}

/** The answer as text deltas; usage is logged when the stream ends. */
export async function* museStream(messages: Msg[], kind: string, match: number | string, signal?: AbortSignal, use?: ToolUse) {
  const t = Date.now();
  const r = await fetch(url(), { method: "POST", headers: headers(), body: body(messages, true, use?.tools, use?.model ?? process.env.LLM_MODEL), signal });
  if (!r.ok || !r.body) throw new Error(`Muse ${r.status}`);
  const dec = new TextDecoder();
  let buf = "";
  let usage: Usage | undefined;
  let finish: string | undefined;
  let text = "";
  const reader = r.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const j = JSON.parse(data);
          if (j.usage) usage = j.usage;
          if (j.choices?.[0]?.finish_reason) finish = j.choices[0].finish_reason;
          const delta = j.choices?.[0]?.delta?.content;
          if (delta) { text += delta; yield String(delta); }
          // tool calls come in pieces by index: the first piece has the id and name, the rest add to the arguments
          for (const c of j.choices?.[0]?.delta?.tool_calls ?? []) {
            if (!use) break;
            const i = c.index ?? use.calls.length;
            use.calls[i] ??= { id: "", type: "function", function: { name: "", arguments: "" } };
            if (c.id) use.calls[i].id = c.id;
            if (c.function?.name) use.calls[i].function.name += c.function.name;
            if (c.function?.arguments) use.calls[i].function.arguments += c.function.arguments;
          }
        } catch {
          // a keep-alive or a broken chunk: skip it
        }
      }
    }
  } finally {
    await logUsage(kind, match, usage, Date.now() - t, { finish, ...(use?.calls.length ? { tools: use.calls.map((c) => c.function.name) } : {}) }, use?.model ?? process.env.LLM_MODEL, text);
  }
}

/** A demo match, or the visitor's own one as the Crux API gives it to this visitor's cookie; null for anything else. */
export async function loadMatch(id: string, req: Request): Promise<Data | null> {
  try {
    return (await getMatch(id, req))?.data ?? null;
  } catch {
    return null;
  }
}

let gloss: string | null = null;
export async function glossary() {
  gloss ??= await readFile(join(process.cwd(), "public", "dota", "glossary.md"), "utf8").catch(() => "");
  return gloss;
}

const mem = new Map<string, string>();
const file = (id: string, key: string) => join(CACHE, "explain", id, `${key.replace(/[^a-z0-9_-]/gi, "_")}.txt`);

export async function cached(id: string, key: string) {
  const k = `${id}:${key}`;
  if (mem.has(k)) return mem.get(k)!;
  try {
    const t = await readFile(file(id, key), "utf8");
    mem.set(k, t);
    return t;
  } catch {
    return null;
  }
}

export async function remember(id: string, key: string, text: string) {
  mem.set(`${id}:${key}`, text);
  await mkdir(join(CACHE, "explain", id), { recursive: true });
  await writeFile(file(id, key), text, "utf8");
}
