import spec from "@/generated/a-spec.json";
import { generateSystemPrompt, type LibrarySpec } from "@openuidev/lang-core";
import { layoutView } from "./context";
import { budgetOk, hold, take, type Tier } from "./guard";
import type { Lang } from "./i18n";
import { kvGet, kvPut } from "./kv";
import { glossary, museOnce, ready } from "./muse";
import { reviewOptionsFor } from "./prompt-options";
import type { Got, Tx } from "./source";
import type { Data } from "./types";

// What a fresh match lacks: the backend makes the Russian layout with the analysis; English and Chinese layouts and the
// translations of the coach's sentences are made here the first time someone opens that language, then kept (kv.ts)
// for every later visitor of the same match. Same prompts as scripts/a-layouts.mjs and scripts/a-tx.mjs.

const systems = new Map<Lang, string>();
export const layoutSystem = (l: Lang) => {
  if (!systems.has(l)) systems.set(l, generateSystemPrompt({ library: spec as LibrarySpec, promptOptions: reviewOptionsFor(l) }));
  return systems.get(l)!;
};
export const ASK: Record<Lang, string> = { ru: "Собери вкладку «Разбор» для этого матча.", en: "Build the Review tab for this match, all phrases in English.", zh: "为这场比赛生成“复盘”页，所有文字用简体中文。", uk: "Збери вкладку «Розбір» для цього матчу, усі фрази українською.", es: "Arma la pestaña «Análisis» para este partido, todas las frases en español latinoamericano." };
export const layoutPrompt = async (d: Data, l: Lang) => `${layoutSystem(l)}\n\nGLOSSARY:\n${await glossary()}\n\nMATCH DATA:\n${layoutView(d)}`;

const flying = new Map<string, Promise<string | null>>();
function once(k: string, run: () => Promise<string | null>) {
  let p = flying.get(k);
  if (!p) {
    p = run().finally(() => flying.delete(k));
    flying.set(k, p);
  }
  return p;
}

type Who = { ip: string; sid: string };
const tierOfGot = (g: Got): Tier => (g.demo ? "demo" : g.pro ? "pro" : "own");
const fence = (t: string) => (/```[a-z-]*\n([\s\S]*?)```/.exec(t)?.[1] ?? t).trim();

/** The layout of the Разбор tab in this language, made by Muse on the first ask; null when it cannot be had now. */
export async function layoutFor(id: string, l: Lang, got: Got, who: Who): Promise<string | null> {
  if (got.layout[l]) return got.layout[l]!;
  if (got.demo || !got.muse) return null;
  const key = `layout/${id}${got.data.match.won ? ".w" : ""}.${l}.txt`;
  const have = await kvGet(key);
  if (have) return have;
  if (!ready() || !take("layout", who.ip, who.sid) || !(await budgetOk(tierOfGot(got)))) return null;
  return once(key, async () => {
    const free = hold();
    try {
      const code = fence(await museOnce([{ role: "system", content: await layoutPrompt(got.data, l) }, { role: "user", content: ASK[l] }], `layout-demand-${l}`, id));
      if (!code) return null;
      await kvPut(key, code + "\n");
      return code + "\n";
    } catch (e) {
      console.error("a/gen layout", e);
      return null;
    } finally {
      free();
    }
  });
}

const sentences = (s: string) => (s.match(/[^.!?]+[.!?]*\s*/g) ?? [s]).map((x) => x.trim()).filter(Boolean);
function lines(d: Data) {
  const out = new Set<string>([d.coach.headline]);
  for (const m of d.moments) {
    const c = (m.coach ?? {}) as Record<string, unknown>;
    for (const k of ["verdict", "instead", "why", "do"]) if (typeof c[k] === "string" && c[k]) out.add((c[k] as string).trim());
    if (typeof c.what === "string") sentences(c.what).forEach((x) => out.add(x));
  }
  return [...out].filter((s) => /[а-яё]/i.test(s));
}

const NAME = { en: "English", zh: "Simplified Chinese", uk: "Ukrainian", es: "Latin American Spanish" } as const;
const txSystem = (l: "en" | "zh" | "uk" | "es", heroes: string[]) => [
  `You translate lines of a Dota 2 coaching product from Russian into ${NAME[l]}. The reader is a new or average player.`,
  "Return only a JSON array of strings, one translation per input line, same order, same count.",
  `Keep every number, time (30:49), percent and fight id (f28) exactly as written. Write decimals with a ${l === "uk" || l === "es" ? "comma" : "dot"}.`,
  `Hero, item and ability names stay in official English: ${heroes.join(", ")}, BKB, TP, Roshan, Smoke.`,
  l === "en"
    ? "Plain short game English, like a strong player talking to a teammate. 'п.п.' means points of win chance: write 'pts'. No em dashes, no exclamation marks."
    : l === "es"
      ? "Plain short natural Latin American Spanish, like a strong player talking to a teammate, address the player as 'tú'. Dota terms as Spanish-speaking players say them: carry, mid, offlane, support, guardianes, humo, buyback, ulti, TP, valor neto, last hits. A fight is 'pelea'. 'п.п.' means points of win chance: write 'pts'. No em dashes, no exclamation marks."
    : l === "uk"
      ? "Plain short natural Ukrainian, like a strong player talking to a teammate, no Russian words and no surzhyk. Dota terms as Ukrainian players say them: керрі, мід, оффлейн, саппорт, вард, смок, байбек, ульт, ТП, нетворс, ласт-хіти. A fight is 'бій'. 'п.п.' means points of win chance: keep 'п.п.'. No em dashes, no exclamation marks."
      : "用简洁口语化的中文，像高分玩家给队友讲解。英雄、物品和技能名保留英文。“п.п.”是胜率百分点，写作“个百分点”。不要用破折号和感叹号。",
  "Do not add facts, do not drop facts, do not explain.",
].join("\n");
const nums = (s: string) => (s.match(/\d+:\d\d|\d+(?:[.,]\d+)?/g) ?? []).map((x) => x.replace(",", ".")).sort().join(" ");
const fids = (s: string) => (s.match(/\bf\d+\b/g) ?? []).sort().join(" ");
// Ukrainian is Cyrillic too: what betrays an untranslated line there is a letter only Russian has, or the line itself.
const fits = (ru: string, tr: unknown, l: Lang): tr is string =>
  typeof tr === "string" && !!tr.trim() && (l === "uk" ? tr.trim() !== ru.trim() && !/[ыэъё]/i.test(tr) : !/[а-яё]/i.test(tr)) && nums(ru) === nums(tr) && fids(ru) === fids(tr) && !tr.includes("—");
const arr = (t: string) => {
  try {
    const m = /\[[\s\S]*\]/.exec(t);
    return m ? (JSON.parse(m[0]) as unknown[]) : null;
  } catch {
    return null;
  }
};

/** Translations of the coach's sentences into this language: what the match came with, what was made before, and the rest now. */
export async function txFor(id: string, l: Lang, got: Got, who: Who): Promise<Tx> {
  const base: Tx = { ...(got.tx ?? {}) };
  if (l === "ru" || got.demo || !got.muse) return base;
  const key = `tx/${id}.json`;
  const kept = JSON.parse((await kvGet(key)) ?? "{}") as Tx;
  const done = { ...(kept[l] ?? {}), ...(base[l] ?? {}) };
  const todo = lines(got.data).filter((s) => !done[s]);
  if (!todo.length || !ready() || !take("explain", who.ip, who.sid) || !(await budgetOk(tierOfGot(got)))) return { ...kept, ...base, [l]: done };
  await once(`${key}:${l}`, async () => {
    const free = hold();
    try {
      const heroes = Object.values(got.data.heroes).map((h) => (h as { hero: string }).hero);
      const out = arr(await museOnce([{ role: "system", content: txSystem(l, heroes) }, { role: "user", content: JSON.stringify(todo) }], `tx-${l}`, id));
      if (out && out.length === todo.length) todo.forEach((ru, i) => { const tr = out[i]; if (fits(ru, tr, l)) done[ru] = tr.trim().replace(/!/g, "."); });
      const now = JSON.parse((await kvGet(key)) ?? "{}") as Tx;
      await kvPut(key, JSON.stringify({ ...now, [l]: { ...(now[l] ?? {}), ...done } }));
    } catch (e) {
      console.error("a/gen tx", e);
    } finally {
      free();
    }
    return null;
  });
  return { ...kept, ...base, [l]: done };
}
