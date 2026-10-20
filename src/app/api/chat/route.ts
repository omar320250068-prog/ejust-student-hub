import { NextResponse } from "next/server";
import { answer, localSource, type KnowledgeSource } from "@/lib/rag/answer";

/**
 * Chat endpoint.
 *
 * The retrieval source is intentionally injectable: switch `localSource` for a
 * Supabase + pgvector implementation and the route contract stays identical.
 */
const source: KnowledgeSource = localSource;

interface ChatRequestBody {
  message?: unknown;
}

export async function POST(request: Request) {
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.message !== "string" || body.message.trim().length === 0) {
    return NextResponse.json({ error: "Field 'message' is required." }, { status: 400 });
  }

  const message = body.message.trim().slice(0, 500);

  try {
    const payload = answer(message, source);

    return NextResponse.json({
      reply: payload.text,
      confidence: payload.confidence,
      citations: payload.citations,
      sources: payload.sources.map((s) => ({
        id: s.doc.id,
        title: s.doc.title,
        category: s.doc.category,
        score: Number(s.score.toFixed(3)),
      })),
    });
  } catch (error) {
    console.error("[chat] retrieval failed:", error);
    return NextResponse.json(
      { error: "Something went wrong while searching the knowledge base." },
      { status: 500 }
    );
  }
}
