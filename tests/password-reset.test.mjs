import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_ERROR_CODES,
  AUTH_ERROR_TRANSLATION_KEY,
  authErrorMessage,
  isAuthErrorCode,
} from "../src/lib/auth-messages.ts";
import {
  constantTimeEqual,
  generateOtpCode,
  hashOtpCode,
  isOtpFormat,
  validateEjustEmail,
} from "../src/lib/email-otp.ts";
import { MAX_PASSWORD_BYTES, validatePassword } from "../src/lib/password-policy.ts";

test("reset requests accept any E-JUST address, including subdomains", () => {
  assert.equal(validateEjustEmail("student@ejust.edu.eg"), "ok");
  assert.equal(validateEjustEmail("  Student.CS@CSIT.EJUST.EDU.EG "), "ok");
  assert.equal(validateEjustEmail("student@gmail.com"), "not-ejust");
  assert.equal(validateEjustEmail("not-an-email"), "invalid");
  assert.equal(validateEjustEmail(undefined), "invalid");
});

test("new passwords follow the same rules as registration", () => {
  assert.equal(validatePassword("longenough1"), "ok");
  assert.equal(validatePassword("short"), "too_short");
  assert.equal(validatePassword(undefined), "too_short");
  assert.equal(validatePassword("a".repeat(MAX_PASSWORD_BYTES)), "ok");
  assert.equal(validatePassword("a".repeat(MAX_PASSWORD_BYTES + 1)), "too_long");
});

test("reset OTPs are 6 digits and stored only as hashes", async () => {
  const code = generateOtpCode();
  assert.equal(isOtpFormat(code), true);
  assert.equal(isOtpFormat("12345"), false);
  assert.equal(isOtpFormat("1234567"), false);
  assert.equal(isOtpFormat(123456), false);

  const hash = await hashOtpCode(code);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.notEqual(hash, code);
  assert.equal(await hashOtpCode(code), hash);
  assert.equal(constantTimeEqual(hash, await hashOtpCode(code)), true);
  assert.equal(constantTimeEqual(hash, await hashOtpCode("000000")), false);
});

test("rate-limit errors are localized and mappable in the UI", () => {
  assert.equal(AUTH_ERROR_CODES.includes("rate_limited"), true);
  assert.equal(isAuthErrorCode("rate_limited"), true);
  assert.equal(AUTH_ERROR_TRANSLATION_KEY.rate_limited, "auth.rateLimited");

  const english = authErrorMessage("rate_limited", "en");
  const arabic = authErrorMessage("rate_limited", "ar");
  const japanese = authErrorMessage("rate_limited", "ja");
  assert.match(english, /too many requests/i);
  assert.notEqual(arabic, english);
  assert.notEqual(japanese, english);
  assert.equal(authErrorMessage("rate_limited", "xx"), english);
});
