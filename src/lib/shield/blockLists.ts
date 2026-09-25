// Focus Shield — block lists loaded from asset files at RUNTIME.
//
// The data itself no longer lives in the JS bundle. Source of truth is
// `android/app/src/main/assets/*.txt`; `scripts/sync-shield-lists.mjs` mirrors
// those files into `public/shield/` so the webview (web + Capacitor, offline)
// can fetch them. Updating a list = editing a text file, no code change.
//
// The matching algorithms below are byte-for-byte the same logic that used to
// live in `src/data/shield/adultSites.ts` / `bnKeywords.ts`.

const BASE = '/shield/';

async function loadLines(file: string): Promise<string[]> {
  const res = await fetch(`${BASE}${file}`, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
  return (await res.text())
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
}

export interface AdultSiteDb {
  seed: string[];
  all: string[];
  set: Set<string>;
  count: number;
}

export interface BnKeywordDb {
  keywords: string[];
  count: number;
}

let adultPromise: Promise<AdultSiteDb> | null = null;
let bnPromise: Promise<BnKeywordDb> | null = null;

function apexName(domain: string): string {
  return domain.split('.')[0];
}

/** Same expansion as before: seed × mirror suffix × mirror TLD, de-duped, sorted. */
function buildFullList(seed: string[], suffixes: string[], tlds: string[]): string[] {
  const out = new Set<string>();
  for (const s of seed) {
    out.add(s);
    const name = apexName(s);
    for (const suffix of suffixes) {
      for (const tld of tlds) out.add(`${name}${suffix}${tld}`);
    }
  }
  return Array.from(out).sort();
}

export function loadAdultSites(): Promise<AdultSiteDb> {
  if (!adultPromise) {
    adultPromise = (async () => {
      const [seed, rawSuffixes, tlds] = await Promise.all([
        loadLines('adult_sites_seed.txt'),
        loadLines('mirror_suffixes.txt'),
        loadLines('mirror_tlds.txt'),
      ]);
      // `_` in the asset file encodes the empty suffix (plain apex name).
      const suffixes = rawSuffixes.map((s) => (s === '_' ? '' : s));
      const all = buildFullList(seed, suffixes, tlds);
      return { seed, all, set: new Set(all), count: all.length };
    })().catch((e) => {
      adultPromise = null;
      throw e;
    });
  }
  return adultPromise;
}

export function loadBnKeywords(): Promise<BnKeywordDb> {
  if (!bnPromise) {
    bnPromise = (async () => {
      const raw = await loadLines('bn_keywords.txt');
      const keywords = Array.from(new Set(raw));
      return { keywords, count: keywords.length };
    })().catch((e) => {
      bnPromise = null;
      throw e;
    });
  }
  return bnPromise;
}

/** Strip scheme, path, port and leading `www.` from any URL or host string. */
export function normalizeHost(input: string): string {
  let host = (input || '').trim().toLowerCase();
  host = host.replace(/^[a-z]+:\/\//, '');
  host = host.split('/')[0].split('?')[0].split('#')[0].split(':')[0];
  return host.replace(/^www\./, '');
}

/** Suffix-aware check: `m.de.pornhub.com` matches the `pornhub.com` entry. */
export async function matchAdultSite(urlOrHost: string): Promise<string | null> {
  const { set } = await loadAdultSites();
  const host = normalizeHost(urlOrHost);
  if (!host) return null;
  if (set.has(host)) return host;
  const parts = host.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join('.');
    if (set.has(candidate)) return candidate;
  }
  return null;
}

/** Case/space-insensitive haystack test for URLs, titles and search queries. */
export async function matchesBnKeyword(text: string): Promise<string | null> {
  if (!text) return null;
  const { keywords } = await loadBnKeywords();
  const hay = text.toLowerCase().replace(/[_\-+]+/g, ' ');
  for (const kw of keywords) {
    if (hay.includes(kw.toLowerCase())) return kw;
  }
  return null;
}

/** Search helper for the Settings > Blocking list UI. */
export function searchAdultSites(db: AdultSiteDb, query: string, limit = 100): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return db.seed.slice(0, limit);
  return db.all.filter((d) => d.includes(q)).slice(0, limit);
}

export function searchBnKeywords(db: BnKeywordDb, query: string, limit = 100): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return db.keywords.slice(0, limit);
  return db.keywords.filter((k) => k.toLowerCase().includes(q)).slice(0, limit);
}
