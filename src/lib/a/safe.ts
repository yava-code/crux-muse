import { clean, strayNumbers } from "./context";
import type { Lang } from "./i18n";

// What Muse writes is checked before anyone sees it: every number must exist in the match, no links, no other
// alphabet than the reader's, nothing from the rules it was given.

const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|ru|net|org|io|gg|xyz|cn|me|app|dev)\b\S*/gi;
const cyr = /[а-яё]/i;
// Ukrainian is Cyrillic as well, so only the letters Russian alone has give a Russian line away.
const ruOnly = /[ыэъё]/i;
const BANNED: Record<Lang, RegExp | null> = {
  ru: null,
  en: /it is important to note|it's worth noting|as an ai|language model|system prompt/i,
  zh: /值得注意的是|作为(一个)?AI|语言模型|系统提示/i,
  es: /es importante (?:señalar|destacar|tener en cuenta)|cabe (?:señalar|destacar)|como (?:una )?(?:ia|inteligencia artificial)|modelo de lenguaje|prompt del sistema/i,
  uk: /важливо зазначити|варто зазначити|як (?:штучний інтелект|ші)|мовна модель|системн(?:ий|ого) промпт/i,
};

/** One phrase of an answer, or null when it must not be shown. */
export function phraseOk(s: string, nums: Set<string>, lang: Lang) {
  if (URL_RE.test(s)) { URL_RE.lastIndex = 0; return null; }
  URL_RE.lastIndex = 0;
  if (lang !== "ru" && (lang === "uk" ? ruOnly : cyr).test(s)) return null;
  if (BANNED[lang]?.test(s)) return null;
  return clean(s, nums);
}

/** Plain text answer ("Объясни"): sentences with a number from nowhere or a link are dropped, the rest stays. */
export function sentencesOk(text: string, nums: Set<string>, lang: Lang) {
  const parts = text.match(/[^.!?。！？\n]+[.!?。！？]*\s*/g) ?? [];
  return parts.map((p) => p.trim()).filter((p) => p && phraseOk(p, nums, lang) != null && !strayNumbers(p, nums).length).join(" ").trim();
}

// The chat may use a general Dota number ("BKB длится 9 с", "к 20 минуте"): the reader sees it marked as not from the
// match. A match time, a percent or a pile of numbers that the match does not have still drops the phrase: those are
// the made-up facts.
const pctOf = (s: string) => new Set([...s.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)].map((m) => m[1]));
export function looseOk(s: string, nums: Set<string>, lang: Lang, free: Set<string>) {
  const stray = strayNumbers(s, nums);
  const pc = pctOf(s);
  if (stray.length > 2 || stray.some((x) => x.includes(":") || pc.has(x))) return null;
  const ok = phraseOk(s, new Set([...nums, ...stray.map((x) => x.replace(".", ","))]), lang);
  if (ok != null) for (const x of stray) free.add(x);
  return ok;
}

// "BKB only at 33:54. Because of this he missed 2:27": every time is real, the link is not. An effect earlier than
// every time its cause names is made up, so that sentence goes.
const CAUSE = /(?:^|[\s,(«—-])(?:поэтому|из-за этого|из-за чего|вследствие|в результате|отсюда|через це|тому він|тому вона|тож|внаслідок|в результаті|саме тому|because of (?:this|that)|therefore|as a result|that's why|which is why|so (?:he|she|they|you))(?=$|[\s,.:;!?»])|因此|所以|导致/i;
const times = (s: string) => [...s.matchAll(/\b(\d{1,2}):(\d{2})\b/g)].map((m) => Number(m[1]) * 60 + Number(m[2]));
export function causeOk(s: string) {
  const ps = s.match(/.+?(?:[.!?。！？](?=\s|$)|$)/g) ?? [s];
  const out = ps.filter((p, i) => {
    const m = CAUSE.exec(p);
    if (!m) return true;
    const cause = [...times(p.slice(0, m.index)), ...(i ? times(ps[i - 1]) : [])];
    const eff = times(p.slice(m.index));
    return !cause.length || !eff.length || Math.min(...eff) >= Math.min(...cause) - 60;
  });
  return out.join("").trim();
}

/** One line of an OpenUI Lang chat answer. Bad string literals become empty, so the layout still parses. With `free`,
 * general numbers may stay and are collected there. */
export function lineOk(line: string, nums: Set<string>, lang: Lang, free?: Set<string>) {
  return line.replace(/"((?:[^"\\]|\\.)*)"/g, (all, s: string) => {
    if (!/[\s一-鿿]/.test(s) && !URL_RE.test(s)) { URL_RE.lastIndex = 0; return all; }
    URL_RE.lastIndex = 0;
    const raw = s.replace(/\\"/g, "'").replace(/\\n/g, " ");
    if ((free ? looseOk(raw, nums, lang, free) : phraseOk(raw, nums, lang)) == null) return '""';
    const c = causeOk(s);
    return c === s.trim() ? all : `"${c}"`;
  }).replace(/@(?!ToAssistant\()[A-Za-z]+\(/g, "@ToAssistant(");
}

/** The player's question as plain text: no control characters, no fence markers, at most `max` characters. */
// control characters, zero-width marks and bidi overrides
const CTRL = new RegExp("[" + [[0, 31], [127, 127], [0x200b, 0x200f], [0x2028, 0x202e]].map(([a, b]) => String.fromCharCode(a) + "-" + String.fromCharCode(b)).join("") + "]", "g");
export const question = (q: unknown, max: number) =>
  typeof q === "string" ? q.replace(CTRL, " ").replace(/<<<|>>>/g, " ").replace(/\s+/g, " ").trim().slice(0, max + 1) : "";

/** True when an answer repeats a long piece of the rules: the start of any rule line of 40+ characters. */
export function leaks(text: string, rules: string[], canary: string) {
  if (text.includes(canary)) return true;
  const flat = text.replace(/\s+/g, " ");
  return rules.some((r) => r.length >= 40 && flat.includes(r.slice(0, 40)));
}
