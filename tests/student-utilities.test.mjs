import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_COURSEWORK_MAX,
  DEFAULT_FINAL_MAX,
  FINAL_TARGET_GRADES,
  computeFinalTarget,
  gradeForMark,
} from "../src/lib/final-grade-calc.ts";
import {
  parseSisPaste,
} from "../src/lib/sis-paste-parser.ts";
import { mergeSisPaste } from "../src/lib/sis-paste-import.ts";
import {
  DEFAULT_MAX_ALLOWED,
  attendanceRisk,
  normalizeAttendanceCode,
  sanitizeAttendance,
  shiftAbsences,
  updateAttendance,
} from "../src/lib/attendance.ts";
import {
  attendanceStorageKey,
  readAttendance,
  writeAttendance,
} from "../src/lib/student-data.ts";
import {
  applyBackup,
  collectBackup,
  validateBackup,
} from "../src/lib/data-backup.ts";
import { isPublicAsset } from "../src/lib/auth-gate.ts";

function memoryStore(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    keys: () => [...map.keys()],
  };
}

// ---------------------------------------------------------------------------
// Final exam target calculator
// ---------------------------------------------------------------------------

test("final calculator exposes the exact nine-grade scale and defaults", () => {
  assert.deepEqual(FINAL_TARGET_GRADES, ["A+", "A", "B+", "B", "C+", "C", "D+", "D", "F"]);
  assert.equal(DEFAULT_COURSEWORK_MAX, 60);
  assert.equal(DEFAULT_FINAL_MAX, 40);
});

test("final calculator solves every boundary on the default 60/40 split", () => {
  const cases = [
    ["A+", 57, 40],
    ["A", 53, 40],
    ["B+", 49, 40],
    ["B", 44, 40],
    ["C+", 39, 40],
    ["C", 34, 40],
    ["D+", 29, 40],
    ["D", 20, 40],
  ];
  for (const [targetGrade, currentScore, expectedRaw] of cases) {
    const result = computeFinalTarget({
      currentScore,
      courseworkMax: 60,
      finalMax: 40,
      targetGrade,
    });
    assert.equal(result.requiredRaw, expectedRaw, `${targetGrade} raw mark`);
    assert.equal(result.requiredPercent, 100, `${targetGrade} percent`);
    assert.equal(result.achievable, true, `${targetGrade} achievable`);
  }
});

test("final calculator reports an unachievable target and a safe one", () => {
  const hard = computeFinalTarget({
    currentScore: 43,
    courseworkMax: 60,
    finalMax: 40,
    targetGrade: "B",
  });
  assert.equal(hard.targetMark, 84);
  assert.equal(hard.requiredRaw, 41);
  assert.equal(hard.requiredPercent, 102.5);
  assert.equal(hard.achievable, false);

  const safe = computeFinalTarget({
    currentScore: 43,
    courseworkMax: 60,
    finalMax: 40,
    targetGrade: "C+",
  });
  assert.equal(safe.requiredRaw, 36);
  assert.equal(safe.requiredPercent, 90);
  assert.equal(safe.achievable, true);
});

test("final calculator supports editable 50/50 and 40/60 splits", () => {
  const half = computeFinalTarget({
    currentScore: 25,
    courseworkMax: 50,
    finalMax: 50,
    targetGrade: "B",
  });
  assert.equal(half.totalMax, 100);
  assert.equal(half.requiredRaw, 59);
  assert.equal(half.requiredPercent, 118);
  assert.equal(half.achievable, false);

  const weighted = computeFinalTarget({
    currentScore: 20,
    courseworkMax: 40,
    finalMax: 60,
    targetGrade: "C",
  });
  assert.equal(weighted.requiredRaw, 54);
  assert.equal(weighted.requiredPercent, 90);
  assert.equal(weighted.achievable, true);
});

test("final calculator clamps an already-secured target and invalid inputs", () => {
  const secured = computeFinalTarget({
    currentScore: 60,
    courseworkMax: 60,
    finalMax: 40,
    targetGrade: "D",
  });
  assert.equal(secured.requiredRaw, 0);
  assert.equal(secured.requiredPercent, 0);
  assert.equal(secured.achievable, true);

  const invalid = computeFinalTarget({
    currentScore: -5,
    courseworkMax: 0,
    finalMax: -1,
    targetGrade: "A+",
  });
  assert.equal(invalid.totalMax, 100);
  assert.equal(invalid.requiredRaw, 97);
  assert.equal(invalid.achievable, false);
});

test("gradeForMark maps boundaries inclusively", () => {
  for (const [mark, grade] of [
    [100, "A+"],
    [97, "A+"],
    [96, "A"],
    [93, "A"],
    [89, "B+"],
    [84, "B"],
    [79, "C+"],
    [74, "C"],
    [69, "D+"],
    [60, "D"],
    [59, "F"],
    [0, "F"],
  ]) {
    assert.equal(gradeForMark(mark), grade, `mark ${mark}`);
  }
});

// ---------------------------------------------------------------------------
// SIS paste parser
// ---------------------------------------------------------------------------

const SIS_SAMPLE = [
  "Registered Courses - Fall 2026",
  "Course Code   Course Title              CH   Grade",
  "CSCI 311      Database Systems          3    A+",
  "MATH 204      Differential Equations     3    B",
  "PHYS 101      Physics                    2    IP",
  "ENG 110       Technical Writing          3    -",
  "",
  "Schedule",
  "Mon 08:00-09:30 CSCI 311 Room A5",
  "Wed 10:00 - 11:30 MATH 204 Hall B2",
  "Thu 13:00-14:00 PHYS 101 Room Lab-3",
  "",
  "Final Exams",
  "CSCI 311 Final Exam 2026-07-12 09:00 Room C1",
  "MATH 204 Midterm 15/07/2026 11:00 Room D4",
].join("\r\n");

test("SIS paste parser extracts courses, grades and credits from messy text", () => {
  const result = parseSisPaste(SIS_SAMPLE);
  assert.deepEqual(
    result.courses.map((course) => [course.courseCode, course.creditHours, course.grade]),
    [
      ["CSCI311", 3, "A+"],
      ["MATH204", 3, "B"],
      ["PHYS101", 2, "in-progress"],
      ["ENG110", 3, null],
    ],
  );
  assert.equal(result.courses[0].courseName, "Database Systems");
});

test("SIS paste parser extracts weekly slots and rooms", () => {
  const result = parseSisPaste(SIS_SAMPLE);
  assert.deepEqual(
    result.classes.map((slot) => [slot.courseCode, slot.day, slot.start, slot.end, slot.room]),
    [
      ["CSCI311", "Mon", "08:00", "09:30", "A5"],
      ["MATH204", "Wed", "10:00", "11:30", "B2"],
      ["PHYS101", "Thu", "13:00", "14:00", "Lab-3"],
    ],
  );
});

test("SIS paste parser extracts exams with normalized dates", () => {
  const result = parseSisPaste(SIS_SAMPLE);
  assert.deepEqual(
    result.exams.map((exam) => [exam.courseCode, exam.type, exam.date, exam.time, exam.room]),
    [
      ["CSCI311", "Final", "2026-07-12", "09:00", "C1"],
      ["MATH204", "Midterm", "2026-07-15", "11:00", "D4"],
    ],
  );
});

test("SIS paste parser normalizes 12-hour times and duplicate rows", () => {
  const result = parseSisPaste([
    "Sun 8:00 AM - 9:30 AM CSCI 311 Room A1",
    "Mon 2:00 PM - 3:30 PM MATH 204 Room B2",
    "CSCI 311 Database Systems 3 A+",
    "CSCI311 Database Systems 3 A+",
  ].join("\n"));
  assert.deepEqual(
    result.classes.map((slot) => [slot.day, slot.start, slot.end]),
    [
      ["Sun", "08:00", "09:30"],
      ["Mon", "14:00", "15:30"],
    ],
  );
  assert.equal(result.courses.length, 1);
  assert.equal(result.courses[0].grade, "A+");
});

test("SIS paste parser skips ambiguous rows and never invents data", () => {
  const empty = parseSisPaste("You have 3 courses. A good day! Nothing to copy here.");
  assert.deepEqual(empty, { courses: [], classes: [], exams: [] });

  const ambiguous = parseSisPaste("CSCI 311 A B 3");
  assert.equal(ambiguous.courses.length, 1);
  assert.equal(ambiguous.courses[0].grade, null);
  assert.equal(ambiguous.courses[0].creditHours, 3);
});

// ---------------------------------------------------------------------------
// SIS paste merge
// ---------------------------------------------------------------------------

test("SIS paste merge adds new records without dropping existing ones", () => {
  const parsed = parseSisPaste(SIS_SAMPLE);
  const merged = mergeSisPaste(
    {
      courses: [
        {
          courseCode: "CSCI311",
          courseName: "Old title",
          creditHours: null,
          grade: null,
          semester: null,
          status: "registered",
        },
      ],
      classes: [],
      exams: [],
    },
    parsed,
  );

  assert.equal(merged.courses.length, 4);
  assert.equal(merged.courses[0].courseName, "Database Systems");
  assert.equal(merged.courses[0].grade, "A+");
  assert.equal(merged.classes.length, 3);
  assert.equal(merged.exams.length, 2);
  assert.equal(merged.classes[0].courseCode, "CSCI311");
  assert.equal(merged.exams[0].date, "2026-07-12T09:00");

  const again = mergeSisPaste(merged, parsed);
  assert.equal(again.courses.length, 4);
  assert.equal(again.classes.length, 3);
  assert.equal(again.exams.length, 2);
});

// ---------------------------------------------------------------------------
// Attendance helpers
// ---------------------------------------------------------------------------

test("attendance codes normalize and malformed records are discarded", () => {
  assert.equal(normalizeAttendanceCode(" csci-311 "), "CSCI311");
  const clean = sanitizeAttendance({
    "csci 311": { absences: 2, maxAllowed: 4 },
    MATH204: { absences: -1, maxAllowed: 4 },
    PHYS101: { absences: 3, maxAllowed: 0 },
    BROKEN: "nope",
  });
  assert.deepEqual(clean, { CSCI311: { absences: 2, maxAllowed: 4 } });
});

test("attendance risk follows 50% and 75% thresholds", () => {
  assert.equal(DEFAULT_MAX_ALLOWED, 4);
  assert.equal(attendanceRisk({ absences: 1, maxAllowed: 4 }), "safe");
  assert.equal(attendanceRisk({ absences: 2, maxAllowed: 4 }), "warning");
  assert.equal(attendanceRisk({ absences: 3, maxAllowed: 4 }), "danger");
  assert.equal(attendanceRisk({ absences: 4, maxAllowed: 4 }), "danger");
  assert.equal(attendanceRisk({ absences: 5, maxAllowed: 4 }), "danger");
  assert.equal(attendanceRisk(undefined), "safe");
});

test("attendance updates clamp at zero and keep editable limits", () => {
  let map = {};
  map = updateAttendance(map, "CSCI311", { maxAllowed: 5 });
  assert.deepEqual(map.CSCI311, { absences: 0, maxAllowed: 5 });
  map = shiftAbsences(map, "CSCI311", 1);
  map = shiftAbsences(map, "CSCI311", 1);
  assert.equal(map.CSCI311.absences, 2);
  map = shiftAbsences(map, "CSCI311", -5);
  assert.equal(map.CSCI311.absences, 0);
  map = updateAttendance(map, "CSCI311", { absences: 99 });
  assert.equal(map.CSCI311.absences, 99);
});

test("attendance storage is scoped, guest-keyed and round-trips", () => {
  assert.equal(attendanceStorageKey(), "ejust:attendance");
  assert.equal(
    attendanceStorageKey({ id: "student-1" }),
    "ejust:attendance:u:student-1",
  );

  const store = memoryStore();
  writeAttendance(store, { id: "student-1" }, { CSCI311: { absences: 2, maxAllowed: 4 } });
  assert.deepEqual(readAttendance(store, { id: "student-1" }), {
    CSCI311: { absences: 2, maxAllowed: 4 },
  });
  assert.deepEqual(readAttendance(store, { id: "student-2" }), {});
  assert.deepEqual(readAttendance(store), {});
});

// ---------------------------------------------------------------------------
// Backup parity + service worker route
// ---------------------------------------------------------------------------

test("attendance is included in JSON backup export and restore", () => {
  const store = memoryStore({
    "ejust:attendance": JSON.stringify({ CSCI311: { absences: 1, maxAllowed: 4 } }),
    "ejust:attendance:u:student-1": JSON.stringify({
      MATH204: { absences: 3, maxAllowed: 5 },
    }),
  });

  const backup = collectBackup(store);
  assert.deepEqual(backup.data["ejust:attendance"], {
    CSCI311: { absences: 1, maxAllowed: 4 },
  });
  assert.deepEqual(backup.data["ejust:attendance:u:student-1"], {
    MATH204: { absences: 3, maxAllowed: 5 },
  });

  const validated = validateBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(validated.ok, true);
  const restored = memoryStore();
  assert.equal(applyBackup(restored, validated.backup), 2);
  assert.deepEqual(readAttendance(restored), {
    CSCI311: { absences: 1, maxAllowed: 4 },
  });
});

test("malformed attendance backup data is rejected", () => {
  const backup = {
    format: "ejust-student-hub-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { "ejust:attendance": { CSCI311: { absences: -1, maxAllowed: 4 } } },
  };
  assert.deepEqual(validateBackup(backup), { ok: false, error: "invalid_data" });
});

test("service worker script is a public asset but API routes are not", () => {
  assert.equal(isPublicAsset("/sw.js"), true);
  assert.equal(isPublicAsset("/api/student/sync"), false);
});
