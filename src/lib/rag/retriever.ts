import { knowledgeBase, type KnowledgeDoc } from "./knowledge";
import { tokenize } from "./tokenize";

export { tokenize } from "./tokenize";

export interface RetrievedDoc {
  doc: KnowledgeDoc;
  score: number;
  /** Query terms (stemmed) that matched this document, for diagnostics and UI. */
  matched: string[];
}

/**
 * Field weights. A word appearing in a name or an explicit keyword is a far
 * stronger signal than the same word buried in body prose — without this,
 * "center of excellence" matched the Eiffel scholarship's title and beat the
 * building actually named "Center of Excellence".
 */
const FIELD_WEIGHT = {
  title: 3,
  keyword: 2,
  body: 1,
} as const;

/**
 * Score awarded when a query contains a document's declared multi-word keyword
 * verbatim. Deliberately above the confidence threshold: an exact phrase the
 * corpus itself asserts is the strongest lexical evidence available here.
 */
const PHRASE_WEIGHT = 6;

interface IndexedDoc {
  doc: KnowledgeDoc;
  /** Weighted term frequencies across all fields. */
  tf: Map<string, number>;
  length: number;
}

function indexDoc(doc: KnowledgeDoc): IndexedDoc {
  const tf = new Map<string, number>();

  const add = (text: string, weight: number) => {
    for (const token of tokenize(text)) {
      tf.set(token, (tf.get(token) ?? 0) + weight);
    }
  };

  add(doc.title, FIELD_WEIGHT.title);
  for (const keyword of doc.keywords) add(keyword, FIELD_WEIGHT.keyword);
  add(doc.text, FIELD_WEIGHT.body);

  let length = 0;
  for (const value of tf.values()) length += value;

  return { doc, tf, length };
}

let cachedIndex: IndexedDoc[] | null = null;
let cachedAvgLength = 0;
let cachedDf: Map<string, number> | null = null;

function index(): { docs: IndexedDoc[]; avgLength: number; df: Map<string, number> } {
  if (!cachedIndex || !cachedDf) {
    cachedIndex = knowledgeBase().map(indexDoc);
    cachedAvgLength =
      cachedIndex.reduce((sum, d) => sum + d.length, 0) / (cachedIndex.length || 1);
    cachedDf = new Map();
    for (const d of cachedIndex) {
      for (const term of d.tf.keys()) {
        cachedDf.set(term, (cachedDf.get(term) ?? 0) + 1);
      }
    }
  }
  return { docs: cachedIndex, avgLength: cachedAvgLength, df: cachedDf };
}

/**
 * BM25 with field-weighted term frequencies and saturated coverage.
 *
 * Retrieval for a corpus this small is a ranking *and* a rejection problem:
 * returning the closest document to an out-of-scope question is worse than
 * returning nothing. Callers apply the relevance floor (see `answer`).
 */
export function retrieve(query: string, k = 4): RetrievedDoc[] {
  const { docs, avgLength, df } = index();
  const queryTerms = [...new Set(tokenize(query))];
  const normalized = query.toLowerCase().trim();

  /**
   * Phrase pass. Some keywords are multi-word phrases whose words are all
   * stopwords ("what can you do"), so tokenizing the query leaves nothing to
   * match and the document becomes unreachable. Matching the phrases a document
   * declares directly keeps those reachable without weakening the term scoring.
   */
  const phraseHits = new Map<string, number>();
  for (const entry of docs) {
    for (const keyword of entry.doc.keywords) {
      const phrase = keyword.toLowerCase().trim();
      if (phrase.includes(" ") && normalized.includes(phrase)) {
        phraseHits.set(entry.doc.id, Math.max(phraseHits.get(entry.doc.id) ?? 0, PHRASE_WEIGHT));
      }
    }
  }

  if (queryTerms.length === 0) {
    // Nothing to rank on terms — return any phrase matches on their own.
    return docs
      .filter((entry) => phraseHits.has(entry.doc.id))
      .map((entry) => ({
        doc: entry.doc,
        score: phraseHits.get(entry.doc.id) ?? 0,
        matched: [entry.doc.keywords.find((keyword) => normalized.includes(keyword.toLowerCase())) ?? ""],
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  const k1 = 1.2;
  const b = 0.5;

  const scored = docs.map((entry) => {
    let raw = phraseHits.get(entry.doc.id) ?? 0;
    const matched: string[] = [];

    for (const term of queryTerms) {
      const freq = entry.tf.get(term);
      if (!freq) continue;
      const docFreq = df.get(term) ?? 1;
      const idf = Math.log(1 + (docs.length - docFreq + 0.5) / (docFreq + 0.5));
      const saturation = (freq * (k1 + 1)) / (freq + k1 * (1 - b + (b * entry.length) / avgLength));
      raw += idf * saturation;
      matched.push(term);
    }

    if (matched.length === 0 && raw === 0) return { doc: entry.doc, score: 0, matched };

    /**
     * Coverage uses a square-root curve, not raw ratio: matching 1 of 4 terms
     * should be penalised hard, but 3 of 4 shouldn't be punished for missing a
     * filler word. A linear multiplier previously let a single incidental match
     * — "france" — score like a genuine one.
     */
    const coverage = Math.sqrt(matched.length / queryTerms.length);
    return { doc: entry.doc, score: raw * coverage, matched };
  });

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
