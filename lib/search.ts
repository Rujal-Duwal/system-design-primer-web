import type { SearchDoc } from "@/lib/types";

/**
 * Lexical search over all 27 documents.
 *
 * Deliberately not an embedding model: retrieval has to work for every reader
 * on the first keystroke, with no download and no WebGPU. The same ranking
 * feeds the on-device model's retrieval, so what the model reads can never
 * drift from what search finds.
 *
 * The index is the full text of every document, so it is fetched when the
 * reader first opens the overlay rather than shipped with the page. Nobody
 * should pay 160 KB for a search box they may never press.
 */

export type Hit = {
  doc: SearchDoc;
  score: number;
  snippet: string;
};

let DOCS: SearchDoc[] = [];
let loading: Promise<SearchDoc[]> | null = null;

export function isIndexLoaded() {
  return DOCS.length > 0;
}

export function loadIndex(): Promise<SearchDoc[]> {
  if (DOCS.length) return Promise.resolve(DOCS);
  if (!loading) {
    loading = import("@/content/generated/search-index.json").then((mod) => {
      DOCS = (mod.default ?? mod) as unknown as SearchDoc[];
      buildDocFreq();
      return DOCS;
    });
  }
  return loading;
}

const STOP = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "is", "are", "was", "were", "be", "been", "it", "its", "as", "at", "by",
  "that", "this", "these", "those", "from", "how", "what", "why", "when",
  "does", "do", "can", "i", "you", "my", "vs",
]);

function terms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9+#-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** Documents containing each term, for the idf weighting. */
let docFreq = new Map<string, number>();

function buildDocFreq() {
  const df = new Map<string, number>();
  for (const doc of DOCS) {
    for (const t of new Set(terms(doc.text))) df.set(t, (df.get(t) ?? 0) + 1);
  }
  docFreq = df;
}

function idf(term: string): number {
  const df = docFreq.get(term) ?? 0;
  return Math.log(1 + (DOCS.length - df + 0.5) / (df + 0.5));
}

function countOccurrences(haystack: string, needle: string): number {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

export function search(query: string, limit = 6): Hit[] {
  const ts = terms(query);
  if (!ts.length || !DOCS.length) return [];

  const hits: Hit[] = [];
  for (const doc of DOCS) {
    const title = doc.title.toLowerCase();
    const snippet = doc.snippet.toLowerCase();
    const text = doc.text.toLowerCase();

    let score = 0;
    let matched = 0;
    for (const t of ts) {
      const w = idf(t);
      let termScore = 0;
      if (title.includes(t)) termScore += 6 * w;
      if (snippet.includes(t)) termScore += 3 * w;
      const body = countOccurrences(text, t);
      // Saturating, so one section repeating a word does not bury a better fit.
      if (body) termScore += w * (1 + Math.log(body));
      if (termScore) matched++;
      score += termScore;
    }
    if (!matched) continue;

    // Reward covering more of the query over hammering one word.
    score *= matched / ts.length;
    hits.push({ doc, score, snippet: excerpt(doc, ts) });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

/**
 * A line from the document that actually contains a query term, falling back to
 * the authored one-liner. Showing the matched sentence is the difference
 * between a result list you can skim and one you have to click through.
 */
function excerpt(doc: SearchDoc, ts: string[]): string {
  const lines = doc.text.split("\n");
  let best: { line: string; hits: number } | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length < 40 || line.length > 400) continue;
    const lower = line.toLowerCase();
    const hits = ts.reduce((n, t) => n + (lower.includes(t) ? 1 : 0), 0);
    if (hits && (!best || hits > best.hits)) best = { line, hits };
  }

  if (!best) return doc.snippet;
  return best.line.length > 200 ? `${best.line.slice(0, 197)}…` : best.line;
}

export function hrefFor(doc: SearchDoc): string {
  return doc.view === "reference" ? `/reference/${doc.slug}/` : `/exercise/${doc.slug}/`;
}

/**
 * Retrieval for the on-device model: the top passages, trimmed to a token
 * budget the 1B model can actually attend to.
 */
export function retrieve(query: string, maxChars = 6000): { doc: SearchDoc; passage: string }[] {
  const hits = search(query, 3);
  const out: { doc: SearchDoc; passage: string }[] = [];
  let budget = maxChars;

  for (const hit of hits) {
    const passage = passageFor(hit.doc, query, Math.min(2400, budget));
    if (!passage) continue;
    out.push({ doc: hit.doc, passage });
    budget -= passage.length;
    if (budget <= 400) break;
  }
  return out;
}

/** The window of the document around the densest cluster of query terms. */
function passageFor(doc: SearchDoc, query: string, maxChars: number): string {
  const ts = terms(query);
  const lines = doc.text.split("\n").filter((l) => l.trim());
  if (!lines.length) return "";

  let bestIndex = 0;
  let bestScore = -1;
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    const score = ts.reduce((n, t) => n + (lower.includes(t) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  // Lead with the authored summary, then the matched window.
  const parts = [doc.snippet];
  let used = doc.snippet.length;
  for (let i = Math.max(0, bestIndex - 1); i < lines.length && used < maxChars; i++) {
    parts.push(lines[i]);
    used += lines[i].length + 1;
  }
  return parts.join("\n").slice(0, maxChars);
}
