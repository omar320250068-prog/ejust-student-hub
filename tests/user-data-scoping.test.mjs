import test from "node:test";
import assert from "node:assert/strict";
import { applyBackup, collectBackup, validateBackup } from "../src/lib/data-backup.ts";
import {
  baseStorageKey,
  isScopedStorageKey,
  scopedStorageKey,
} from "../src/lib/user-scoped-storage.ts";

function storage(initial = new Map()) {
  return {
    map: initial,
    getItem(key) {
      return initial.has(key) ? initial.get(key) : null;
    },
    setItem(key, value) {
      initial.set(key, value);
    },
    keys() {
      return [...initial.keys()];
    },
  };
}

test("course storage keys are scoped to the signed-in student", () => {
  const first = scopedStorageKey("gpa", { id: "user-1" });
  const second = scopedStorageKey("gpa", { id: "user-2" });

  assert.equal(first, "ejust:gpa:u:user-1");
  assert.notEqual(first, second);
  assert.equal(
    scopedStorageKey("gpa", { email: "student@example.com" }),
    "ejust:gpa:u:student%40example.com",
  );
  assert.equal(scopedStorageKey("gpa", null), "ejust:gpa");
  assert.equal(isScopedStorageKey(first), true);
  assert.equal(isScopedStorageKey("ejust:gpa"), false);
  assert.equal(baseStorageKey(first), "ejust:gpa");
});

test("backup exports and restores scoped student data", () => {
  const key = scopedStorageKey("gpa", { id: "user-1" });
  const value = { courses: [], targetGpa: 3.5, degreeCredits: 160 };
  const source = storage(new Map([[key, JSON.stringify(value)]]));

  const backup = collectBackup(source);
  assert.deepEqual(backup.data[key], value);

  const validated = validateBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(validated.ok, true);
  if (!validated.ok) return;

  const target = storage();
  assert.equal(applyBackup(target, validated.backup), 1);
  assert.deepEqual(JSON.parse(target.getItem(key)), value);
});
