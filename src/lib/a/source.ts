import { createHash } from "node:crypto";
import type { Tier } from "./guard";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Lang } from "./i18n";
import { MATCHES, type Data } from "./types";

// Where a match of /a comes from. The demo matches ship with the app in public/a. Any other match is the visitor's own
// analysis: it is asked from the Crux API with the visitor's cookie, so the API's owner rule decides and another
// visitor gets nothing. Nothing of the API's answer is cached across cookies.

export type Tx = Partial<Record<Lang, Record<string, string>>>;
// pro: the visitor has Crux Pro; muse: the coach of this page was written by Muse (false: built from the numbers).
// side: whose team the review is told from (the player's own slot, or none yet: the visitor picks a hero); choose: ask for the pick.
export type Side = { slot: number | null; team: number | null; won: boolean | null; view: string; fallback: boolean; choose: boolean; heroes: { slot: number; hero: string | null; team: number | null }[]; game_mode?: number | null };
export type Got = { data: Data; layout: Partial<Record<Lang, string>>; tx: Tx | null; demo: boolean; pro: boolean; muse: boolean; shared?: boolean; side?: Side };

const API = (process.env.CRUX_API ?? "").replace(/\/$/, "");
const TTL = 60_000;
const mem = new Map<string, { at: number; v: Got | null }>();

export const validId = (id: string) => /^[1-9][0-9]{5,11}$/.test(id);
export const isDemo = (id: string) => MATCHES.includes(Number(id));

const pub = (f: string) => join(process.cwd(), "public", "a", f);
const opt = (f: string) => readFile(pub(f), "utf8").catch(() => null);

export async function getDemo(id: string): Promise<Got | null> {
  try {
    const data = JSON.parse(await readFile(pub(`${id}.json`), "utf8")) as Data;
    const [ru, en, zh, uk, tx] = await Promise.all([opt(`${id}.layout.txt`), opt(`${id}.en.layout.txt`), opt(`${id}.zh.layout.txt`), opt(`${id}.uk.layout.txt`), opt(`${id}.tx.json`)]);
    const layout: Got["layout"] = {};
    if (ru) layout.ru = ru;
    if (en) layout.en = en;
    if (zh) layout.zh = zh;
    if (uk) layout.uk = uk;
    return { data, layout, tx: tx ? (JSON.parse(tx) as Tx) : null, demo: true, pro: false, muse: true };
  } catch {
    return null;
  }
}

// Only the Crux cookies go upstream: ax_sid is ours, the rest is the visitor's Crux session.
const crux = (cookie: string) => cookie.split(/;\s*/).filter((c) => c && !c.startsWith("ax_sid=")).join("; ");

/** The visitor's own analysis of this match is still in the queue or running. */
export class Pending extends Error {}

async function api(id: string, cookie: string): Promise<Got | null> {
  if (!API) return null;
  const r = await fetch(`${API}/api/matches/${id}/a`, { headers: { accept: "application/json", ...(cookie ? { cookie } : {}) }, signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (r.status === 409) throw new Pending();
  if (r.status === 404 || r.status === 403) return null;
  if (!r.ok) throw new Error(`crux ${r.status}`);
  const j = (await r.json()) as { data: Data & { pipeline?: { muse?: boolean } }; layout?: Got["layout"]; tx?: Tx | null; viewer?: { pro?: boolean }; side?: Side };
  if (!j?.data?.match || Number(j.data.match.match_id) !== Number(id)) return null;
  return { data: j.data, layout: j.layout ?? {}, tx: j.tx ?? null, demo: false, pro: !!j.viewer?.pro, muse: j.data.pipeline?.muse !== false, side: j.side };
}

/** The visitor picked a hero: the cached answers of this match are stale. */
export const forgetMatch = (id: string) => { for (const k of [...mem.keys()]) if (k.startsWith(`${id}:`)) mem.delete(k); };

/** Tell the Crux API which hero is the visitor's. */
export async function setSide(id: string, slot: number, req: Request): Promise<boolean> {
  if (!API || !validId(id)) return false;
  const cookie = crux(req.headers.get("cookie") ?? "");
  const r = await fetch(`${API}/api/matches/${id}/side`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", origin: new URL(API).origin, ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ slot }), signal: AbortSignal.timeout(15_000), cache: "no-store" });
  forgetMatch(id);
  return r.ok;
}

/** May Muse talk about this match for this visitor: demo matches and Pro always; the rest only on a page Muse wrote
 * (the chat there runs on the free word budget of guard.ts). */
/** Whose budget a Muse call of this page comes from (guard.ts SHARE), and the visitor's own hero when the page is told from their team. */
export async function tierOf(id: string, req: Request): Promise<{ tier: Tier; slot: number | null } | null> {
  const g = await getMatch(id, req).catch(() => null);
  if (!g) return null;
  const s = g.side?.slot;
  const mine = s != null && g.data.heroes[String(s)]?.own ? s : null;
  return { tier: g.demo ? "demo" : g.pro ? "pro" : "own", slot: mine };
}

export async function museAllowed(id: string, req: Request, what: "chat" | "explain" | "layout") {
  const g = await getMatch(id, req).catch(() => null);
  if (!g) return false;
  if (g.demo || g.pro) return true;
  return g.muse;
}

/** The match for this request, or null when it does not exist or is not the visitor's. */
export async function getMatch(id: string, req: Request): Promise<Got | null> {
  if (!validId(id)) return null;
  if (isDemo(id)) return getDemo(id);
  const cookie = crux(req.headers.get("cookie") ?? "");
  const k = `${id}:${createHash("sha256").update(cookie).digest("hex")}`;
  const hit = mem.get(k);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  const v = await api(id, cookie);
  if (mem.size > 200) mem.delete(mem.keys().next().value!);
  mem.set(k, { at: Date.now(), v });
  return v;
}
