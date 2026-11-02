import { clock } from "../beta3/types";
import { board, cards, conceptName, fact, fightLine, hero, layoutView, gold, stateView } from "./context";
import { after, pct, type Data } from "./types";

// The chat sees a short match view and asks for the rest: the state of heroes at a second, a fight in full, one hero's
// farm, items and fights. Cheaper than sending everything with every question, and the model can ask for any second
// of the replay windows instead of the few we picked for it.

export const TOOLS = [
  {
    type: "function",
    function: {
      name: "state",
      description: "Every hero at one second of the match: HP %, mana %, ultimate / BKB / TP ready, disabled, immune, invisible, where on the map; wards up at that second; events within 15 s. Only inside the replay windows around the main fights (listed in MATCH DATA).",
      parameters: { type: "object", properties: { t: { type: "string", description: "match time mm:ss" } }, required: ["t"] },
    },
  },
  {
    type: "function",
    function: {
      name: "fight",
      description: "One fight in full: chance before and after, each hero against a strong player of the same position, team facts (BKB, ultimates, vision, deaths before), events.",
      parameters: { type: "object", properties: { id: { type: "string", description: "fight id like f28" } }, required: ["id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "hero",
      description: "One hero of this match: level, K/D/A, last hits, denies, networth, final items, BKB purchase time, ultimate and disables, and every fight they were in with their contribution.",
      parameters: { type: "object", properties: { name: { type: "string", description: "hero name as in MATCH DATA, e.g. Anti-Mage" } }, required: ["name"] },
    },
  },
  {
    type: "function",
    function: {
      name: "when",
      description: "What happened between two match times: fights, deaths, towers, smokes and BKB uses in that span.",
      parameters: { type: "object", properties: { from: { type: "string", description: "mm:ss" }, to: { type: "string", description: "mm:ss" } }, required: ["from", "to"] },
    },
  },
];

// bump when what a tool answers changes: cached chat answers are keyed by it
export const TOOLS_V = "2";

const sec = (s: unknown) => {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(String(s ?? "").trim());
  return m && Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const windows = (d: Data) => d.moments.map((m) => `${clock(m.replay.t_from)}-${clock(m.replay.t_to)}`).join(", ");

function heroInfo(d: Data, name: string) {
  const key = name.toLowerCase().replace(/[^a-z]/g, "");
  const s = Object.entries(d.heroes).find(([, h]) => h.hero.toLowerCase().replace(/[^a-z]/g, "") === key)?.[0];
  if (s == null) return `нет героя ${name}; герои: ${Object.values(d.heroes).map((h) => h.hero).join(", ")}`;
  const slot = Number(s);
  const b = board(d).split("\n").find((l) => l.startsWith(`  ${hero(d, slot)} (`)) ?? "";
  const bkb = d.bkb[s] != null ? `BKB куплен на ${clock(d.bkb[s])}` : "BKB не покупал";
  const fs = d.all_fights.filter((f) => f.heroes.some((h) => h.slot === slot)).map((f) => {
    const h = f.heroes.find((x) => x.slot === slot)!;
    const v = Math.round((h.prep + h.exec) * 10) / 10;
    return `${f.id} ${clock(f.t0)} вклад ${v}${f.died.includes(slot) ? ", умер" : ""}`;
  });
  // without the reasons of the worst fights the model glues unrelated facts into a cause ("BKB at 33:54, so he lost 2:27")
  const worst = d.all_fights.filter((f) => f.heroes.some((h) => h.slot === slot))
    .map((f) => ({ f, v: f.heroes.find((x) => x.slot === slot)! })).sort((a, b) => (a.v.prep + a.v.exec) - (b.v.prep + b.v.exec)).slice(0, 3)
    .map(({ f }) => `  ${f.id} ${clock(f.t0)} ${f.alive}: ${f.concepts.filter((c) => Math.abs(c.pp) >= 0.5).map((c) => `${conceptName(c.concept)}: ${fact(c.fact)}`).join(" | ") || "явной причины в данных нет"}`);
  return [b.trim(), bkb, cards(d, [hero(d, slot)]).trim(), `драки героя (вклад против сильного игрока той же позиции, плюс лучше): ${fs.join("; ") || "нет"}`,
    `почему худшие драки (факты команды; других причин данные не дают):\n${worst.join("\n")}`].join("\n");
}

function span(d: Data, a: number, b: number) {
  const out: string[] = [];
  for (const f of d.all_fights) if (f.t0 >= a && f.t0 <= b) out.push(`драка ${f.id} ${clock(f.t0)} ${f.alive}, шанс ${pct(f.v0)} → ${pct(after(f.v0, f.pp))}`);
  for (const m of d.moments) for (const e of m.replay.events) if (e.t >= a && e.t <= b) out.push(`${clock(e.t)} ${e.slot >= 0 ? hero(d, e.slot) + " " : ""}${e.kind}`);
  return [...new Set(out)].slice(0, 30).join("\n") || "в этом промежутке ничего заметного";
}

/** The answer to one tool call, as plain Russian text for the model. */
export function runTool(d: Data, name: string, args: string) {
  let a: Record<string, unknown> = {};
  try { a = JSON.parse(args || "{}"); } catch { /* the model wrote broken JSON: answer with the usage line */ }
  if (name === "state") {
    const t = sec(a.t);
    if (t == null) return "t нужно как mm:ss";
    return stateView(d, t) ?? `на ${clock(t)} позиций нет; они есть в окнах: ${windows(d)}`;
  }
  if (name === "fight") return fightLine(d, String(a.id ?? "")) || `нет драки ${a.id}; драки: ${d.all_fights.map((f) => f.id).join(", ")}`;
  if (name === "hero") return heroInfo(d, String(a.name ?? ""));
  if (name === "when") {
    const x = sec(a.from), y = sec(a.to);
    return x == null || y == null ? "from и to нужно как mm:ss" : span(d, Math.min(x, y), Math.max(x, y));
  }
  return `нет функции ${name}`;
}

/** The short view the chat starts with when it can call tools. */
export function chatBase(d: Data) {
  const fights = d.all_fights.filter((f) => !f.minor || f.pp <= -3).map((f) => `  ${f.id} ${clock(f.t0)} ${f.alive} шанс ${pct(f.v0)} → ${pct(after(f.v0, f.pp))}`);
  const roster = Object.entries(d.heroes).map(([s, h]) => `${h.hero} (${h.own ? "ваш" : "враг"}, slot ${s})`).join(", ");
  return [layoutView(d), ["ВСЕ ЗАМЕТНЫЕ ДРАКИ:", ...fights].join("\n"), gold(d), `ГЕРОИ: ${roster}`,
    `ОКНА РЕПЛЕЯ (здесь есть HP, мана, позиции, варды по секундам): ${windows(d)}`,
    "ДАННЫЕ ПО ЗАПРОСУ: state(t), fight(id), hero(name), when(from, to)."].join("\n\n");
}
