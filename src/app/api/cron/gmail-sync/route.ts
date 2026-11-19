/**
 * Scheduled Gmail → Neon digest sync.
 *
 * Vercel Cron calls this route with `Authorization: Bearer $CRON_SECRET`.
 * When Gmail credentials are absent the route is a deliberate no-op, so a
 * freshly deployed project does not need any Gmail setup to build or run.
 */
import { timingSafeEqual } from "node:crypto";
import { connection, NextResponse } from "next/server";
import { extractAiJson } from "@/lib/ai-extract";
import {
  GMAIL_SYSTEM_PROMPT,
  extractTextFromGmailPayload,
  filterUnprocessedMessages,
  getGmailHeader,
  gmailQueryForRecent,
  mergeGmailDigests,
  normalizeGmailDigest,
  parseGmailDigest,
  type GmailDigest,
  type GmailPayload,
} from "@/lib/gmail-digest";
import {
  getProcessedGmailIds,
  markGmailMessagesProcessed,
  saveGmailDigest,
} from "@/lib/gmail-store";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me/";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const MAX_MESSAGES = 20;
const AI_TIMEOUT_MS = 6_000;

const EMPTY_DIGEST: GmailDigest = { exams: [], scheduleChanges: [], announcements: [] };

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`token_refresh_failed:${response.status}`);

  const payload = (await response.json()) as { access_token?: unknown };
  if (typeof payload.access_token !== "string" || !payload.access_token) {
    throw new Error("token_refresh_missing_access_token");
  }
  return payload.access_token;
}

interface GmailListResponse {
  messages?: { id?: unknown }[];
}

interface GmailMessageResponse {
  id?: string;
  payload?: GmailPayload;
}

async function gmailFetch<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`gmail_request_failed:${response.status}`);
  return (await response.json()) as T;
}

export async function GET(request: Request) {
  // A cron run must execute on every request. With Cache Components enabled,
  // build-time env values would otherwise let this GET be prerendered.
  await connection();

  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    return NextResponse.json({ ok: true, skipped: true, reason: "gmail_not_configured" });
  }

  try {
    const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken);
    const query = gmailQueryForRecent(2);
    const list = await gmailFetch<GmailListResponse>(
      `messages?maxResults=${MAX_MESSAGES}&q=${encodeURIComponent(query)}`,
      accessToken
    );
    const refs = (list.messages ?? []).flatMap((item) =>
      typeof item?.id === "string" ? [{ id: item.id }] : []
    );
    const processedIds = await getProcessedGmailIds(refs.map((item) => item.id));
    const pending = filterUnprocessedMessages(refs, processedIds).slice(0, MAX_MESSAGES);

    const deterministic: GmailDigest[] = [];
    const claimedIds: string[] = [];
    const aiInput: string[] = [];

    for (const message of pending) {
      const detail = await gmailFetch<GmailMessageResponse>(
        `messages/${encodeURIComponent(message.id)}?format=full`,
        accessToken
      );
      const payload = detail.payload ?? null;
      const subject = getGmailHeader(payload, "Subject");
      const text = extractTextFromGmailPayload(payload);
      if (!text) continue;

      deterministic.push(parseGmailDigest(text, subject));
      aiInput.push(`--- message ${message.id} ---\nSubject: ${subject}\n${text}`);
      claimedIds.push(message.id);
    }

    // One AI call for the whole batch keeps the cron fast; the deterministic
    // parser already covers every message if AI is unavailable or misbehaves.
    const aiValue = aiInput.length > 0
      ? await extractAiJson({
          system: GMAIL_SYSTEM_PROMPT,
          text: aiInput.join("\n"),
          modelEnv: "GMAIL_AI_MODEL",
          timeoutMs: AI_TIMEOUT_MS,
        })
      : null;
    const aiDigest = aiValue === null ? EMPTY_DIGEST : normalizeGmailDigest(aiValue);
    const merged = mergeGmailDigests(...deterministic, aiDigest);

    const saved = await saveGmailDigest(merged);
    const claimed = await markGmailMessagesProcessed(claimedIds);

    return NextResponse.json(
      {
        ok: true,
        scanned: refs.length,
        processed: claimed,
        aiUsed: aiValue !== null,
        ...saved,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("gmail cron sync failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "gmail_sync_failed" }, { status: 500 });
  }
}
