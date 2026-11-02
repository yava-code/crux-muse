import { explainView, numbersOf } from "@/lib/a/context";
import { body, budgetOk, fail, gate, hold, take, withSid } from "@/lib/a/guard";
import { isLang, type Lang } from "@/lib/a/i18n";
import { cached, glossary, loadMatch, museOnce, ready, remember } from "@/lib/a/muse";
import { museAllowed, tierOf } from "@/lib/a/source";
import { explainSystemFor } from "@/lib/a/prompt-options";
import { sentencesOk } from "@/lib/a/safe";

export const maxDuration = 120;

// the same element asked twice at once waits for the first answer instead of paying twice
const flying = new Map<string, Promise<string>>();

const KEY = /^(main:(bkb|nw|lead|vision|deaths|frame)(:f\d{1,4})?|link:c\d{1,4}|fight:f\d{1,4}|whatif:f\d{1,4}|habit:-?\d:[a-z_]{1,12})$/;

// "Объясни" next to one element: 2-4 sentences by Muse, cached by match, key and language, so the second click is free.
export async function POST(req: Request) {
  const g = gate(req);
  if (g.stop) return g.stop;
  const q = await body<{ match?: unknown; key?: unknown; lang?: unknown }>(req, 512);
  if (!q) return fail("bad", g.sid);
  const id = String(q.match ?? "");
  const key = String(q.key ?? "");
  const lang: Lang = isLang(q.lang) ? q.lang : "ru";
  if (!KEY.test(key)) return fail("bad", g.sid);
  const d = await loadMatch(id, req);
  const view = d && explainView(d, key);
  if (!view) return fail("missing", g.sid);
  if (!(await museAllowed(id, req, "explain"))) return fail("pro", g.sid);
  const tier = (await tierOf(id, req))?.tier ?? "own";
  // Russian answers keep their old cache names; other languages get a suffix.
  const ck = (lang === "ru" ? key : `${key}@${lang}`) + (d!.match.won ? "@w" : "");
  const hit = await cached(id, ck);
  const headers = withSid({ "Cache-Control": "no-store" }, g.sid);
  if (hit) return Response.json({ text: hit, cached: true }, { headers });
  if (!ready()) return fail("down", g.sid);
  if (!take("explain", g.ip, g.sid.sid)) return fail("rate", g.sid);
  if (!(await budgetOk(tier))) return fail("budget", g.sid);
  try {
    const k = `${id}:${ck}`;
    let job = flying.get(k);
    if (!job) {
      const free = hold();
      job = museOnce([{ role: "system", content: `${explainSystemFor(lang)}\n\nGLOSSARY:\n${await glossary()}` }, { role: "user", content: view }], `explain-${lang}`, id)
        .finally(() => { flying.delete(k); free(); });
      flying.set(k, job);
    }
    const raw = await job;
    const text = sentencesOk(raw.replace(/\s*—\s*/g, ", ").replace(/!/g, ".").replace(/\*\*/g, "").replace(/п\.\s?п\./g, "пункта").trim(), numbersOf(view), lang);
    if (!text) return fail("down", g.sid);
    await remember(id, ck, text);
    return Response.json({ text }, { headers });
  } catch (e) {
    console.error("a/explain", e);
    return fail("down", g.sid);
  }
}
