import spec from "@/generated/a-spec.json";
import { layoutView } from "@/lib/a/context";
import { budgetOk, fail, gate, hold, take, withSid } from "@/lib/a/guard";
import { isLang, type Lang } from "@/lib/a/i18n";
import { glossary, loadMatch, museStream, ready } from "@/lib/a/muse";
import { museAllowed, tierOf } from "@/lib/a/source";
import { reviewOptionsFor } from "@/lib/a/prompt-options";
import { generateSystemPrompt, type LibrarySpec } from "@openuidev/lang-core";

export const maxDuration = 300;

const systems = new Map<Lang, string>();
const system = (l: Lang) => {
  if (!systems.has(l)) systems.set(l, generateSystemPrompt({ library: spec as LibrarySpec, promptOptions: reviewOptionsFor(l) }));
  return systems.get(l)!;
};
const ASK: Record<Lang, string> = { ru: "Собери вкладку «Разбор» для этого матча.", en: "Build the Review tab for this match, all phrases in English.", zh: "为这场比赛生成“复盘”页，所有文字用简体中文。", uk: "Збери вкладку «Розбір» для цього матчу, усі фрази українською.", es: "Arma la pestaña «Análisis» para este partido, todas las frases en español latinoamericano." };

// "Пересобрать": Muse builds the Разбор tab of one match live, as OpenUI Lang streamed in plain text. The prepared
// layout stays on the page if this is refused. kind=offline (scripts/a-layouts.mjs) works only on a dev server.
export async function POST(req: Request) {
  const g = gate(req);
  if (g.stop) return g.stop;
  const u = new URL(req.url).searchParams;
  const id = u.get("match") ?? "";
  const lang = isLang(u.get("lang")) ? (u.get("lang") as Lang) : "ru";
  const offline = u.get("kind") === "offline" && process.env.NODE_ENV !== "production";
  const d = await loadMatch(id, req);
  if (!d) return fail("missing", g.sid);
  if (!(await museAllowed(id, req, "layout"))) return fail("pro", g.sid);
  const tier = (await tierOf(id, req))?.tier ?? "own";
  if (!ready()) return fail("down", g.sid);
  if (!offline && !take("layout", g.ip, g.sid.sid)) return fail("rate", g.sid);
  if (!(await budgetOk(tier))) return fail("budget", g.sid);
  const prompt = `${system(lang)}\n\nGLOSSARY:\n${await glossary()}\n\nMATCH DATA:\n${layoutView(d)}`;
  const enc = new TextEncoder();
  const kind = offline ? "layout-offline" : "layout-live";
  const free = hold();
  const body = new ReadableStream<Uint8Array>({
    async start(c) {
      try {
        for await (const t of museStream([{ role: "system", content: prompt }, { role: "user", content: ASK[lang] }], `${kind}-${lang}`, id, req.signal)) c.enqueue(enc.encode(t));
      } catch (e) {
        console.error("a/layout", e);
        c.enqueue(enc.encode("\n// error"));
      } finally {
        free();
        c.close();
      }
    },
  });
  return new Response(body, { headers: withSid({ "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store, no-transform" }, g.sid) });
}
