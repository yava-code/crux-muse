import type { Data as Base } from "../beta3/types";
import { clock, tx } from "../beta3/types";
import { dt } from "./dtx";
import { dec, kUnit, lang } from "./i18n";

export type AllFight = {
  id: string; t0: number; t1: number; pp: number; prep: number; exec: number; rest: number; v0: number; alive: string; minor: boolean;
  events: string[]; heroes: { slot: number; prep: number; exec: number; parts: Record<string, number> }[]; died: number[];
  concepts: { concept: string; pp: number; fact: string }[];
};
export type WhatIf = {
  fight: string; cost: number; concepts: { concept: string; name: string; gain: number; fact: string }[];
  heroes: { slot: number; hero: string; gain: number }[]; note: string | null;
};
export type Link = { kind: "death_before" | "fight_then_building" | "drift"; t: number; fight: string | null; pp: number; text: string };
export type Signals = {
  bkb: { own_first: number | null; enemy_first: number | null; own_count: number; enemy_count: number };
  vision: { own_wards: number; enemy_wards: number };
  gold: { max_lead: number; max_deficit: number; at_end: number };
  lead: { max_chance: number; at: number; thrown: boolean };
  deaths_before: { links: number; cost: number };
};
export type HeroCardFull = Base["hero_cards"][string] & { roles: string[]; attack: string };
export type Data = Omit<Base, "hero_cards"> & {
  hero_cards: Record<string, HeroCardFull>;
  all_fights: AllFight[];
  totals: { slot: number; prep: number; exec: number; deaths: number; fights: number; worst: { id: string; t0: number; pp: number } }[];
  bkb: Record<string, number>;
  nw: number[][];
  whatif: WhatIf[];
  chain: Link[];
  signals: Signals;
};

export const MATCHES = [9046629289, 9044260215, 9047148163, 9047768802, 9047575705, 9041117598, 9041117905, 9041117982, 9041118346, 9041118506];

export const PICS = ["bkb", "nw", "lead", "vision", "deaths", "frame"] as const;
export type Pic = (typeof PICS)[number];

export const fightOf = (d: Data, id: string | null | undefined) => d.all_fights.find((f) => f.id === id);
export const momentOf = (d: Data, id: string | null | undefined) => d.moments.find((m) => m.fight.id === id);
export const whatifOf = (d: Data, id: string) => d.whatif.find((w) => w.fight === id);
export const after = (v0: number, cost: number) => Math.max(0, Math.min(100, Math.round(v0 + cost)));
export const own = (d: Data) => (d.match.team === "Radiant" ? 2 : 3);
export const ownSlots = (d: Data) => Object.entries(d.heroes).filter(([, h]) => h.own).map(([s]) => Number(s));

/** Each chain link gets a stable id by its position: c0, c1, ... Muse refers to them by it. */
export const linkId = (i: number) => `c${i}`;
export const linkAt = (d: Data, id: string) => {
  const i = Number(/^c(\d+)$/.exec(id)?.[1] ?? -1);
  return i >= 0 && i < d.chain.length ? d.chain[i] : undefined;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const pl3 = (n: number, a: string, b: string, c: string) => (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c);
function lost(text: string, ln = lang()) {
  const out: string[] = [];
  for (const m of text.matchAll(/(\d+) (башн|барак)/g)) {
    const n = Number(m[1]);
    const tower = m[2] === "башн";
    out.push(ln === "zh" ? `${n} 座${tower ? "塔" : "兵营"}` : ln === "es" ? `${n} ${tower ? plural(n, "torre", "torres") : plural(n, "barracón", "barracones")}` : ln === "uk" ? `${n} ${tower ? pl3(n, "вежу", "вежі", "веж") : pl3(n, "барак", "бараки", "бараків")}` : `${n} ${tower ? plural(n, "tower", "towers") : "barracks"}`);
  }
  return out.join(ln === "zh" ? "、" : ", ");
}

/** The drift text in the data has its two times swapped; it is rebuilt here from the link itself. Russian for Muse,
 * the reader's language for the page. */
export function linkText(d: Data, l: Link, ln = lang()) {
  const f = fightOf(d, l.fight);
  if (ln === "uk") {
    if (l.kind === "drift") return `шанс просів на ${Math.round(-l.pp)} між боями, з ${clock(l.t)}`;
    if (l.kind === "fight_then_building") {
      const at = /после драки (\d+:\d+)/.exec(l.text)?.[1] ?? (f ? clock(f.t0) : "");
      const sec = Number(/за (\d+) с/.exec(l.text)?.[1] ?? 90);
      return `після бою о ${at} втрачено ${lost(l.text, ln)} ${sec === 90 ? "за півтори хвилини" : `за ${sec} с`}`;
    }
    const m = /^(.+?) умер в (\d+:\d+) и не успел возродиться к драке (\d+:\d+)/.exec(l.text);
    if (m) return `${m[1]} помер о ${m[2]} і не встиг повернутися до бою ${m[3]}`;
    return f ? `смерть до бою ${clock(f.t0)}` : dt(l.text, ln);
  }
  if (ln === "es") {
    if (l.kind === "drift") return `la probabilidad bajó ${Math.round(-l.pp)} entre peleas, desde ${clock(l.t)}`;
    if (l.kind === "fight_then_building") {
      const at = /после драки (\d+:\d+)/.exec(l.text)?.[1] ?? (f ? clock(f.t0) : "");
      const sec = Number(/за (\d+) с/.exec(l.text)?.[1] ?? 90);
      return `tras la pelea de las ${at} se perdió ${lost(l.text, ln)} ${sec === 90 ? "en minuto y medio" : `en ${sec} s`}`;
    }
    const m = /^(.+?) умер в (\d+:\d+) и не успел возродиться к драке (\d+:\d+)/.exec(l.text);
    if (m) return `${m[1]} murió a las ${m[2]} y no volvió a tiempo para la pelea de las ${m[3]}`;
    return f ? `muerte antes de la pelea de las ${clock(f.t0)}` : dt(l.text, ln);
  }
  if (ln !== "ru") {
    if (l.kind === "drift") return ln === "en" ? `chance dropped by ${Math.round(-l.pp)} between fights, from ${clock(l.t)}` : `两场团战之间胜率下降 ${Math.round(-l.pp)}，从 ${clock(l.t)} 开始`;
    if (l.kind === "fight_then_building") {
      const at = /после драки (\d+:\d+)/.exec(l.text)?.[1] ?? (f ? clock(f.t0) : "");
      const sec = Number(/за (\d+) с/.exec(l.text)?.[1] ?? 90);
      const win = ln === "en" ? (sec === 90 ? "within a minute and a half" : `within ${sec} s`) : sec === 90 ? "一分半内" : `${sec} 秒内`;
      return ln === "en" ? `after the fight at ${at} lost ${lost(l.text)} ${win}` : `${at} 的团战后${win}丢了 ${lost(l.text)}`;
    }
    const m = /^(.+?) умер в (\d+:\d+) и не успел возродиться к драке (\d+:\d+)/.exec(l.text);
    if (m) return ln === "en" ? `${m[1]} died at ${m[2]} and was not back for the fight at ${m[3]}` : `${m[1]} 在 ${m[2]} 阵亡，没赶上 ${m[3]} 的团战`;
    return f ? (ln === "en" ? `death before the fight at ${clock(f.t0)}` : `${clock(f.t0)} 团战前阵亡`) : dt(l.text, ln);
  }
  if (l.kind === "drift") return `шанс просел на ${Math.round(-l.pp)} между драками, с ${clock(l.t)}`;
  if (l.kind === "fight_then_building") return l.text.replace(/ за 90 с$/, " за полторы минуты");
  const m = /^(.+?) умер в (\d+:\d+) и не успел возродиться к драке (\d+:\d+)/.exec(l.text);
  return m ? `${m[1]} умер в ${m[2]} и не вернулся к драке ${m[3]}` : f ? `смерть до драки ${clock(f.t0)}` : l.text;
}

export const pct = (x: number) => `${Math.round(x)}%`;
export const signed = (x: number, dd = 1) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${dec(Math.abs(x), dd)}`;
export const kgold = (n: number) => `${dec(Math.abs(n) / 1000, 1)}${kUnit()}`;

/** A coach or engine line for the page: in the reader's language, fight ids as clock times, decimals as the language writes them. */
export function say(s: string, fights: { id: string; t0: number }[]) {
  if (!s) return "";
  if (lang() === "ru") return tx(s, fights);
  return dt(s)
    .replace(/f(\d+)/g, (m) => { const f = fights.find((x) => x.id === m); return f ? clock(f.t0) : m; })
    .replace(/(^|[\s(])-(\d)/g, "$1−$2")
    .replace(/\s*—\s*/g, ", ");
}

/** The coach's lines of a main fight; some fights came without them, then the card leans on the numbers alone. */
export function coachOf(m: Data["moments"][number]) {
  const c = (m.coach ?? {}) as Partial<Data["moments"][number]["coach"]>;
  const s = (x: unknown) => (typeof x === "string" ? x : "");
  return { verdict: s(c.verdict) || `Драка ${m.fight.alive}`, instead: s(c.instead), what: s(c.what), why: s(c.why), do: s(c.do) };
}
