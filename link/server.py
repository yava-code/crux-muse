"""Syntropy Link, prototype: a Dota 2 match as an MCP server. Any agent (Claude, Codex, Muse through tool calls) asks for
state, events, fights and the win chance instead of looking at pixels. Read only: nothing here talks to a running game.
Plain JSON-RPC over stdio (MCP 2025-06-18 subset), no SDK. Run: .venv\\Scripts\\python -m rnd.link.server"""
import glob, json, sys
from functools import lru_cache
from pathlib import Path
import polars as pl

ROOT = Path(__file__).resolve().parents[2]
P = ROOT / 'data/models_cache/parsed/v1'
FEAT = ROOT / 'data/feat/v0'
KEEP = ('DotaCombatlogDeath', 'DotaCombatlogPurchase', 'DotaCombatlogItem', 'DotaCombatlogFirstBlood', 'DotaCombatlogAbility')
BIG = {'item_black_king_bar', 'item_blink', 'item_smoke_of_deceit', 'item_gem', 'item_aegis', 'item_refresher', 'item_sheepstick',
       'item_manta', 'item_glimmer_cape', 'item_force_staff', 'item_ward_observer', 'item_ward_sentry', 'item_tpscroll',
       'item_travel_boots', 'item_aghanims_shard', 'item_ultimate_scepter', 'item_cheese', 'item_dust'}


def mmss(t):
    t = int(t)
    return f"{'-' if t < 0 else ''}{abs(t) // 60}:{abs(t) % 60:02d}"


def sec(s):
    s = str(s).strip()
    if ':' in s:
        m, x = s.lstrip('-').split(':')
        return (-1 if s.startswith('-') else 1) * (int(m) * 60 + int(x))
    return int(float(s))


@lru_cache(1)
def heroes():
    hs = json.loads((ROOT / 'data/dotaconstants/heroes.json').read_text(encoding='utf-8'))
    return {int(h['id']): h['localized_name'] for h in hs.values()}


@lru_cache(1)
def holdout():
    return {int(x) for x in (ROOT / 'config/holdout.txt').read_text().split() if x.isdigit()}


@lru_cache(1)
def index():
    """match_id -> shard file of the local cache; the holdout is never served."""
    out = {}
    for f in sorted(glob.glob(str(P / 'states/*.parquet'))):
        for m in pl.scan_parquet(f).select('match_id').unique().collect()['match_id']:
            if m not in holdout() and Path(f.replace('states', 'global')).exists():
                out[int(m)] = Path(f).name
    return out


def shard(mid):
    mid = int(mid)
    assert mid not in holdout(), 'holdout match'
    if mid not in index():
        raise KeyError(f'match {mid} is not in the local cache; call list_matches')
    return index()[mid]


@lru_cache(4)
def table(t, mid):
    return pl.scan_parquet(P / t / shard(mid)).filter(pl.col('match_id') == mid).collect()


@lru_cache(8)
def chance(mid):
    v = pl.scan_parquet(FEAT / 'v.parquet').filter(pl.col('match_id') == mid).collect()
    if v.is_empty():
        return None
    src = 'oof' if (v['src'] == 'oof').any() else 'final'
    return v.filter(pl.col('src') == src).sort('sec').select('sec', 'v')


def at(c, t):
    if c is None:
        return None
    i = c['sec'].search_sorted(t)
    return round(100 * float(c['v'][min(i, c.height - 1)]), 1)


def list_matches(limit=20):
    ids = sorted(index())[: int(limit)]
    return dict(n=len(index()), matches=ids, note='parsed replays of ranked Divine+ / Legend–Ancient games, patch 7.41')


def summary(match_id):
    mid = int(match_id)
    s = table('states', mid)
    g = table('global', mid)
    last = s.filter(pl.col('clock') == s['clock'].max())
    end = g.filter(pl.col('clock') == g['clock'].max()).row(0, named=True)
    c = chance(mid)
    fs = pl.scan_parquet(glob.glob(str(FEAT / 'fights/*.parquet'))).filter(pl.col('match_id') == mid, pl.col('kind') == 'fight').collect()
    return dict(match_id=mid, duration=mmss(s['clock'].max()), score=dict(radiant=end['score_rad'], dire=end['score_dire']),
                heroes=[dict(slot=r['slot'], team='radiant' if r['slot'] < 5 else 'dire', hero=heroes().get(r['hero_id'], r['hero_id']),
                             kda=f"{r['k']}/{r['d']}/{r['a']}", nw=r['nw'], lh=r['lh'], level=r['level'])
                        for r in last.sort('slot').iter_rows(named=True)],
                fights=fs.height, radiant_chance={m: at(c, m * 60) for m in (5, 10, 15, 20, 25, 30, 40) if c is not None and m * 60 <= c['sec'].max()})


def state(match_id, t):
    mid, t = int(match_id), sec(t)
    s = table('states', mid)
    near = s['clock'].search_sorted(t)
    t = float(s['clock'][min(near, s.height - 1)])
    rows = s.filter(pl.col('clock') == t).sort('slot')
    out = []
    for r in rows.iter_rows(named=True):
        items = [r[f'it{i}'] for i in (0, 1, 2, 3, 4, 5, 16) if r.get(f'it{i}')]
        st = [k for k in ('stunned', 'silenced', 'hexed', 'rooted', 'disarmed', 'invis', 'magic_immune') if r[k]]
        out.append(dict(hero=heroes().get(r['hero_id']), team='radiant' if r['slot'] < 5 else 'dire', alive=r['life'] == 0,
                        respawn_s=r['respawn_s'] if (r['respawn_s'] or 0) > 0 else None, x=round(r['x']), y=round(r['y']), hp=f"{r['hp']}/{r['hp_max']}",
                        mana=f"{r['mana']}/{r['mana_max']}", level=r['level'], nw=r['nw'], ult_cd=round(r['ab5_cd'] or 0, 1),
                        items=[i.removeprefix('item_') for i in items], status=st))
    return dict(t=mmss(t), radiant_chance=at(chance(mid), t), heroes=out,
                map='x,y in game units, (0,0) is the map centre, Radiant base bottom-left')


def events(match_id, t0, t1, limit=120):
    mid, a, b = int(match_id), sec(t0), sec(t1)
    e = table('events', mid).filter(pl.col('clock').is_between(a, b), pl.col('type').is_in(KEEP))
    out = []
    for r in e.sort('clock').iter_rows(named=True):
        k, inf = r['type'].removeprefix('DotaCombatlog'), r['inflictor'] or ''
        if k == 'Death' and not r['tgt_hero']:
            continue
        # a thousand tango and branch lines drown what matters
        if k in ('Purchase', 'Item') and inf not in BIG:
            continue
        if k == 'Ability' and not r['att_hero']:
            continue
        out.append(dict(t=mmss(r['clock']), kind=k.lower(), who=(r['attacker'] or '').removeprefix('npc_dota_hero_'),
                        target=(r['target'] or '').removeprefix('npc_dota_hero_') or None, what=inf.removeprefix('item_') or None))
        if len(out) >= int(limit):
            break
    return dict(t0=mmss(a), t1=mmss(b), events=out, truncated=len(out) >= int(limit))


def fights(match_id):
    mid = int(match_id)
    f = pl.scan_parquet(glob.glob(str(FEAT / 'fights/*.parquet'))).filter(pl.col('match_id') == mid, pl.col('kind') == 'fight').collect()
    c = chance(mid)
    out = []
    for r in f.sort('t0').iter_rows(named=True):
        a, b = at(c, r['t0'] - 5), at(c, r['t1'] + 10)
        out.append(dict(id=f"f{r['fid']}", start=mmss(r['t0']), end=mmss(r['t1']), x=round(r['cx']), y=round(r['cy']),
                        heroes=dict(radiant=r['n_r'], dire=r['n_d']), deaths=dict(radiant=r['deaths_r'], dire=r['deaths_d']),
                        radiant_chance_before=a, radiant_chance_after=b, swing=None if a is None or b is None else round(b - a, 1)))
    big = sorted([x for x in out if x['swing'] is not None], key=lambda x: -abs(x['swing']))[:5]
    return dict(n=len(out), biggest=[x['id'] for x in big], fights=out)


def win_chance(match_id, step=60):
    c = chance(int(match_id))
    if c is None:
        return dict(error='no win-chance curve for this match')
    c = c.filter(pl.col('sec') % int(step) == 0)
    return dict(model='V(s): LightGBM on 1-second game state, Radiant win probability', points=[[mmss(s), round(100 * v, 1)] for s, v in c.rows()])


S = {'type': 'object', 'properties': {'match_id': {'type': 'integer'}}, 'required': ['match_id']}
T = lambda **kw: {'type': 'object', 'properties': {'match_id': {'type': 'integer'}, **kw}, 'required': ['match_id', *kw]}
TOOLS = {
    'list_matches': (list_matches, 'Replays this server can open.', {'type': 'object', 'properties': {'limit': {'type': 'integer'}}}),
    'match_summary': (summary, 'Heroes, final KDA/net worth, score, number of fights and the Radiant win chance by minute.', S),
    'state': (state, 'Every hero at one moment: position, HP, mana, level, net worth, items, ultimate cooldown, disables.',
              T(t={'type': 'string', 'description': 'match time mm:ss'})),
    'events': (events, 'Kills, key item purchases and uses, hero abilities between two moments.',
               T(t0={'type': 'string', 'description': 'mm:ss'}, t1={'type': 'string', 'description': 'mm:ss'})),
    'fights': (fights, 'All team fights with who took part, deaths per side and how the win chance moved.', S),
    'win_chance': (win_chance, 'The Radiant win-probability curve of the value model.', S),
}


def reply(i, res=None, err=None):
    msg = {'jsonrpc': '2.0', 'id': i, **({'error': err} if err else {'result': res})}
    sys.stdout.write(json.dumps(msg, ensure_ascii=False) + '\n')
    sys.stdout.flush()


def handle(q):
    m, i, p = q.get('method'), q.get('id'), q.get('params') or {}
    if i is None:
        return
    if m == 'initialize':
        return reply(i, {'protocolVersion': p.get('protocolVersion', '2025-06-18'), 'capabilities': {'tools': {}},
                         'serverInfo': {'name': 'syntropy-link', 'version': '0.1.0'},
                         'instructions': 'A Dota 2 match as structured data. Start with list_matches, then match_summary and fights.'})
    if m == 'ping':
        return reply(i, {})
    if m == 'tools/list':
        return reply(i, {'tools': [{'name': k, 'description': d, 'inputSchema': s} for k, (_, d, s) in TOOLS.items()]})
    if m == 'tools/call':
        f = TOOLS.get(p.get('name'))
        if not f:
            return reply(i, err={'code': -32602, 'message': f"unknown tool {p.get('name')}"})
        try:
            out = f[0](**(p.get('arguments') or {}))
            return reply(i, {'content': [{'type': 'text', 'text': json.dumps(out, ensure_ascii=False)}]})
        except Exception as e:
            return reply(i, {'content': [{'type': 'text', 'text': f'{type(e).__name__}: {e}'}], 'isError': True})
    reply(i, err={'code': -32601, 'message': f'no method {m}'})


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    for line in sys.stdin:
        if line.strip():
            handle(json.loads(line))


if __name__ == '__main__':
    main()
