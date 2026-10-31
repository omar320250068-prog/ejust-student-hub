import { retrieve, type RetrievedDoc } from "./retriever";
import { isInDomain } from "./knowledge";

export interface Citation {
  id: string;
  title: string;
  category: string;
}

export interface Answer {
  text: string;
  citations: Citation[];
  confidence: "high" | "medium" | "low" | "none";
  /** Retrieved passages, exposed so the UI can show its work. */
  sources: RetrievedDoc[];
}

export interface KnowledgeSource {
  retrieve(query: string, k?: number): RetrievedDoc[];
}

/** Lexical BM25 today; swap for a pgvector-backed source when Supabase is wired up. */
export const localSource: KnowledgeSource = { retrieve };

/**
 * Relevance floor. BM25 scores are unbounded and corpus-relative, so this is
 * calibrated against the acceptance suite in `scripts/rag-acceptance.ts` for the
 * current ~47-document knowledge base.
 *
 * It only decides whether a retrieved document is worth citing. Whether the
 * question is in scope at all is a separate question, answered up front by
 * DOMAIN_VOCABULARY — ranking cannot decide it, because BM25 scores a rare word
 * high whether or not the document is about it.
 */
const RELEVANT = 1.2;
const CONFIDENT = 3.0;

/**
 * Decide whether a retrieved document is relevant enough to cite, as opposed to
 * merely being the closest thing in the corpus.
 */
function isCredible(result: RetrievedDoc): boolean {
  return result.score >= RELEVANT;
}

/**
 * Local extractive answerer: no model, no network, no API key.
 *
 * It composes a reply strictly from retrieved text, which means it cannot
 * hallucinate — the trade-off is that it paraphrases poorly. Detailed,
 * human-readable prose is generated per document category, and anything the
 * corpus doesn't cover deliberately returns "not found" instead of guessing.
 */
export function answer(
  query: string,
  source: KnowledgeSource = localSource,
  k = 4
): Answer {
  /**
   * Gate on subject matter before retrieval. Ranking can't reject an
   * out-of-scope question — it can only return its closest document, and for
   * "what is the capital of France" that document is the Eiffel scholarship,
   * delivered with full confidence. See DOMAIN_VOCABULARY for the measurements.
   */
  if (!isInDomain(query)) {
    return notFound();
  }

  const sources = source.retrieve(query, k);
  const strong = sources.filter(isCredible);

  if (strong.length === 0) {
    return notFound();
  }

  const top = strong[0];
  const best = top.score;
  const confidence: Answer["confidence"] =
    best >= CONFIDENT ? "high" : best >= RELEVANT * 2 ? "medium" : "low";

  const body = expand(top);

  const extras = strong
    .slice(1, 3)
    .filter(isCredible)
    .map((s) => `• ${s.doc.title} — ${firstSentence(s.doc.text)}`);

  const text = extras.length
    ? `${body}\n\nRelated:\n${extras.join("\n")}`
    : body;

  return {
    text,
    citations: strong.map((s) => ({
      id: s.doc.id,
      title: s.doc.title,
      category: s.doc.category,
    })),
    confidence,
    sources,
  };
}

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]*[.!?]/);
  return (match ? match[0] : text).trim();
}

/**
 * The one honest refusal. Two situations reach it — a question outside the
 * supported subjects, or one inside them that the corpus has nothing on — and
 * both are truthfully the same answer, so they share a wording.
 */
function notFound(): Answer {
  return {
    text: [
      "I couldn't find that in the local knowledge base — so rather than guess, I'll say so.",
      "",
      "I can answer questions about: campus buildings, gates and parking; walking directions; the GPA scale; the timetable builder; the exam planner; cafeteria menu and prices; EJUST scholarships; and how this app works.",
      "For CSIT, this includes graduation requirements, promotion thresholds, approved programs, course codes, the academic calendar, Building 7 and Building 10 rooms, timetable groups, and exam seat assignment rules.",
    ].join("\n"),
    citations: [],
    confidence: "none",
    sources: [],
  };
}

function expand(result: RetrievedDoc): string {
  const { doc } = result;
  const [head, ...rest] = splitSentences(doc.text);

  switch (doc.category) {
    case "campus": {
      const detail = rest.join(" ").trim();
      return [`${head}`, detail ? `\n${detail}` : ""].filter(Boolean).join("");
    }
    case "scholarship": {
      const lines = sentenceList(doc.text);
      return [`${lines[0]}`, ...lines.slice(1).map((l) => `- ${l}`)].join("\n");
    }
    default:
      return doc.text;
  }
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function sentenceList(text: string): string[] {
  return splitSentences(text).map((s) => s.replace(/\.$/, ""));
}
