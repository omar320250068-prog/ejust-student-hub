import { NextResponse } from "next/server";
import { localSource, type KnowledgeSource } from "@/lib/rag/answer";
import { knowledgeBase } from "@/lib/rag/knowledge";

/** Same injectable source as the chat route — swapping it is the only deployment change. */
const source: KnowledgeSource = localSource;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  if (!query) {
    // No query: report what the knowledge base covers so callers can verify wiring.
    const docs = knowledgeBase();
    const byCategory: Record<string, number> = {};
    for (const doc of docs) {
      byCategory[doc.category] = (byCategory[doc.category] ?? 0) + 1;
    }
    return NextResponse.json({ documents: docs.length, byCategory, retriever: "bm25-local" });
  }

  const results = source.retrieve(query.slice(0, 500), 5).map((r) => ({
    id: r.doc.id,
    title: r.doc.title,
    category: r.doc.category,
    score: Number(r.score.toFixed(3)),
    matched: r.matched,
  }));

  return NextResponse.json({ query, results });
}
