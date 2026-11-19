import test from "node:test";
import assert from "node:assert/strict";
import {
  EMAIL_VERIFICATION_TTL_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  canSubmitOtpAttempt,
  generateOtpCode,
  hashOtpCode,
  isOtpExpired,
  isOtpFormat,
  normalizeEjustEmail,
  otpExpiryDate,
  resendCooldownMs,
  validateEjustEmail,
} from "../src/lib/email-otp.ts";
import { createOtpGrant, verifyOtpGrant } from "../src/lib/email-otp-grant.ts";

test("validateEjustEmail accepts both E-JUST student and staff domains", () => {
  for (const email of [
    "student@ejust.edu.eg",
    "STUDENT@Student.EJUST.Edu.EG",
    "  name@student.ejust.edu.eg  ",
  ]) {
    assert.equal(validateEjustEmail(email), "ok", email);
  }
});

test("validateEjustEmail distinguishes malformed addresses from non-E-JUST ones", () => {
  for (const email of ["someone@gmail.com", "a@ejust.com", "x@not-ejust.edu.eg"]) {
    assert.equal(validateEjustEmail(email), "not-ejust", email);
  }
  for (const email of ["", "   ", "abc", "a@", "@ejust.edu.eg", "a b@ejust.edu.eg", 42, null]) {
    assert.equal(validateEjustEmail(email), "invalid", String(email));
  }
});

test("normalizeEjustEmail trims and lowercases", () => {
  assert.equal(normalizeEjustEmail("  Name@Student.EJUST.edu.eg "), "name@student.ejust.edu.eg");
});

test("isOtpFormat only accepts six digits", () => {
  for (const value of ["000000", "123456", "999999"]) assert.equal(isOtpFormat(value), true);
  for (const value of ["", "12345", "1234567", "12a456", " 123456", 123456, null]) {
    assert.equal(isOtpFormat(value), false, String(value));
  }
});

test("generateOtpCode returns a six-digit numeric code", () => {
  const codes = new Set();
  for (let i = 0; i < 50; i += 1) {
    const code = generateOtpCode();
    assert.equal(isOtpFormat(code), true, code);
    codes.add(code);
  }
  assert.ok(codes.size > 1, "codes should be random");
});

test("hashOtpCode is a deterministic, domain-separated SHA-256 hex digest", async () => {
  assert.equal(
    await hashOtpCode("123456"),
    "3cd762be4bf899c597965ac2efbcf2e227dc1e7b65f7d5306a0b902339760581"
  );
  assert.notEqual(await hashOtpCode("123456"), await hashOtpCode("654321"));
  assert.match(await hashOtpCode("000000"), /^[0-9a-f]{64}$/);
});

test("expiry is ten minutes and isOtpExpired is inclusive", () => {
  const now = 1_800_000_000_000;
  const expiresAt = otpExpiryDate(now);
  assert.equal(expiresAt.getTime() - now, EMAIL_VERIFICATION_TTL_MS);
  assert.equal(isOtpExpired(expiresAt, now), false);
  assert.equal(isOtpExpired(expiresAt, now + EMAIL_VERIFICATION_TTL_MS), true);
  assert.equal(isOtpExpired(expiresAt, now + EMAIL_VERIFICATION_TTL_MS - 1), false);
  assert.equal(isOtpExpired("not-a-date"), true);
});

test("attempts are capped at five", () => {
  assert.equal(OTP_MAX_ATTEMPTS, 5);
  for (let attempts = 0; attempts < 5; attempts += 1) {
    assert.equal(canSubmitOtpAttempt(attempts), true);
  }
  for (const attempts of [5, 6, -1, Number.NaN]) {
    assert.equal(canSubmitOtpAttempt(attempts), false, String(attempts));
  }
});

test("resend cooldown is 60 seconds and never negative", () => {
  assert.equal(OTP_RESEND_COOLDOWN_MS, 60_000);
  const now = 1_800_000_000_000;
  assert.equal(resendCooldownMs(now, now), 60_000);
  assert.equal(resendCooldownMs(now, now + 10_000), 50_000);
  assert.equal(resendCooldownMs(now, now + 60_000), 0);
  assert.equal(resendCooldownMs(now, now + 120_000), 0);
});

test("grant tokens are signed, scoped to E-JUST emails and short-lived", async () => {
  const previous = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "test-secret";
  try {
    const grant = await createOtpGrant("  Student@EJUST.edu.eg ");
    assert.equal(await verifyOtpGrant(grant), "student@ejust.edu.eg");
    assert.equal(await verifyOtpGrant(`${grant}tampered`), null);
    assert.equal(await verifyOtpGrant(grant.split(".")[0]), null);
    assert.equal(await verifyOtpGrant("a.b.c"), null);

    const [payload, signature] = grant.split(".");
    const expired = Buffer.from(
      JSON.stringify({
        email: "student@ejust.edu.eg",
        exp: Date.now() - 1000,
        purpose: "email-otp",
      })
    ).toString("base64url");
    // Reuse the signature? No: the payload changed, so the grant must be rejected.
    assert.equal(await verifyOtpGrant(`${expired}.${signature}`), null);
    assert.equal(payload.length > 0, true);
  } finally {
    if (previous === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previous;
  }
});
