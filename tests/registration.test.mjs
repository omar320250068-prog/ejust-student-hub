import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAccountType,
  registrationRoleFields,
} from "../src/lib/account-type.ts";

test("parseAccountType accepts an explicit STUDENT or TA selection", () => {
  assert.equal(parseAccountType("STUDENT"), "STUDENT");
  assert.equal(parseAccountType("TA"), "TA");
});

test("parseAccountType defaults a missing selection to STUDENT", () => {
  assert.equal(parseAccountType(undefined), "STUDENT");
  assert.equal(parseAccountType(null), "STUDENT");
});

test("parseAccountType rejects unknown or lowercase selections", () => {
  for (const value of ["", "student", "ta", "ADMIN", 42, {}, []]) {
    assert.equal(parseAccountType(value), null, JSON.stringify(value));
  }
});

test("a STUDENT selection uses standard onboarding with no TA application", () => {
  assert.deepEqual(registrationRoleFields("STUDENT"), {
    role: "STUDENT",
    taStatus: "NONE",
  });
});

test("a TA selection enters the admin approval queue", () => {
  const before = Date.now();
  const fields = registrationRoleFields("TA");
  const after = Date.now();

  assert.equal(fields.role, "TA");
  assert.equal(fields.taStatus, "PENDING");
  assert.ok(fields.taAppliedAt instanceof Date, "taAppliedAt must be a Date");
  assert.ok(fields.taAppliedAt.getTime() >= before && fields.taAppliedAt.getTime() <= after);
});
