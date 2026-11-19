import { NextResponse } from "next/server";
import {
  importedExamKey,
  normalizeImportedRows,
  parseExamText,
  type ImportedExamRow,
} from "@/lib/exam-import";

const MAX_TEXT_LENGTH = 12_000;
const AI_TIMEOUT_MS = 6_000;

interface ParseRequestBody {
  text?: unknown;
}

interface AiResponse {
  choices?: { message?: { content?: string } }[];
}

function mergeRows(aiRows: ImportedExamRow[], fallbackRows: ImportedExamRow[]): ImportedExamRow[] {
  const seen = new Set(aiRows.map(importedExamKey));
  const merged = [...aiRows];
  for (const row of fallbackRows) {
    const key = importedExamKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged.slice(0, 100);
}

async function extractWithAi(text: string): Promise<ImportedExamRow[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_EXAM_MODEL || "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Extract exam schedules from university email text. Return only a JSON object " +
              "shaped as {\"rows\":[{\"courseCode\":\"CSC341\",\"examType\":\"MIDTERM\"," +
              "\"examDate\":\"2026-12-13\",\"startTime\":\"10:00\",\"endTime\":\"12:00\"," +
              "\"building\":\"B\",\"room\":\"B4\"}]}. Allowed examType values are MIDTERM, " +
              "FINAL and QUIZ (default MIDTERM). Dates must be YYYY-MM-DD and times HH:MM " +
              "(24-hour). Skip lines without both a course code and a date. Use TBA when a " +
              "location is missing. No markdown or commentary.",
          },
          { role: "user", content: text },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) return [];

    const payload = (await response.json()) as AiResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return [];
    const parsed = JSON.parse(content) as unknown;
    const rows = Array.isArray(parsed)
      ? parsed
      : (parsed as { rows?: unknown }).rows ?? [];
    return normalizeImportedRows(rows as Record<string, unknown>[]);
  } catch {
    // AI is best-effort; the deterministic parser always provides a usable result.
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/** Parse pasted schedule text into reviewable exam rows. */
export async function POST(request: Request) {
  let body: ParseRequestBody;
  try {
    body = (await request.json()) as ParseRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    return NextResponse.json({ error: "Field 'text' is required." }, { status: 400 });
  }
  const text = body.text.trim();
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "Text is too long." }, { status: 413 });
  }

  const fallbackRows = parseExamText(text);
  const aiRows = await extractWithAi(text);
  const rows = mergeRows(aiRows, fallbackRows);

  return NextResponse.json({
    rows,
    method: aiRows.length > 0 ? "ai" : "regex",
  });
}
