import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { hasAllowedOrigin } from "@/lib/same-origin";

// Abuse guard for /api/a/*: who is asking (IP and a session cookie), how often (per minute, hour, day), and how much
// Muse may cost per day across everyone. State lives in this process: one server is the deploy target; a
// serverless deploy needs the same three maps in a shared store (Redis/KV) behind these functions.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
type Rule = [number, number][];
export type Kind = "any" | "layout" | "explain" | "chat" | "od" | "me" | "fb" | "share" | "ev" | "card" | "og" | "av" | "pub" | "roast";

// [count, window]; ip and sid both have to pass.
const LIMITS: Record<Kind, { ip: Rule; sid: Rule }> = {
  any: { ip: [[120, MIN], [2000, HOUR]], sid: [[100, MIN]] },
  layout: { ip: [[2, MIN], [6, HOUR], [12, DAY]], sid: [[1, MIN], [4, HOUR], [8, DAY]] },
  explain: { ip: [[12, MIN], [80, HOUR], [300, DAY]], sid: [[8, MIN], [60, HOUR], [200, DAY]] },
  chat: { ip: [[6, MIN], [40, HOUR], [150, DAY]], sid: [[4, MIN], [30, HOUR], [100, DAY]] },
  od: { ip: [[40, MIN], [400, HOUR], [2000, DAY]], sid: [[40, MIN]] },
  me: { ip: [[6, MIN], [40, HOUR], [150, DAY]], sid: [[4, MIN], [20, HOUR]] },
  fb: { ip: [[10, MIN], [60, HOUR], [200, DAY]], sid: [[6, MIN], [40, HOUR], [120, DAY]] },
  share: { ip: [[6, MIN], [30, HOUR], [100, DAY]], sid: [[4, MIN], [20, HOUR], [40, DAY]] },
  ev: { ip: [[30, MIN], [300, HOUR]], sid: [[20, MIN], [200, HOUR]] },
  card: { ip: [[3, MIN], [20, HOUR], [60, DAY]], sid: [[2, MIN], [10, HOUR], [20, DAY]] },
  og: { ip: [[20, MIN], [200, HOUR]], sid: [[20, MIN]] },
  av: { ip: [[20, MIN], [200, HOUR]], sid: [[10, MIN], [60, HOUR]] },
  pub: { ip: [[10, MIN], [80, HOUR], [400, DAY]], sid: [[6, MIN], [40, HOUR]] },
  roast: { ip: [[10, MIN], [60, HOUR], [300, DAY]], sid: [[6, MIN], [40, HOUR], [150, DAY]] },
};
/** Chat questions per session per match per day. */
export const CHAT_PER_MATCH = 20;

// The chat is capped by words a day rather than by questions: one long exchange or a few short ones. Each call also
// pays a flat CALL_WORDS, since the match data in the prompt costs the same for a short question.
export const CHAT_WORDS: Record<Tier, number> = { demo: 1000, own: 1000, pro: 12000 };
export const CALL_WORDS = 40;
const said = new Map<string, { day: string; n: number }>();
export const wordsOf = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) ?? []).length;
/** Words of the text a reader sees in an OpenUI answer: its string literals with a space inside. */
export const answerWords = (a: string) => [...a.matchAll(/"((?:[^"\\]|\\.)*)"/g)].filter((m) => m[1].includes(" ")).reduce((n, m) => n + wordsOf(m[1]), 0);
const used = (k: string) => {
  const v = said.get(k);
  return v && v.day === today() ? v.n : 0;
};
/** Words left today for this ip and session: the smaller of the two. */
export const wordsLeft = (ip: string, sid: string, tier: Tier) => Math.max(0, CHAT_WORDS[tier] - Math.max(used(`ip:${ip}`), used(`sid:${sid}`)));
export function spendWords(ip: string, sid: string, n: number) {
  if (said.size > MAX_KEYS) said.clear();
  for (const k of [`ip:${ip}`, `sid:${sid}`]) said.set(k, { day: today(), n: used(k) + n });
}
export const Q_MAX = 500;

const hits = new Map<string, number[]>();
const MAX_KEYS = 50_000;

function allow(key: string, rule: Rule, now: number) {
  const span = Math.max(...rule.map((r) => r[1]));
  const ts = (hits.get(key) ?? []).filter((t) => now - t < span);
  for (const [n, w] of rule) if (ts.filter((t) => now - t < w).length >= n) {
    hits.set(key, ts);
    return false;
  }
  ts.push(now);
  if (!hits.has(key) && hits.size >= MAX_KEYS) hits.delete(hits.keys().next().value!);
  hits.set(key, ts);
  return true;
}

/** Spends one request of `kind` for this ip and session; false when any window is full. */
export function take(kind: Kind, ip: string, sid: string, extra?: { key: string; rule: Rule }) {
  const now = Date.now();
  const l = LIMITS[kind];
  if (!allow(`${kind}:ip:${ip}`, l.ip, now)) return false;
  if (!allow(`${kind}:sid:${sid}`, l.sid, now)) return false;
  if (extra && !allow(`${kind}:x:${extra.key}`, extra.rule, now)) return false;
  return true;
}
export const perMatchDay = (n: number): Rule => [[n, DAY]];

// The client IP as the edge proxy wrote it. Behind our own proxy, it must overwrite these headers, not append.
export function ipOf(req: Request) {
  const h = req.headers;
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "";
  return ip.trim().slice(0, 64) || "local";
}

const SID = /^[a-f0-9]{32}$/;
/** The session id from the cookie, or a new one that the response has to set. */
export function sidOf(req: Request) {
  const m = /(?:^|;\s*)ax_sid=([^;]+)/.exec(req.headers.get("cookie") ?? "");
  if (m && SID.test(m[1])) return { sid: m[1], fresh: false };
  return { sid: randomBytes(16).toString("hex"), fresh: true };
}
export const sidCookie = (sid: string) =>
  `ax_sid=${sid}; Path=/; Max-Age=${60 * 60 * 24 * 30}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;

// Daily spend: summed from .a-cache/usage.jsonl and the copy in the bucket (the instance disk goes with a cold start),
// then kept up to date by every logged call.
//
// Who may spend how much of the day: the demo match that every new visitor opens takes at most a third, a free visitor's
// own match stops at 70%, and the rest is kept for Crux Pro, so a Reddit crowd on the demo never locks out the people who
// pay. Answers to a first question are shared between visitors of the same page (chat), so the starters of the demo cost
// one call each per day and language.
const BUDGET = Number(process.env.A_DAILY_USD ?? 1);
const EST = 0.004;
export type Tier = "demo" | "own" | "pro";
const SHARE: Record<Tier, number> = { demo: 0.35, own: 0.7, pro: 1 };
let day = "";
let spent = 0;
let flying = 0;
let loaded: Promise<void> | null = null;
let saveT: ReturnType<typeof setTimeout> | null = null;

const today = () => new Date().toISOString().slice(0, 10);
async function load() {
  day = today();
  spent = 0;
  try {
    const txt = await readFile(join(process.env.A_CACHE_DIR || join(process.cwd(), ".a-cache"), "usage.jsonl"), "utf8");
    for (const l of txt.split("\n")) if (l.startsWith(`{"at":"${day}`)) spent += Number(/"cost":([\d.e-]+)/.exec(l)?.[1] ?? 0);
  } catch {
    // no log yet
  }
  try {
    const { kvGet } = await import("./kv");
    spent = Math.max(spent, Number(await kvGet(`spend/${day}.txt`)) || 0);
  } catch {
    // no bucket here
  }
}
const fresh = async () => {
  if (day !== today()) loaded = null;
  await (loaded ??= load());
};

export const addSpent = (usd: number) => {
  if (day !== today()) return;
  spent += usd;
  saveT ??= setTimeout(() => {
    saveT = null;
    const d = day, v = spent.toFixed(5);
    import("./kv").then(({ kvPut }) => kvPut(`spend/${d}.txt`, v)).catch(() => {});
  }, 15_000);
};
/** True while today's Muse spend plus the calls in flight stays under this tier's share of A_DAILY_USD. */
export async function budgetOk(tier: Tier = "pro") {
  await fresh();
  return spent + flying * EST < BUDGET * SHARE[tier];
}
/** Holds a slot of the budget while a Muse call runs. */
export function hold() {
  flying++;
  let done = false;
  return () => { if (!done) { done = true; flying--; } };
}
export async function budgetState() {
  await fresh();
  return { day, spent: Number(spent.toFixed(4)), budget: BUDGET };
}

export type Code = "origin" | "rate" | "words" | "day" | "budget" | "bad" | "long" | "down" | "missing" | "pro" | "off" | "pending";
const STATUS: Record<Code, number> = { origin: 403, rate: 429, words: 429, day: 429, budget: 503, bad: 400, long: 413, down: 502, missing: 404, pro: 402, off: 410, pending: 409 };
/** Every refusal is a short code; the page turns it into words. No internal message reaches the client. */
export const fail = (code: Code, sid?: { sid: string; fresh: boolean }) =>
  Response.json({ error: { code } }, { status: STATUS[code], headers: sid?.fresh ? { "Set-Cookie": sidCookie(sid.sid) } : undefined });

/** Origin check, the flood limit and the session for any /api/a request. */
export function gate(req: Request) {
  const sid = sidOf(req);
  const ip = ipOf(req);
  if (!hasAllowedOrigin(req)) return { stop: fail("origin"), ip, sid };
  if (!take("any", ip, sid.sid)) return { stop: fail("rate", sid), ip, sid };
  return { stop: null, ip, sid };
}

/** The JSON body, refused above `max` bytes. */
export async function body<T>(req: Request, max = 4096): Promise<T | null> {
  if (Number(req.headers.get("content-length") ?? 0) > max) return null;
  try {
    const t = await req.text();
    return t.length > max ? null : (JSON.parse(t) as T);
  } catch {
    return null;
  }
}

export const withSid = (headers: Record<string, string>, sid: { sid: string; fresh: boolean }) =>
  sid.fresh ? { ...headers, "Set-Cookie": sidCookie(sid.sid) } : headers;
