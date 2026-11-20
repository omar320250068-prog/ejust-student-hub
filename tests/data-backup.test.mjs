import test from "node:test";
import assert from "node:assert/strict";
import {
  applyBackup,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFilename,
  collectBackup,
  validateBackup,
} from "../src/lib/data-backup.ts";

function storage(initial = new Map()) {
  return {
    map: initial,
    getItem(key) {
      return initial.has(key) ? initial.get(key) : null;
    },
    setItem(key, value) {
      initial.set(key, value);
    },
  };
}

const fixtures = {
  "ejust:gpa": {
    courses: [{ id: "c1", code: "CSC 111", title: "Intro", credits: 3, status: "COMPLETED", grade: "A" }],
    targetGpa: 3.5,
    degreeCredits: 134,
  },
  student_custom_timetable: {
    version: 1,
    schedules: {
      default: [
        {
          id: "b1",
          courseCode: "CSC 111",
          title: "Intro",
          day: "SATURDAY",
          start: "09:00",
          end: "10:00",
          location: "B17 · G0.22",
          color: "cyan",
        },
      ],
    },
  },
  "ejust-exam-seat-v1": { hall: "B17", seat: "12" },
  "ejust-scholarships-saved-v1": ["sch-1"],
  "ejust-locale": "ar",
};

test("collectBackup exports only valid known keys", () => {
  const source = storage();
  for (const [key, value] of Object.entries(fixtures)) source.setItem(key, JSON.stringify(value));
  source.setItem("unknown.key", JSON.stringify({ secret: true }));
  source.setItem("ejust-locale", "broken-json");

  const backup = collectBackup(source, new Date("2026-11-20T10:00:00.000Z"));
  assert.equal(backup.format, BACKUP_FORMAT);
  assert.equal(backup.version, BACKUP_VERSION);
  assert.equal(backup.exportedAt, "2026-11-20T10:00:00.000Z");
  assert.deepEqual(Object.keys(backup.data).sort(), [
    "ejust-exam-seat-v1",
    "ejust:gpa",
    "ejust-scholarships-saved-v1",
    "student_custom_timetable",
  ].sort());
  assert.deepEqual(backup.data["ejust-exam-seat-v1"], { hall: "B17", seat: "12" });
});

test("validateBackup rejects bad format, version, data and size", () => {
  const good = collectBackup(storage());
  assert.equal(validateBackup(good).ok, true);

  assert.equal(validateBackup({ ...good, format: "other" }).ok, false);
  assert.equal(validateBackup({ ...good, format: "other" }).error, "invalid_format");
  assert.equal(validateBackup({ ...good, version: 99 }).error, "unsupported_version");
  assert.equal(validateBackup({ ...good, exportedAt: "not-a-date" }).error, "invalid_data");
  assert.equal(
    validateBackup({ ...good, data: { "unknown.key": { x: 1 } } }).error,
    "invalid_data"
  );
  assert.equal(
    validateBackup({ ...good, data: { "ejust-locale": "xx" } }).error,
    "invalid_data"
  );
  assert.equal(
    validateBackup({ ...good, data: { padding: "x".repeat(5_000_001) } }).error,
    "too_large"
  );
});

test("applyBackup restores only validated data", () => {
  const source = storage();
  for (const [key, value] of Object.entries(fixtures)) source.setItem(key, JSON.stringify(value));
  const backup = collectBackup(source);
  const validated = validateBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(validated.ok, true);
  if (!validated.ok) return;

  const target = storage();
  const restored = applyBackup(target, validated.backup);
  assert.equal(restored, 5);
  assert.equal(target.getItem("ejust-locale"), '"ar"');
  assert.deepEqual(JSON.parse(target.getItem("student_custom_timetable")), fixtures.student_custom_timetable);
  assert.equal(target.getItem("unknown.key"), null);
});

test("backupFilename is deterministic and json", () => {
  assert.equal(backupFilename(new Date("2026-11-20T10:00:00.000Z")), "ejust-hub-backup-2026-11-20.json");
});
