import { NextRequest, NextResponse } from "next/server";
import { getViewer } from "@/lib/permissions";
import { enforceRateLimit } from "@/lib/rate-limit-api";
import {
  createChatMessage,
  listChatMessages,
} from "@/lib/chat-store";
import {
  normalizeChannelSlug,
  parseAfterTimestamp,
  parseMessageLimit,
  resolveChatRole,
  validateMessageContent,
} from "@/lib/chat-validation";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

interface CreateMessageBody {
  channel?: unknown;
  content?: unknown;
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE_HEADERS });
}

/** Public, poll-friendly feed. Pinned notices are returned separately. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const channel = normalizeChannelSlug(params.get("channel"));
  const after = parseAfterTimestamp(params.get("after"));
  const limit = parseMessageLimit(params.get("limit"));

  try {
    const { messages, pinned } = await listChatMessages({ channel, after, limit });
    return NextResponse.json(
      { channel, messages, pinned },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("[chat/messages] list failed:", error);
    return errorResponse("Could not load messages.", 500);
  }
}

/** Authenticated, rate-limited plain-text message creation. */
export async function POST(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return errorResponse("Unauthorized", 401);

  const limited = await enforceRateLimit(request, "chatMessage", {
    userId: viewer.userId,
    email: viewer.email,
  });
  if (limited) return limited;

  let body: CreateMessageBody;
  try {
    body = (await request.json()) as CreateMessageBody;
  } catch {
    return errorResponse("Invalid JSON body.", 400);
  }

  const content = validateMessageContent(body.content);
  if (!content.ok) {
    return errorResponse(
      content.error === "too_long"
        ? "Message must be 500 characters or fewer."
        : "Message cannot be empty.",
      400
    );
  }

  const channel = normalizeChannelSlug(body.channel);
  const role = resolveChatRole(viewer.role, viewer.taStatus);
  const name =
    viewer.name?.trim() ||
    viewer.email?.split("@")[0] ||
    "Student";

  try {
    const message = await createChatMessage({
      channel,
      userId: viewer.userId,
      userName: name.slice(0, 80),
      userRole: role,
      content: content.value,
    });
    return NextResponse.json(
      { message },
      { status: 201, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("[chat/messages] create failed:", error);
    return errorResponse("Could not send message.", 500);
  }
}
