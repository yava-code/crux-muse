# Crux: Muse designs the screen for each Dota 2 match

Live: https://syntropycognitive.tech/try (Startup track, Meta Global AI Developer Hackathon 2026)

Most AI coaches show a fixed dashboard with a chatbot next to it. In Crux, Muse Spark lays out the page itself. For each match it chooses which charts, fights and moments to show, in what order, and what to write under each one. In chat it answers by building UI the same way: you ask "why did we lose at 27:00" and get the fight frame, the gold chart and a what-if card, streamed in one line at a time.

## What Muse writes

Muse writes [OpenUI Lang](https://github.com/thesysdev/openui), not HTML. This is the real output for match 9041117598 ([full file](examples/9041117598.en.layout.txt)):

```
root = Review(main, chain, [m1, m2, m3], mine)
main = Main("Kept fighting short handed and losing farm, should have grouped behind Sven for towers", GoldPicture(), ["f18", "f27"])
chain = Chain([l1, l2, l3, l4])
l1 = ChainLink("c1", "Wraith King fell early and the fight started short handed")
m3 = MomentCard("f27", ["ready", "replay", "concepts", "whatif"], "Walked in split without ults, should have grouped behind Sven ...")
```

Each component is a React block bound to match data. `GoldPicture()` draws the team gold curve, and `MomentCard("f27", ...)` opens fight 27 with its replay and its what-if. Muse picks and arranges the components and writes the sentences. It never draws numbers itself: every number on screen comes from our engine.

| | component library | used for |
|---|---|---|
| Review page | [13 components](src/generated/a-spec.json): `Main`, `Chain`, `MomentCard`, `FightFrame`, `GoldPicture`, `VisionPicture`, `Habit`… | the match page |
| Chat | [24 components](src/generated/a-ask-spec.json): the same blocks plus `Row`, `Card`, `HeroAt`, `Items`, `Probe`… | answers to questions; with `Probe`, Muse asks the player a question back |

## How it fits together

```
replay ──► Syntropy engine (private) ──► match JSON ──► Muse Spark 1.3 ──► OpenUI Lang ──► React page
           parser, win probability V(s),               tool calls back       line by line,
           strong-player policy π(a|s),                into the match        each line checked
           cost of each decision                                             against the data
```

- **Engine (not in this repo).** It includes a Rust replay parser, a collector that pulls about 2,700 high-rank matches a day, and CPU models for win probability, what a strong player would do, and how much each decision cost. Its output is a match JSON like [`examples/9041117598.json`](examples/9041117598.json).
- **Grounding** ([`safe.ts`](src/lib/a/safe.ts)). Before a line of Muse output reaches the browser, the server checks it against the match JSON: every time, percent and fight ID has to exist in the match, and an effect can't come before the cause it names. A line that fails is dropped.
- **Cost.** Every call is priced and logged, with daily caps per tier. On the free tier, Muse writes the first review of each day.

## Syntropy Link: Muse as an MCP agent

`link/server.py` serves a parsed match over MCP: `match_summary`, `state` (every hero at a given second), `events`, `fights`, `win_chance`. `link/agent.py` gives Muse those tools and leaves it alone. In a real run on match 9044139133, Muse pulled the fights, found the one that swung the game, took the hero `state` at 11:58, read the `events` of the fight and answered:

> Don't take 5 vs 4 at 11:58 without Necrophos ultimate (ult_cd 54.0) and with your carry at 6271,-4939. You fed a Razor Eye fight 4 to 0 and flipped 51.0 to 31.8.

Every number there came from a tool call. The run took 29 s, 17k input and 2.9k output tokens on `muse-spark-1.3-contributor`.

## Files

| file | what it does |
|---|---|
| `src/lib/a/muse.ts` | Meta Model API client (OpenAI-compatible): streaming, tool loop, cost per call |
| `src/lib/a/gen.ts` | builds the system prompt from the component library and asks Muse for the page |
| `src/lib/a/context.ts`, `tools.ts` | compresses a match so it fits one call; tools Muse can call during chat |
| `src/app/api/a/chat/route.ts` | chat that answers in UI, streamed and checked line by line |
| `src/app/api/a/explain/route.ts` | "Explain this moment" |
| `src/lib/a/guard.ts`, `safe.ts` | spend caps, rate limits, output checks |
| `src/generated/*` | component specs and system prompts |
| `link/server.py` | Syntropy Link: a match as an MCP server, so any agent can ask for state, fights and win chance |

## Notes

- This code is extracted from the production app. To run, it needs the private engine API (`CRUX_API`), so the quickest way to see it working is the live site.
- Written with Muse Code. The UI runtime is OpenUI (MIT, see `LICENSE.openui`).
- No player names or Steam IDs are stored or sent to the model.
