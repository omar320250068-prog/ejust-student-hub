import { NextRequest, NextResponse } from "next/server";
import {
  deleteChatMessage,
  getChatMessage,
  setChatMessagePinned,
} from "@/lib/chat-store";
import { canDeleteMessage, canPinMessage, resolveChatRole } from "@/lib/chat-validation";
import { getViewer } from "@/lib/permissions";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const MESSAGE_ID_PATTERN = /^[A-Za-z0-9-]{1,128}$/;

interface RouteContext {
  params: Promise<{ id: string }>;
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE_HEADERS });
}

async function messageId(context: RouteContext): Promise<string | null> {
  const { id } = await context.params;
  return MESSAGE_ID_PATTERN.test(id) ? id : null;
}

/** Admin-only announcement control; unpinning the previous notice is atomic in the store. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const viewer = await getViewer();
  if (!viewer) return errorResponse("Unauthorized", 401);

  const role = resolveChatRole(viewer.role, viewer.taStatus);
  if (!canPinMessage(role)) return errorResponse("Admin only", 403);

  const id = await messageId(context);
  if (!id) return errorResponse("Invalid message id.", 400);

  let body: { isPinned?: unknown };
  try {
    body = (await request.json()) as { isPinned?: unknown };
  } catch {
    return errorResponse("Invalid JSON body.", 400);
  }
  if (typeof body.isPinned !== "boolean") {
    return errorResponse("Field 'isPinned' must be a boolean.", 400);
  }

  try {
    const message = await setChatMessagePinned(id, body.isPinned);
    if (!message) return errorResponse("Message not found.", 404);
    return NextResponse.json(
      { message },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("[chat/messages] pin failed:", error);
    return errorResponse("Could not update message.", 500);
  }
}

/** Authors may delete their own messages; admins may delete any message. */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const viewer = await getViewer();
  if (!viewer) return errorResponse("Unauthorized", 401);

  const id = await messageId(context);
  if (!id) return errorResponse("Invalid message id.", 400);

  try {
    const existing = await getChatMessage(id);
    if (!existing) return errorResponse("Message not found.", 404);

    const actor = { id: viewer.userId, role: resolveChatRole(viewer.role, viewer.taStatus) };
    if (!canDeleteMessage(actor, existing)) {
      return errorResponse("You cannot delete this message.", 403);
    }

    const message = await deleteChatMessage(id);
    if (!message) return errorResponse("Message not found.", 404);
    return NextResponse.json(
      { message },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("[chat/messages] delete failed:", error);
    return errorResponse("Could not delete message.", 500);
  }
}
