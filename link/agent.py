"""Muse as an MCP client of Syntropy Link: it gets the server's tools, calls them itself and answers from what came back.
Run: .venv\\Scripts\\python -m rnd.link.agent 9044139133 "Why did Radiant lose?"   (LLM_BASE_URL, LLM_API_KEY, LLM_MODEL in link/.env)"""
import json, subprocess, sys, time
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
ENV = dict(l.split('=', 1) for l in (Path(__file__).resolve().parent / '.env').read_text().splitlines() if '=' in l and not l.startswith('#'))
MODEL = ENV.get('LLM_MODEL', 'muse-spark-1.3')


class Link:
    def __init__(self):
        self.p = subprocess.Popen([sys.executable, '-m', 'rnd.link.server'], cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, encoding='utf-8')
        self.n = 0
        self.rpc('initialize', {})

    def rpc(self, method, params):
        self.n += 1
        self.p.stdin.write(json.dumps({'jsonrpc': '2.0', 'id': self.n, 'method': method, 'params': params}) + '\n')
        self.p.stdin.flush()
        return json.loads(self.p.stdout.readline())


def muse(msgs, tools):
    body = {'model': MODEL, 'messages': msgs, 'tools': tools, 'max_tokens': 6000, 'reasoning_effort': 'low'}
    req = urllib.request.Request(ENV['LLM_BASE_URL'].rstrip('/') + '/chat/completions', json.dumps(body).encode(),
                                 {'Authorization': 'Bearer ' + ENV['LLM_API_KEY'], 'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(req, timeout=180))


def run(mid, q):
    link = Link()
    tools = [{'type': 'function', 'function': {'name': t['name'], 'description': t['description'], 'parameters': t['inputSchema']}}
             for t in link.rpc('tools/list', {})['result']['tools']]
    msgs = [{'role': 'system', 'content': 'You are a Dota 2 coach. Use the tools; every number you say must come from a tool result.'},
            {'role': 'user', 'content': f'Match {mid}. {q}'}]
    tok = [0, 0]
    for _ in range(8):
        r = muse(msgs, tools)
        tok[0] += r['usage']['prompt_tokens']; tok[1] += r['usage']['completion_tokens']
        m = r['choices'][0]['message']
        msgs.append({k: v for k, v in m.items() if k in ('role', 'content', 'tool_calls')})
        if not m.get('tool_calls'):
            break
        for c in m['tool_calls']:
            a = json.loads(c['function']['arguments'] or '{}')
            print(f"→ {c['function']['name']}({a})", flush=True)
            res = link.rpc('tools/call', {'name': c['function']['name'], 'arguments': a})
            txt = res['result']['content'][0]['text'] if 'result' in res else json.dumps(res.get('error'))
            msgs.append({'role': 'tool', 'tool_call_id': c['id'], 'content': txt[:20000]})
    link.p.kill()
    print('\n' + (m.get('content') or ''))
    print(f'\n[{MODEL}: {tok[0]} in / {tok[1]} out tokens]')


if __name__ == '__main__':
    t = time.time()
    run(int(sys.argv[1]), sys.argv[2] if len(sys.argv) > 2 else 'Why did the losing side lose? Name the key fight.')
    print(f'[{time.time() - t:.0f} s]')
