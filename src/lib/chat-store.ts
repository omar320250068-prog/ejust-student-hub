/**
 * Neon PostgreSQL persistence for campus/course chat messages.
 * Server-only; the HTTP layer stays a thin adapter around these operations.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import {
  resolveChatRole,
  type ChatMessage,
  type ChatRole,
} from "./chat-validation";

type NeonSql = ReturnType<typeof neon>;

function getSql(): NeonSql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is missing.");
  return neon(url);
}

let schemaReady: Promise<void> | null = null;

async function ensureChatSchema(sql: NeonSql): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id text PRIMARY KEY,
          channel text NOT NULL,
          user_id text NOT NULL,
          user_name text NOT NULL,
          user_role text NOT NULL CHECK (user_role IN ('STUDENT', 'TA', 'ADMIN')),
          content text NOT NULL,
          is_pinned boolean NOT NULL DEFAULT FALSE,
          created_at timestamptz NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS chat_messages_channel_idx ON chat_messages (channel)`;
      await sql`CREATE INDEX IF NOT EXISTS chat_messages_channel_created_at_idx ON chat_messages (channel, created_at DESC)`;
    })().catch((error: unknown) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

async function readySql(): Promise<NeonSql> {
  const sql = getSql();
  await ensureChatSchema(sql);
  return sql;
}

interface ChatRow {
  id: string;
  channel: string;
  user_id: string;
  user_name: string;
  user_role: string;
  content: string;
  is_pinned: boolean;
  created_at: Date | string;
}

function mapRow(row: ChatRow): ChatMessage {
  const createdAt = new Date(row.created_at);
  return {
    id: row.id,
    channel: row.channel,
    userId: row.user_id,
    userName: row.user_name,
    userRole: resolveChatRole(row.user_role),
    content: row.content,
    isPinned: row.is_pinned === true,
    createdAt: Number.isNaN(createdAt.getTime())
      ? new Date().toISOString()
      : createdAt.toISOString(),
  };
}

export interface ListChatMessagesInput {
  channel: string;
  after?: string | null;
  limit: number;
}

/** Recent messages in chronological order plus the channel's pinned notices. */
export async function listChatMessages(input: ListChatMessagesInput): Promise<{
  messages: ChatMessage[];
  pinned: ChatMessage[];
}> {
  const sql = await readySql();

  let recentRows: ChatRow[];
  if (input.after) {
    recentRows = (await sql`
      SELECT id, channel, user_id, user_name, user_role, content, is_pinned, created_at
      FROM chat_messages
      WHERE channel = ${input.channel} AND created_at > ${input.after}
      ORDER BY created_at ASC
      LIMIT ${input.limit}
    `) as ChatRow[];
  } else {
    recentRows = (await sql`
      SELECT id, channel, user_id, user_name, user_role, content, is_pinned, created_at
      FROM chat_messages
      WHERE channel = ${input.channel}
      ORDER BY created_at DESC
      LIMIT ${input.limit}
    `) as ChatRow[];
  }

  const pinnedRows = (await sql`
    SELECT id, channel, user_id, user_name, user_role, content, is_pinned, created_at
    FROM chat_messages
    WHERE channel = ${input.channel} AND is_pinned = TRUE
    ORDER BY created_at DESC
    LIMIT 5
  `) as ChatRow[];

  const messages = recentRows.map(mapRow);
  if (!input.after) messages.reverse();

  return { messages, pinned: pinnedRows.map(mapRow) };
}

export interface CreateChatMessageInput {
  channel: string;
  userId: string;
  userName: string;
  userRole: ChatRole;
  content: string;
}

export async function createChatMessage(
  input: CreateChatMessageInput,
): Promise<ChatMessage> {
  const sql = await readySql();
  const rows = (await sql`
    INSERT INTO chat_messages (
      id, channel, user_id, user_name, user_role, content, is_pinned, created_at
    ) VALUES (
      ${randomUUID()}, ${input.channel}, ${input.userId}, ${input.userName},
      ${input.userRole}, ${input.content}, FALSE, NOW()
    )
    RETURNING id, channel, user_id, user_name, user_role, content, is_pinned, created_at
  `) as ChatRow[];

  if (!rows[0]) throw new Error("Chat message insert returned no row.");
  return mapRow(rows[0]);
}

export async function getChatMessage(id: string): Promise<ChatMessage | null> {
  const sql = await readySql();
  const rows = (await sql`
    SELECT id, channel, user_id, user_name, user_role, content, is_pinned, created_at
    FROM chat_messages
    WHERE id = ${id}
    LIMIT 1
  `) as ChatRow[];
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deleteChatMessage(id: string): Promise<ChatMessage | null> {
  const sql = await readySql();
  const rows = (await sql`
    DELETE FROM chat_messages
    WHERE id = ${id}
    RETURNING id, channel, user_id, user_name, user_role, content, is_pinned, created_at
  `) as ChatRow[];
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Pin or unpin a message, keeping a single active announcement per channel. */
export async function setChatMessagePinned(
  id: string,
  isPinned: boolean,
): Promise<ChatMessage | null> {
  const sql = await readySql();
  const targets = (await sql`
    SELECT channel FROM chat_messages WHERE id = ${id} LIMIT 1
  `) as { channel: string }[];
  const target = targets[0];
  if (!target) return null;

  if (isPinned) {
    await sql`
      UPDATE chat_messages
      SET is_pinned = FALSE
      WHERE channel = ${target.channel} AND is_pinned = TRUE AND id <> ${id}
    `;
  }

  const rows = (await sql`
    UPDATE chat_messages
    SET is_pinned = ${isPinned}
    WHERE id = ${id}
    RETURNING id, channel, user_id, user_name, user_role, content, is_pinned, created_at
  `) as ChatRow[];
  return rows[0] ? mapRow(rows[0]) : null;
}
