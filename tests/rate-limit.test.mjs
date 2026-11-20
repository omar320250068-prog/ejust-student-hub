import test from "node:test";
import assert from "node:assert/strict";
import {
  RATE_LIMIT_POLICIES,
  clientIpFromHeaders,
  decideFromAttempts,
  rateLimitHeaders,
  rateLimitKey,
  retryAfterSeconds,
} from "../src/lib/rate-limit.ts";

const now = 1_000_000;

test("policies match the Phase 1 limits", () => {
  assert.deepEqual(RATE_LIMIT_POLICIES.otpSend, { limit: 5, windowMs: 600_000 });
  assert.deepEqual(RATE_LIMIT_POLICIES.otpVerify, { limit: 5, windowMs: 600_000 });
  assert.deepEqual(RATE_LIMIT_POLICIES.register, { limit: 10, windowMs: 900_000 });
  assert.deepEqual(RATE_LIMIT_POLICIES.login, { limit: 10, windowMs: 900_000 });
  assert.deepEqual(RATE_LIMIT_POLICIES.assistant, { limit: 20, windowMs: 600_000 });
  assert.deepEqual(RATE_LIMIT_POLICIES.resetRequest, { limit: 5, windowMs: 600_000 });
  assert.deepEqual(RATE_LIMIT_POLICIES.resetVerify, { limit: 5, windowMs: 600_000 });
});

test("sliding window allows up to the limit and then denies", () => {
  const policy = RATE_LIMIT_POLICIES.otpSend;
  const attempts = [now - 4_000, now - 3_000, now - 2_000, now - 1_000];

  const fourth = decideFromAttempts(attempts, now, policy);
  assert.equal(fourth.allowed, true);
  assert.equal(fourth.remaining, 0);
  assert.equal(fourth.retryAfterMs, 0);

  const fifth = decideFromAttempts([...attempts, now - 500], now, policy);
  assert.equal(fifth.allowed, false);
  assert.equal(fifth.remaining, 0);
  assert.ok(fifth.retryAfterMs > 0);
});

test("attempts at or before the cutoff age out of the window", () => {
  const policy = RATE_LIMIT_POLICIES.login;
  const old = now - policy.windowMs;
  const decision = decideFromAttempts(Array.from({ length: 10 }, () => old), now, policy);
  assert.equal(decision.allowed, true);
  assert.equal(decision.remaining, 9);
});

test("retry delay is based on the oldest surviving attempt", () => {
  const policy = RATE_LIMIT_POLICIES.resetVerify;
  const attempts = [now - 4_000, now - 1_000, now - 500, now - 100, now];
  const decision = decideFromAttempts(attempts, now, policy);
  assert.equal(decision.allowed, false);
  assert.equal(decision.retryAfterMs, policy.windowMs - 4_000);
  assert.equal(retryAfterSeconds(decision.retryAfterMs), Math.ceil((policy.windowMs - 4_000) / 1000));
});

test("bucket keys are stable and case-insensitive", () => {
  assert.equal(
    rateLimitKey("otpSend", "ip", "203.0.113.5", "Student@EJust.edu.eg"),
    rateLimitKey("otpSend", "ip", "203.0.113.5", "student@ejust.edu.eg")
  );
  assert.notEqual(
    rateLimitKey("otpSend", "ip", "203.0.113.5"),
    rateLimitKey("otpSend", "email", "203.0.113.5")
  );
});

test("client IP parsing prefers the first forwarded hop", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.9, 10.0.0.1",
    "x-real-ip": "198.51.100.2",
  });
  assert.equal(clientIpFromHeaders(headers), "203.0.113.9");
  assert.equal(clientIpFromHeaders(new Headers()), "unknown");
});

test("429 headers include Retry-After and quota information", () => {
  const policy = RATE_LIMIT_POLICIES.assistant;
  const decision = decideFromAttempts(Array.from({ length: 20 }, () => now), now, policy);
  const headers = rateLimitHeaders(policy, decision);
  assert.equal(headers["X-RateLimit-Limit"], "20");
  assert.equal(headers["X-RateLimit-Remaining"], "0");
  assert.equal(headers["Retry-After"], String(Math.ceil(decision.retryAfterMs / 1000)));
});
