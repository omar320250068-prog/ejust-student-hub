/**
 * Pure chat contracts shared by the API routes and the client UI.
 *
 * Keep this module free of server-only imports so Node's test runner and the
 * browser bundle can validate the same channel, content, and role rules.
 */

export const DEFAULT_CHAT_CHANNEL = "general";
export const CHANNEL_SLUG_PATTERN = /^[a-z0-9-]{2,32}$/;
export const MAX_MESSAGE_LENGTH = 500;
export const DEFAULT_MESSAGE_LIMIT = 50;
export const MAX_MESSAGE_LIMIT = 100;

export type ChatRole = "STUDENT" | "TA" | "ADMIN";

export interface ChatMessage {
  id: string;
  channel: string;
  userId: string;
  userName: string;
  userRole: ChatRole;
  content: string;
  isPinned: boolean;
  createdAt: string;
  /** Client-only marker for an optimistic message that has not been saved yet. */
  pending?: boolean;
}

export type MessageContentResult =
  | { ok: true; value: string }
  | { ok: false; error: "invalid" | "empty" | "too_long" };

/** Normalize user input into a safe lowercase channel slug, or fall back. */
export function normalizeChannelSlug(
  input: unknown,
  fallback = DEFAULT_CHAT_CHANNEL,
): string {
  if (typeof input !== "string") return fallback;

  const slug = input
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return CHANNEL_SLUG_PATTERN.test(slug) ? slug : fallback;
}

/** Course-room slugs stay compact: CSE 101 -> cse101, not cse-101. */
export function courseCodeToChannel(
  input: unknown,
  fallback = DEFAULT_CHAT_CHANNEL,
): string {
  if (typeof input !== "string") return fallback;
  const code = input.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return CHANNEL_SLUG_PATTERN.test(code) ? code : fallback;
}

/** Trim and validate plain-text message content without HTML escaping. */
export function validateMessageContent(input: unknown): MessageContentResult {
  if (typeof input !== "string") return { ok: false, error: "invalid" };

  // Drop NUL bytes and normalize line endings; React renders the result as text.
  const value = input.replace(/\0/g, "").replace(/\r\n?/g, "\n").trim();
  if ([...value].length === 0) return { ok: false, error: "empty" };
  if ([...value].length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: "too_long" };
  }
  return { ok: true, value };
}

/** Unapproved TAs must not inherit staff display or moderation powers. */
export function resolveChatRole(role: unknown, taStatus?: unknown): ChatRole {
  if (role === "ADMIN") return "ADMIN";
  if (role === "TA" && taStatus === "APPROVED") return "TA";
  return "STUDENT";
}

export interface ChatActor {
  id: string;
  role: ChatRole;
}

export function canDeleteMessage(
  actor: ChatActor,
  message: { userId: string },
): boolean {
  return actor.role === "ADMIN" || actor.id === message.userId;
}

export function canPinMessage(role: ChatRole): boolean {
  return role === "ADMIN";
}

/** Parse an ISO cursor; unknown or malformed cursors are ignored. */
export function parseAfterTimestamp(input: unknown): string | null {
  if (typeof input !== "string" || input.trim() === "") return null;
  const time = Date.parse(input);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

export function parseMessageLimit(
  input: unknown,
  fallback = DEFAULT_MESSAGE_LIMIT,
  max = MAX_MESSAGE_LIMIT,
): number {
  if (typeof input === "string" && input.trim() === "") return fallback;
  const value = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(value)));
}
