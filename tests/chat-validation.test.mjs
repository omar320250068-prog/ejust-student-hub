import test from "node:test";
import assert from "node:assert/strict";
import {
  canDeleteMessage,
  canPinMessage,
  courseCodeToChannel,
  normalizeChannelSlug,
  parseAfterTimestamp,
  parseMessageLimit,
  resolveChatRole,
  validateMessageContent,
} from "../src/lib/chat-validation.ts";
import { RATE_LIMIT_POLICIES } from "../src/lib/rate-limit.ts";

test("channel slugs are normalized and invalid values fall back to general", () => {
  assert.equal(normalizeChannelSlug("  #General "), "general");
  assert.equal(normalizeChannelSlug("BUS-COMMUTE"), "bus-commute");
  assert.equal(normalizeChannelSlug("study_groups"), "study-groups");
  assert.equal(normalizeChannelSlug("CSE101"), "cse101");
  assert.equal(normalizeChannelSlug("bad channel!"), "bad-channel");
  assert.equal(normalizeChannelSlug("a"), "general");
  assert.equal(normalizeChannelSlug("x".repeat(33)), "general");
  assert.equal(normalizeChannelSlug(null), "general");
});

test("course codes become compact course-room slugs", () => {
  assert.equal(courseCodeToChannel("CSE 101"), "cse101");
  assert.equal(courseCodeToChannel("#MATH-201"), "math201");
  assert.equal(courseCodeToChannel("!!!"), "general");
});

test("message content is trimmed, non-empty, and limited to 500 characters", () => {
  assert.deepEqual(validateMessageContent("  Hello campus  "), {
    ok: true,
    value: "Hello campus",
  });
  assert.deepEqual(validateMessageContent("   \n\t "), { ok: false, error: "empty" });
  assert.equal(validateMessageContent("a".repeat(500)).ok, true);
  assert.deepEqual(validateMessageContent("a".repeat(501)), {
    ok: false,
    error: "too_long",
  });
  assert.deepEqual(validateMessageContent(123), { ok: false, error: "invalid" });
  assert.equal(validateMessageContent("line1\nline2").value, "line1\nline2");
});

test("chat roles only mark approved TAs and admins as staff", () => {
  assert.equal(resolveChatRole("TA", "APPROVED"), "TA");
  assert.equal(resolveChatRole("TA", "PENDING"), "STUDENT");
  assert.equal(resolveChatRole("ADMIN", "NONE"), "ADMIN");
  assert.equal(resolveChatRole("STUDENT", "APPROVED"), "STUDENT");
});

test("message deletion is author-or-admin and pinning is admin-only", () => {
  const author = { id: "student-1", role: "STUDENT" };

  assert.equal(canDeleteMessage(author, { userId: "student-1" }), true);
  assert.equal(canDeleteMessage(author, { userId: "student-2" }), false);
  assert.equal(
    canDeleteMessage({ id: "admin-1", role: "ADMIN" }, { userId: "student-2" }),
    true,
  );
  assert.equal(
    canDeleteMessage({ id: "ta-1", role: "TA" }, { userId: "student-2" }),
    false,
  );

  assert.equal(canPinMessage("ADMIN"), true);
  assert.equal(canPinMessage("TA"), false);
  assert.equal(canPinMessage("STUDENT"), false);
});

test("chat cursors and limits are parsed safely", () => {
  assert.equal(
    parseAfterTimestamp("2026-01-01T00:00:00.000Z"),
    "2026-01-01T00:00:00.000Z",
  );
  assert.equal(parseAfterTimestamp("not-a-date"), null);
  assert.equal(parseAfterTimestamp(null), null);
  assert.equal(parseMessageLimit("0"), 1);
  assert.equal(parseMessageLimit("999"), 100);
  assert.equal(parseMessageLimit("abc"), 50);
});

test("chat posting uses an explicit flood-protection policy", () => {
  assert.deepEqual(RATE_LIMIT_POLICIES.chatMessage, {
    limit: 30,
    windowMs: 600_000,
  });
});
