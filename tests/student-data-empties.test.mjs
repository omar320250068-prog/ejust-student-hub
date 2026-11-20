import test from "node:test";
import assert from "node:assert/strict";
import {
  applyBackup,
  collectBackup,
  validateBackup,
} from "../src/lib/data-backup.ts";
import {
  DEFAULT_DAILY_HOURS,
  EMPTY_EXAMS_SNAPSHOT,
  EMPTY_TIMETABLE_SNAPSHOT,
  examSeatStorageKey,
  examsStorageKey,
  facultyStorageKey,
  legacyStudentStorageKeys,
  purgeLegacyStudentKeys,
  readExamSeat,
  readExamsSnapshot,
  readFaculty,
  readTodaySnapshot,
  readTimetableSnapshot,
  selectNextClass,
  selectTodaysClasses,
  timetableStorageKey,
  writeExamSeat,
  writeExamsSnapshot,
  writeFaculty,
  writeTimetableSnapshot,
} from "../src/lib/student-data.ts";

function storage(initial = new Map()) {
  return {
    map: initial,
    getItem(key) {
      return initial.has(key) ? initial.get(key) : null;
    },
    setItem(key, value) {
      initial.set(key, value);
    },
    removeItem(key) {
      initial.delete(key);
    },
    keys() {
      return [...initial.keys()];
    },
  };
}

const BLOCK = {
  id: "custom-1",
  courseCode: "CSC 111",
  title: "Intro",
  day: "Sat",
  start: "09:00",
  end: "10:00",
  location: "B17",
  color: "#2563eb",
  source: "custom",
};

const EXAM = {
  id: "x-1",
  courseCode: "CSC 111",
  title: "Quiz 1",
  type: "Quiz",
  date: "2027-01-10T10:00",
  weight: 15,
  difficulty: 2,
};

test("new signed-in students start with empty timetable, exams, seat and today data", () => {
  const legacy = new Map([
    ["student_custom_timetable", JSON.stringify({ version: 1, schedules: { default: [BLOCK] } })],
    ["ejust-timetable-v1", JSON.stringify([BLOCK])],
    ["ejust-exams-v1", JSON.stringify({ exams: [EXAM], dailyHours: 4 })],
    ["ejust-exam-seat-v1", JSON.stringify({ hall: "B17", seat: "12" })],
    ["ejust:gpa", JSON.stringify({ courses: [{ id: "s1" }], targetGpa: 3.5, degreeCredits: 160 })],
  ]);
  const store = storage(legacy);
  const user = { id: "user-1" };

  purgeLegacyStudentKeys(store, user);

  for (const key of legacyStudentStorageKeys()) {
    assert.equal(store.getItem(key), null, `${key} must be purged for signed-in students`);
  }
  assert.deepEqual(readTimetableSnapshot(store, user), EMPTY_TIMETABLE_SNAPSHOT);
  assert.deepEqual(readExamsSnapshot(store, user), EMPTY_EXAMS_SNAPSHOT);
  assert.equal(readExamSeat(store, user), null);
  assert.equal(readFaculty(store, user), null);

  const snapshot = readTodaySnapshot(store, user);
  assert.deepEqual(snapshot.timetable, []);
  assert.equal(snapshot.gpa, null);
  assert.equal(snapshot.exams, null);
  assert.deepEqual(snapshot.saved, []);
  assert.deepEqual(selectTodaysClasses(snapshot.timetable, new Date("2026-11-21T09:00:00")), []);
  assert.equal(selectNextClass([], new Date("2026-11-21T09:00:00")), null);
  assert.equal(DEFAULT_DAILY_HOURS, 3);
});

test("timetable data is isolated when switching student accounts", () => {
  const store = storage();
  const first = { id: "student-a" };
  const second = { email: "student.b@example.com" };

  writeTimetableSnapshot(store, first, {
    version: 1,
    schedules: { default: [BLOCK] },
  });
  writeTimetableSnapshot(store, second, {
    version: 1,
    schedules: { default: [{ ...BLOCK, id: "custom-2", courseCode: "MATH 201" }] },
  });

  assert.notEqual(timetableStorageKey(first), timetableStorageKey(second));
  assert.equal(readTimetableSnapshot(store, first).schedules.default[0].courseCode, "CSC 111");
  assert.equal(readTimetableSnapshot(store, second).schedules.default[0].courseCode, "MATH 201");
  assert.deepEqual(readTimetableSnapshot(store, { id: "student-c" }), EMPTY_TIMETABLE_SNAPSHOT);
});

test("exam data and exam seat are isolated when switching student accounts", () => {
  const store = storage();
  const first = { id: "student-a" };
  const second = { id: "student-b" };

  writeExamsSnapshot(store, first, { exams: [EXAM], dailyHours: 4 });
  writeExamSeat(store, first, { hall: "B17", seat: "12" });
  writeExamsSnapshot(store, second, { exams: [], dailyHours: 2 });
  writeFaculty(store, first, "CSIT");
  writeFaculty(store, second, "FOE");

  assert.notEqual(examsStorageKey(first), examsStorageKey(second));
  assert.notEqual(examSeatStorageKey(first), examSeatStorageKey(second));
  assert.notEqual(facultyStorageKey(first), facultyStorageKey(second));
  assert.equal(readExamsSnapshot(store, first).exams.length, 1);
  assert.equal(readExamsSnapshot(store, first).dailyHours, 4);
  assert.deepEqual(readExamsSnapshot(store, second), { exams: [], dailyHours: 2 });
  assert.deepEqual(readExamSeat(store, first), { hall: "B17", seat: "12" });
  assert.equal(readExamSeat(store, second), null);
  assert.equal(readFaculty(store, first), "CSIT");
  assert.equal(readFaculty(store, second), "FOE");
  assert.deepEqual(readExamsSnapshot(store, { id: "student-c" }), EMPTY_EXAMS_SNAPSHOT);
});

test("guests keep legacy unscoped student keys", () => {
  const store = storage();
  writeTimetableSnapshot(store, null, { version: 1, schedules: { default: [BLOCK] } });
  writeExamsSnapshot(store, null, { exams: [EXAM], dailyHours: 3 });

  assert.ok(store.getItem("student_custom_timetable"));
  assert.ok(store.getItem("ejust-exams-v1"));
  assert.equal(readTimetableSnapshot(store, null).schedules.default.length, 1);
  assert.equal(readExamsSnapshot(store, null).exams.length, 1);
});

test("JSON backup includes and restores every scoped student state", () => {
  const store = storage();
  const user = { id: "student-a" };
  writeTimetableSnapshot(store, user, { version: 1, schedules: { default: [BLOCK] } });
  writeExamsSnapshot(store, user, { exams: [EXAM], dailyHours: 4 });
  writeExamSeat(store, user, { hall: "B17", seat: "12" });
  writeFaculty(store, user, "CSIT");

  const backup = collectBackup(store);
  for (const key of [
    timetableStorageKey(user),
    examsStorageKey(user),
    examSeatStorageKey(user),
    facultyStorageKey(user),
  ]) {
    assert.ok(key in backup.data, `${key} must be exported`);
  }

  const validated = validateBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(validated.ok, true);
  if (!validated.ok) return;

  const target = storage();
  assert.equal(applyBackup(target, validated.backup), 4);
  assert.deepEqual(readTimetableSnapshot(target, user).schedules.default, [BLOCK]);
  assert.deepEqual(readExamsSnapshot(target, user), { exams: [EXAM], dailyHours: 4 });
  assert.deepEqual(readExamSeat(target, user), { hall: "B17", seat: "12" });
  assert.equal(readFaculty(target, user), "CSIT");
});
