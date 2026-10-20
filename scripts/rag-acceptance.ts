/**
 * Retrieval acceptance suite for the campus assistant (stage 12).
 *
 * Run with:  npx tsx scripts/rag-acceptance.ts
 *
 * The assistant is deliberately extractive: it answers only from the local
 * knowledge base and refuses everything else. Two failure modes matter, and this
 * suite pins both:
 *
 *   - False answers: an in-scope question the corpus covers must be answered.
 *   - False confidence: an out-of-scope question must be refused rather than
 *     answered with the closest-matching document. Before the domain gate
 *     existed, "what is the capital of France" returned the Eiffel scholarship
 *     with full confidence, because BM25 scores the rare word "france" highly
 *     whether or not the document is about it.
 */
import { answer } from "../src/lib/rag/answer";

interface Case {
  query: string;
  expect: "answer" | "refuse";
  note: string;
}

const CASES: Case[] = [
  // --- In scope: must be answered ---
  { query: "Where is the Central Library?", expect: "answer", note: "campus location" },
  { query: "How is GPA calculated?", expect: "answer", note: "academics, single specific term" },
  { query: "when is the MEXT deadline", expect: "answer", note: "scholarship" },
  { query: "north parking", expect: "answer", note: "campus, terse phrasing" },
  { query: "cheap cafeteria food", expect: "answer", note: "cafeteria" },
  { query: "school cafeteria prices", expect: "answer", note: "cafeteria, synonym wording" },
  { query: "scholarships for Egyptian students", expect: "answer", note: "broad scholarship query" },
  { query: "how do I get to the Center of Excellence", expect: "answer", note: "entity by full name" },
  { query: "tell me about the Japanese Garden", expect: "answer", note: "wording absent from any title" },
  { query: "how many credits do I need", expect: "answer", note: "contains filler words" },
  { query: "what can you do", expect: "answer", note: "meta question about the app" },

  // --- Out of scope: must be refused ---
  { query: "what is the capital of France", expect: "refuse", note: "shares 'france' with a scholarship" },
  { query: "how do I cook pasta", expect: "refuse", note: "shares 'pasta' with the menu" },
  { query: "who won the 2018 world cup", expect: "refuse", note: "no overlap" },
  { query: "how do I fix my car engine", expect: "refuse", note: "no overlap" },
  { query: "what is the meaning of life", expect: "refuse", note: "no overlap" },
  { query: "how do i apply for a visa to germany", expect: "refuse", note: "shares 'germany' with a scholarship" },
  { query: "best restaurants in alexandria", expect: "refuse", note: "real place, but not campus knowledge" },
];

let failures = 0;

for (const testCase of CASES) {
  const result = answer(testCase.query);
  const actual: "answer" | "refuse" = result.confidence === "none" ? "refuse" : "answer";
  const passed = actual === testCase.expect;
  if (!passed) failures++;

  const top = result.sources[0];
  const detail = top
    ? `top=${top.doc.id} score=${top.score.toFixed(2)} matched=[${top.matched.join(",")}]`
    : "top=none";

  console.log(
    `${passed ? "PASS" : "FAIL"}  ${testCase.query}\n` +
      `        expected ${testCase.expect}, got ${actual} (confidence ${result.confidence}) — ${detail}\n` +
      `        ${testCase.note}`
  );
}

console.log(`\n${CASES.length - failures}/${CASES.length} correct`);
if (failures > 0) process.exit(1);
