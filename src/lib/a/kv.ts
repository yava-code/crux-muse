import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CACHE } from "./muse";

// Small text files that outlive one server: the layouts and translations Muse made on demand. On Cloud Run the disk is
// memory and goes with the instance, so with A_BUCKET set they live in that Cloud Storage bucket (the service account's
// token comes from the metadata server); without it, in .a-cache/kv.

const BUCKET = process.env.A_BUCKET ?? "";
let tok: { v: string; until: number } | null = null;

async function token() {
  if (tok && Date.now() < tok.until) return tok.v;
  const r = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(3000) });
  if (!r.ok) throw new Error(`metadata ${r.status}`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  tok = { v: j.access_token, until: Date.now() + (j.expires_in - 60) * 1000 };
  return tok.v;
}

const safe = (k: string) => k.replace(/[^a-z0-9._/-]/gi, "_");

export async function kvGet(key: string): Promise<string | null> {
  try {
    if (!BUCKET) return await readFile(join(CACHE, "kv", safe(key)), "utf8");
    const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(safe(key))}?alt=media`, { headers: { Authorization: `Bearer ${await token()}` }, signal: AbortSignal.timeout(8000) });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  }
}

/** True once the text is stored; callers that only cache can ignore it. */
export async function kvPut(key: string, text: string) {
  try {
    if (!BUCKET) {
      const f = join(CACHE, "kv", safe(key));
      await mkdir(dirname(f), { recursive: true });
      await writeFile(f, text, "utf8");
      return true;
    }
    const r = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(safe(key))}`, {
      method: "POST", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "text/plain; charset=utf-8" }, body: text, signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) console.error("kv put", r.status);
    return r.ok;
  } catch (e) {
    console.error("kv put", e);
    return false;
  }
}

export async function kvDel(key: string) {
  try {
    if (!BUCKET) return void (await unlink(join(CACHE, "kv", safe(key))));
    await fetch(`https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(safe(key))}`, { method: "DELETE", headers: { Authorization: `Bearer ${await token()}` }, signal: AbortSignal.timeout(8000) });
  } catch {
    // already gone
  }
}

/** Names under a prefix (feedback and counters export); the first page of 1000 is enough for the volumes here. */
export async function kvList(prefix: string): Promise<string[]> {
  try {
    if (!BUCKET) {
      const base = join(CACHE, "kv", safe(prefix));
      const out: string[] = [];
      const walk = async (dir: string, rel: string) => {
        for (const e of await readdir(dir, { withFileTypes: true })) e.isDirectory() ? await walk(join(dir, e.name), `${rel}${e.name}/`) : out.push(`${rel}${e.name}`);
      };
      await walk(base, safe(prefix).endsWith("/") ? safe(prefix) : `${safe(prefix)}/`).catch(() => {});
      return out;
    }
    const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${BUCKET}/o?prefix=${encodeURIComponent(safe(prefix))}&fields=items(name)&maxResults=1000`, { headers: { Authorization: `Bearer ${await token()}` }, signal: AbortSignal.timeout(8000) });
    return r.ok ? (((await r.json()) as { items?: { name: string }[] }).items ?? []).map((x) => x.name) : [];
  } catch {
    return [];
  }
}
