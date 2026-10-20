import { NextResponse } from "next/server";
import { knowledgeBase } from "@/lib/rag/knowledge";

/**
 * Placeholder for the Supabase + pgvector sync.
 *
 * When credentials exist this handler should: embed every document in
 * `knowledgeBase()` and upsert into `campus_documents(doc_id, title, category,
 * content, embedding vector(1536))`. Until `SUPABASE_URL` and
 * `SUPABASE_SERVICE_ROLE_KEY` are set it simply reports readiness.
 */
export async function GET() {
  const docs = knowledgeBase();
  const configured = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  return NextResponse.json({
    status: configured ? "ready" : "not_configured",
    documents: docs.length,
    retriever: "bm25-local",
    wouldEmbed: configured ? docs.length : 0,
    requiredEnv: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    note: configured
      ? "Credentials detected. Implement the embedding upsert in this handler to switch retrieval to pgvector."
      : "No Supabase credentials found; the app uses the local BM25 retriever.",
  });
}
