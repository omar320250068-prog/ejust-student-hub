import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LOGIN_REDIRECT,
  isPublicApi,
  isPublicAsset,
  isPublicPath,
  loginRedirectPath,
  requiresAuthForApi,
  roleAllowsPath,
  safeNextPath,
} from "../src/lib/auth-gate.ts";

test("landing and auth routes are public", () => {
  for (const path of [
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/api/auth/callback/credentials",
    "/api/cron/gmail-sync",
  ]) {
    assert.equal(isPublicPath(path), true, `${path} should be public`);
  }
});

test("chat page and message feed are public for guests", () => {
  assert.equal(isPublicPath("/chat"), true, "/chat should be public");
  assert.equal(isPublicApi("/api/chat/messages"), true, "message feed should be public");
  assert.equal(isPublicApi("/api/chat/messages/abc123"), false, "moderation stays protected");
  assert.equal(isPublicApi("/api/chat"), false, "AI assistant stays protected");
});

test("student tools are protected and redirect to login with next", () => {
  for (const path of ["/master-plan", "/assistant", "/gpa", "/today", "/timetable", "/contribute", "/admin", "/ta"]) {
    assert.equal(isPublicPath(path), false, `${path} should require a session`);
    assert.equal(requiresAuthForApi(path), false);
  }
  assert.equal(
    loginRedirectPath("/master-plan", "?day=mon"),
    "/login?next=%2Fmaster-plan%3Fday%3Dmon"
  );
  assert.equal(
    loginRedirectPath("/assistant?q=rooms", ""),
    "/login?next=%2Fassistant%3Fq%3Drooms"
  );
});

test("other protected API namespaces stay private", () => {
  assert.equal(isPublicApi("/api/auth/reset-password"), true);
  assert.equal(isPublicApi("/api/cron/gmail-sync"), true);
  assert.equal(isPublicApi("/api/knowledge"), false);
  assert.equal(isPublicPath("/api/knowledge"), false);
  assert.equal(requiresAuthForApi("/api/knowledge"), true);
  assert.equal(requiresAuthForApi("/api/sync"), true);
});

test("static assets are recognized as public", () => {
  for (const path of [
    "/_next/static/chunks/app.js",
    "/favicon.ico",
    "/manifest.json",
    "/downloads/ejust-hub-sync-extension.zip",
    "/icons/icon-192.png",
    "/images/campus/main-gate.jpg.png",
  ]) {
    assert.equal(isPublicAsset(path), true, `${path} should be a public asset`);
  }
  assert.equal(isPublicAsset("/api/knowledge"), false);
});

test("next validation blocks open redirects", () => {
  for (const value of [
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "/%2f%2fevil.com",
    "/%5Cevil.com",
    "relative/path",
    "",
    null,
    undefined,
  ]) {
    assert.equal(safeNextPath(value), DEFAULT_LOGIN_REDIRECT, `rejected: ${value}`);
  }
  assert.equal(safeNextPath("/master-plan?day=mon"), "/master-plan?day=mon");
  assert.equal(safeNextPath("/gpa#target"), "/gpa#target");
});

test("role guards allow admin and approved TA only", () => {
  assert.equal(roleAllowsPath("/admin", { role: "ADMIN" }), true);
  assert.equal(roleAllowsPath("/admin", { role: "STUDENT" }), false);
  assert.equal(roleAllowsPath("/admin", { role: "TA", taStatus: "APPROVED" }), false);
  assert.equal(roleAllowsPath("/api/admin/qa/1", { role: "ADMIN" }), true);

  assert.equal(roleAllowsPath("/ta", { role: "ADMIN" }), true);
  assert.equal(roleAllowsPath("/ta", { role: "TA", taStatus: "APPROVED" }), true);
  assert.equal(roleAllowsPath("/ta", { role: "TA", taStatus: "PENDING" }), false);
  assert.equal(roleAllowsPath("/ta", { role: "STUDENT", taStatus: "APPROVED" }), false);
  assert.equal(roleAllowsPath("/api/ta/apply", { role: "TA", taStatus: "PENDING" }), false);

  assert.equal(roleAllowsPath("/master-plan", { role: "STUDENT" }), true);
  assert.equal(roleAllowsPath("/admin", null), false);
});
