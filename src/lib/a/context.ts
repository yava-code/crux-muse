import { buildTracks, clock, ROLE, stateAt } from "../beta3/types";
import { after, coachOf, fightOf, kgold, linkId, linkText, ownSlots, pct, type Data, type Pic } from "./types";

// Plain text views of one match for Muse. Every number Muse may write is in these views; the page checks its text
// against numbersOf(view) and drops a line with any other number.

const r1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1);
const CON: Record<string, string> = {
  ult: "ульты", bkb: "BKB", revive: "возрождение и байбек", reinforce: "подкрепление и приход", vision: "обзор",
  resources: "золото, уровни, здоровье", status: "контроль в первую секунду", intent: "чем были заняты перед дракой", init: "смок и урон до драки",
};
export const conceptName = (k: string) => CON[k] ?? k;

export const fact = (s: string) => s.replace(/(\d)\.0\b/g, "$1").replace(/(\d)\.(\d)/g, "$1,$2");
export const hero = (d: Data, s: number) => d.heroes[String(s)]?.hero ?? `slot ${s}`;

function heroes(d: Data) {
  const row = (s: number) => {
    const b = d.board.find((x) => x.slot === s);
    const h = d.heroes[String(s)];
    return `  slot ${s} ${h.hero}, ${ROLE[h.role]}${b ? `, ${b.k}/${b.d}/${b.a}, нетворс ${kgold(b.nw)}` : ""}`;
  };
  const mine = ownSlots(d);
  const foe = Object.keys(d.heroes).map(Number).filter((s) => !mine.includes(s));
  return ["ваши герои:", ...mine.map(row), "герои врага:", ...foe.map(row)].join("\n");
}

function head(d: Data) {
  const v = d.match.v;
  const peak = v.reduce((a, b) => (b[1] > a[1] ? b : a));
  return `МАТЧ ${d.match.match_id}. Вы играли за ${d.match.team}, ${d.match.won ? "победа" : "поражение"}, длина ${clock(d.match.dur)}. Шанс победы: в начале ${pct(v[0][1])}, пик ${pct(peak[1])} на ${clock(peak[0])}, в конце ${pct(v[v.length - 1][1])}.`;
}

function signals(d: Data) {
  const s = d.signals;
  const mine = ownSlots(d);
  const bk = Object.entries(d.bkb).map(([k, t]) => ({ s: Number(k), t })).sort((a, b) => a.t - b.t);
  const vis = d.all_fights
    .flatMap((f) => f.concepts.filter((c) => c.concept === "vision" && c.pp <= -1).map((c) => ({ f, c })))
    .sort((a, b) => a.c.pp - b.c.pp).slice(0, 3);
  return [
    "ПРИЗНАКИ МАТЧА (по ним выбирай картинку для Главного):",
    `  bkb: ${bk.length ? bk.map((x) => `${hero(d, x.s)} (${mine.includes(x.s) ? "ваш" : "враг"}) купил BKB на ${clock(x.t)}`).join("; ") : "BKB не купил никто"}. BKB у ваших ${s.bkb.own_count}, у врагов ${s.bkb.enemy_count}.`,
    `  nw: самый большой перевес по золоту у вас ${kgold(Math.max(0, s.gold.max_lead))}, самое большое отставание ${kgold(s.gold.max_deficit)}, в конце ${s.gold.at_end < 0 ? "враг впереди на" : "вы впереди на"} ${kgold(s.gold.at_end)}.`,
    `  lead: пик шанса ${pct(s.lead.max_chance)} на ${clock(s.lead.at)}${s.lead.thrown ? ", выигрышное положение упущено" : ", выигрышного положения не было"}.`,
    `  vision: вардов за матч у вас ${s.vision.own_wards}, у врага ${s.vision.enemy_wards}.${vis.length ? " Драки, где обзор стоил шанса: " + vis.map((x) => `${x.f.id} ${clock(x.f.t0)} (${fact(x.c.fact.split(";")[0])})`).join("; ") : " Драк, где обзор заметно стоил шанса, нет."}`,
    `  deaths: ${s.deaths_before.links} раз герой умер незадолго до драки и не вернулся к ней.`,
    `  frame: кадр первой секунды одной из главных драк на миникарте.`,
  ].join("\n");
}

function moments(d: Data) {
  return ["ГЛАВНЫЕ ДРАКИ (moments):", ...d.moments.map((m) => {
    const f = m.fight;
    const w = d.whatif.find((x) => x.fight === f.id);
    const c = coachOf(m);
    const lines = [
      `  ${f.id} в ${clock(f.t0)}, ${f.alive}, шанс ${pct(f.v0)} → ${pct(after(f.v0, f.pp))}.`,
      c.instead ? `    коуч: ${c.verdict}. Надо было: ${c.instead}.` : "    коуч: текста нет, опирайся на числа",
      c.what ? `    что было: ${fact(c.what)}` : "",
      `    факты команды: ${m.concepts.filter((x) => Math.abs(x.pp) >= 0.5).map((x) => `${x.concept} (${conceptName(x.concept)}): ${fact(x.fact)}`).join(" | ") || "нет"}`,
      w && (w.concepts.length || w.heroes.length)
        ? `    что если (whatif): ${[...w.concepts.map((x) => `${x.concept}: если бы пришли как сильные игроки, шанс после драки был бы ${pct(after(f.v0, f.pp + x.gain))} вместо ${pct(after(f.v0, f.pp))}`), ...w.heroes.map((h) => `герой slot ${h.slot} ${h.hero}: если бы пришёл как сильный игрок, шанс после драки был бы ${pct(after(f.v0, f.pp + h.gain))}`)].join("; ")}`
        : "    что если (whatif): нет заметных пунктов",
      `    смерти раньше: ${m.earlier_deaths.length ? m.earlier_deaths.map((s) => s.replace(/: -?\d+\.\d п\.п\.$/, "")).join("; ") : "нет"}`,
    ];
    return lines.join("\n");
  })].join("\n");
}

function chain(d: Data) {
  return ["ЦЕПОЧКА МАТЧА (звенья по времени, id звена слева):", ...d.chain.map((l, i) => {
    const f = fightOf(d, l.fight);
    const cost = l.kind === "drift" ? "" : f ? `, драка: шанс ${pct(f.v0)} → ${pct(after(f.v0, f.pp))}` : "";
    return `  ${linkId(i)} ${clock(l.t)} ${l.kind}${l.fight ? ` ${l.fight}` : ""}: ${linkText(d, l, "ru")}${cost}`;
  })].join("\n");
}

function habits(d: Data) {
  return ["ПРИВЫЧКИ ПРОТИВ PRO (habits; slot -1 это вся команда):", ...d.habits.map((h) =>
    `  slot ${h.slot} ${h.slot >= 0 ? h.hero : "команда"}: ${h.items.map((it) => {
      const tol = it.key === "deaths" ? 0.08 : it.pro * 0.08;
      const ok = it.better === "more" ? it.you >= it.pro - tol : it.you <= it.pro + tol;
      return `${it.key} (${it.label}) ${ok ? "не хуже pro" : "хуже pro"}`;
    }).join("; ")}`)].join("\n");
}

/** What Muse sees when it builds the Разбор tab. */
export function layoutView(d: Data) {
  return [head(d), heroes(d), signals(d), moments(d), chain(d), habits(d)].join("\n\n");
}

export function cards(d: Data, names?: string[]) {
  return Object.entries(d.hero_cards)
    .filter(([n]) => !names || names.includes(n))
    .map(([n, c]) => `  ${n}: ульт ${c.ult.name}${c.ult.through_bkb ? " (бьёт сквозь BKB)" : ""}, перезарядка ${c.ult.cd_s} с; контроль: ${c.control.join(", ") || "нет"}`)
    .join("\n");
}

export function fightLine(d: Data, id: string) {
  const f = fightOf(d, id);
  if (!f) return "";
  const hs = f.heroes.map((h) => `${hero(d, h.slot)} ${r1(h.prep + h.exec)}`).join(", ");
  return [
    `драка ${f.id} в ${clock(f.t0)}, ${f.alive}, шанс ${pct(f.v0)} → ${pct(after(f.v0, f.pp))}; до первого удара ${r1(f.prep)}, первые 6 с ${r1(f.exec)}, остальное ${r1(f.rest)}`,
    `герои против сильного игрока той же позиции (плюс лучше, минус хуже): ${hs}`,
    `факты команды: ${f.concepts.map((c) => `${conceptName(c.concept)}: ${fact(c.fact)}`).join(" | ") || "нет"}`,
    `события: ${f.events.slice(0, 12).join("; ")}`,
  ].join("\n");
}

/** The element behind an "Объясни" button, by key. null for a key this match does not have. */
export function explainView(d: Data, key: string): string | null {
  const [kind, a, b] = key.split(":");
  let body: string | null = null;
  if (kind === "main" && a) body = signals(d).split("\n").filter((l) => l.startsWith("  " + (a as Pic) + ":") || l.startsWith("ПРИЗНАКИ")).join("\n") + (a === "frame" && b ? "\n" + fightLine(d, b) : "");
  else if (kind === "link") {
    const i = Number(a?.slice(1));
    const l = d.chain[i];
    if (l) body = `звено цепочки ${clock(l.t)} (${l.kind}): ${linkText(d, l, "ru")}${l.fight ? "\n" + fightLine(d, l.fight) : ""}`;
  } else if (kind === "fight" && a && fightOf(d, a)) {
    const m = d.moments.find((x) => x.fight.id === a);
    const c = m && coachOf(m);
    body = fightLine(d, a) + (c && c.instead ? `\nкоуч: ${c.verdict}. Надо было: ${c.instead}. Почему: ${c.why}` : "");
  } else if (kind === "whatif" && a) {
    const w = d.whatif.find((x) => x.fight === a);
    const f = fightOf(d, a);
    if (w && f) body = fightLine(d, a) + "\nчто если:\n" + [...w.concepts.map((x) => `${x.name}: ${fact(x.fact)}; если бы пришли как сильные игроки, шанс после драки был бы ${pct(after(f.v0, f.pp + x.gain))} вместо ${pct(after(f.v0, f.pp))}`), ...w.heroes.map((h) => `${h.hero}: если бы пришёл как сильный игрок, шанс после драки был бы ${pct(after(f.v0, f.pp + h.gain))}`)].join("\n");
  } else if (kind === "habit" && a && b) {
    const h = d.habits.find((x) => String(x.slot) === a);
    const it = h?.items.find((x) => x.key === b);
    if (h && it) body = `${h.slot >= 0 ? h.hero : "команда"}, ${it.label}: у вас ${fact(String(it.you))}, у pro ${fact(String(it.pro))}, у игроков высокого рейтинга ${fact(String(it.high))}; лучше, когда ${it.better === "more" ? "больше" : "меньше"}.`;
  }
  if (!body) return null;
  const names = Object.values(d.heroes).map((h) => h.hero).filter((n) => body!.includes(n));
  return `${head(d)}\n\nЭЛЕМЕНТ:\n${body}\n\nКАРТОЧКИ ГЕРОЕВ:\n${cards(d, names.length ? names : undefined)}`;
}

export function board(d: Data) {
  const mine = ownSlots(d);
  return ["ФАРМ И ПРЕДМЕТЫ В КОНЦЕ МАТЧА:", ...d.board.map((b) =>
    `  ${hero(d, b.slot)} (${mine.includes(b.slot) ? "ваш" : "враг"}): уровень ${b.level}, ${b.k}/${b.d}/${b.a}, добито ${b.lh}, денаев ${b.dn}, нетворс ${kgold(b.nw)}; ${b.items.map((x) => x.replace(/^item_/, "").replace(/_/g, " ")).join(", ") || "без предметов"}`)].join("\n");
}

export function gold(d: Data) {
  const pts = d.nw.filter(([t]) => t >= 0 && t % 300 === 0);
  return `РАЗНИЦА НЕТВОРСА КОМАНД каждые 5 минут (плюс: вы впереди): ${pts.map(([t, x]) => `${clock(t)} ${x < 0 ? "−" : "+"}${kgold(Math.abs(x))}`).join(", ")}`;
}

// Landmarks for the model: "у T2 мид Dire" reads better than coordinates and needs no numbers checked.
const SIDE: Record<string, string> = { good: "Radiant", bad: "Dire", goodguys: "Radiant", badguys: "Dire" };
const LANE: Record<string, string> = { top: "верх", mid: "мид", bot: "низ" };
function bname(k: string) {
  let m = /^dota_(goodguys|badguys)_tower(\d)_(top|mid|bot)$/.exec(k);
  if (m) return `T${m[2]} ${LANE[m[3]]} ${SIDE[m[1]]}`;
  m = /^(good|bad)_rax_\w+_(top|mid|bot)$/.exec(k);
  if (m) return `бараков ${LANE[m[2]]} ${SIDE[m[1]]}`;
  m = /^dota_(goodguys|badguys)_fort$/.exec(k);
  return m ? `трона ${SIDE[m[1]]}` : k;
}
export function place(d: Data, x: number, y: number) {
  let best = "";
  let dist = Infinity;
  for (const [k, [bx, by]] of Object.entries(d.buildings)) {
    const r = Math.hypot(bx - x, by - y);
    if (r < dist) { dist = r; best = k; }
  }
  if (dist < 1200) return `у ${bname(best)}`;
  const half = x + y < -900 ? "лес Radiant" : x + y > 900 ? "лес Dire" : "река";
  const lane = y - x > 4500 ? "верх" : x - y > 4500 ? "низ" : "центр";
  return `${half}, ${lane}`;
}

const EV: Record<string, string> = { death: "умер", smoke: "смок", tp: "телепорт", bkb: "нажал BKB", tower_lost: "пала башня", rax_lost: "пали бараки" };

/** Every hero at second t of a replay window: health, mana, what is ready and where. Russian, for Muse. */
export function stateView(d: Data, t: number) {
  const m = d.moments.find((x) => t >= x.replay.t_from && t <= x.replay.t_to);
  if (!m) return null;
  const st = stateAt(buildTracks(m.replay), t);
  const mine = ownSlots(d);
  const rows = [...st.entries()].sort(([a], [b]) => a - b).map(([s, p]) => {
    const who = `${hero(d, s)} (${mine.includes(s) ? "ваш" : "враг"})`;
    if (!p.alive) return `  ${who}: мёртв`;
    const flags = [p.ult ? "ульт готов" : "ульт не готов", p.bkb ? "BKB готов" : "", p.tp ? "TP готов" : "TP нет", p.ctrl ? "под контролем" : "", p.immune ? "иммунитет к магии" : "", p.invis ? "невидим" : ""].filter(Boolean);
    return `  ${who}: HP ${Math.round(p.hp * 100)}%, мана ${Math.round(p.mana * 100)}%, ${flags.join(", ")}; ${place(d, p.x, p.y)}`;
  });
  const on = m.replay.wards.filter((w) => w.t0 <= t && t <= w.t1);
  const n = (own: boolean, k: string) => on.filter((w) => w.own === own && w.kind === k).length;
  const obs = (own: boolean) => on.filter((w) => w.own === own && w.kind === "obs").map((w) => place(d, w.x, w.y)).join(", ") || "нет";
  const wards = [`ваши: observer ${n(true, "obs")} (${obs(true)}), sentry ${n(true, "sen")}`, `вражеские: observer ${n(false, "obs")} (${obs(false)}), sentry ${n(false, "sen")}`];
  const evs = m.replay.events.filter((e) => Math.abs(e.t - t) <= 15).map((e) =>
    e.slot >= 0 ? `${clock(e.t)} ${hero(d, e.slot)} ${EV[e.kind] ?? e.kind}` : `${clock(e.t)} ${EV[e.kind] ?? e.kind} (${e.own ? "ваша" : "вражеская"})`);
  return [
    `СОСТОЯНИЕ ГЕРОЕВ НА ${clock(t)} (драка ${m.fight.id}):`, ...rows,
    `  варды в этот момент: ${wards.join("; ") || "нет"}`,
    `  события рядом (±15 с): ${evs.join("; ") || "нет"}`,
  ].join("\n");
}

/** Extra data for the times a question names: the state at that second, or the fight that starts near it. */
export function focusView(d: Data, q: string) {
  const out: string[] = [];
  for (const [, mm, ss] of q.matchAll(/(\d{1,2})[:.](\d{2})/g)) {
    const t = Number(mm) * 60 + Number(ss);
    if (Number(ss) > 59 || t > d.match.dur + 60) continue;
    const s = stateView(d, t);
    if (s) out.push(s);
    const f = d.all_fights.find((x) => Math.abs(x.t0 - t) <= 30 || (t >= x.t0 && t <= x.t1));
    if (f) out.push(fightLine(d, f.id));
    if (out.length >= 4) break;
  }
  return out.length ? "ПО ВРЕМЕНИ ИЗ ВОПРОСА:\n" + out.join("\n") : "";
}

/** What the chat sees: the layout view, every fight in short, the hero cards, farm and items, and the state of every
 * hero at the start of the main fights (players asked for health, mana, position and vision). */
export function chatView(d: Data) {
  const fights = d.all_fights.filter((f) => !f.minor || f.pp <= -3).map((f) => `  ${f.id} ${clock(f.t0)} ${f.alive} шанс ${pct(f.v0)} → ${pct(after(f.v0, f.pp))}${f.concepts[0] ? `; ${conceptName(f.concepts[0].concept)}: ${fact(f.concepts[0].fact)}` : ""}`);
  const states = d.moments.map((m) => stateView(d, m.fight.t0)).filter(Boolean);
  return [layoutView(d), ["ВСЕ ЗАМЕТНЫЕ ДРАКИ:", ...fights].join("\n"), "КАРТОЧКИ ГЕРОЕВ:\n" + cards(d), board(d), gold(d), ...states].join("\n\n");
}

/** Every number of a view as text: "30:49", "74", "4,2", "0". */
export function numbersOf(view: string) {
  const out = new Set<string>();
  for (const m of view.matchAll(/\d+:\d\d|\d+(?:[.,]\d+)?/g)) {
    const x = m[0].replace(".", ",");
    out.add(x);
    if (/,0$/.test(x)) out.add(x.slice(0, -2));
    if (x.includes(":")) out.add(x.split(":")[0]);
  }
  return out;
}

const BANNED = /не видно|не видим|не объяснен|не объяснён|не объясня|важно отметить|стоит отметить|п\.\s?п\./i;

/** A line Muse wrote, ready to show, or null when it has a number from nowhere or a phrase the page does not use. */
export function clean(s: unknown, nums: Set<string>) {
  if (typeof s !== "string") return null;
  const t = s.replace(/\s*->\s*/g, " → ").replace(/\s*—\s*/g, ", ").replace(/!/g, ".").replace(/\s+/g, " ").trim();
  if (!t || BANNED.test(t)) return null;
  for (const m of t.matchAll(/\d+:\d\d|\d+(?:[.,]\d+)?/g)) if (!nums.has(m[0].replace(".", ","))) return null;
  return t;
}

/** Numbers of a text that the view does not have (for the offline check). */
export function strayNumbers(s: string, nums: Set<string>) {
  return [...s.matchAll(/\d+:\d\d|\d+(?:[.,]\d+)?/g)].map((m) => m[0]).filter((x) => !nums.has(x.replace(".", ",")));
}
