import test from "node:test";
import assert from "node:assert/strict";
import {
  importedExamKey,
  normalizeImportedRows,
  parseExamText,
} from "../src/lib/exam-import.ts";

test("parseExamText parses a CODE + Date + Time + Room line", () => {
  const rows = parseExamText("CSC341 - Midterm - 13 Dec 2026, 10:00-12:00, Building B, Room B4");
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    courseCode: "CSC341",
    examType: "MIDTERM",
    examDate: "2026-12-13",
    startTime: "10:00",
    endTime: "12:00",
    building: "B",
    room: "B4",
  });
});

test("parseExamText parses ISO dates and pipe-delimited tables", () => {
  const text = [
    "Course | Type | Date | Time | Building | Room",
    "ECE201 | Quiz | 2026-12-15 | 14:00-15:00 | A | A3",
    "MGT310 | Final | 2026-12-22 | 09:00 - 11:00 | C | C2",
  ].join("\n");
  const rows = parseExamText(text);
  assert.deepEqual(
    rows.map((row) => [row.courseCode, row.examType, row.examDate, row.startTime, row.endTime, row.building, row.room]),
    [
      ["ECE201", "QUIZ", "2026-12-15", "14:00", "15:00", "A", "A3"],
      ["MGT310", "FINAL", "2026-12-22", "09:00", "11:00", "C", "C2"],
    ]
  );
});

test("parseExamText handles spaced codes, numeric dates and a single start time", () => {
  const rows = parseExamText("MTH 101 final 20/12/2026 09:00 Room L1");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].courseCode, "MTH101");
  assert.equal(rows[0].examType, "FINAL");
  assert.equal(rows[0].examDate, "2026-12-20");
  assert.equal(rows[0].startTime, "09:00");
  assert.equal(rows[0].endTime, "10:00");
  assert.equal(rows[0].room, "L1");
});

test("parseExamText defaults the exam type to MIDTERM when no keyword is present", () => {
  const [row] = parseExamText("CSC341 2026-12-13 10:00-12:00 B B4");
  assert.equal(row.examType, "MIDTERM");
});

test("parseExamText ignores headers, prose and lines without a full schedule", () => {
  const text = [
    "Exam schedule for Fall 2026",
    "Course | Date | Room",
    "CSC341 2026-12-13",
    "Please bring your student ID.",
    "FIN220 2026-12-18 13:00-15:00 B2 B5",
  ].join("\n");
  const rows = parseExamText(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].courseCode, "FIN220");
});

test("parseExamText returns an empty array for empty or null input", () => {
  assert.deepEqual(parseExamText(""), []);
  assert.deepEqual(parseExamText("   "), []);
});

test("normalizeImportedRows sanitizes AI output and rejects unusable rows", () => {
  const rows = normalizeImportedRows([
    {
      courseCode: " csc-341 ",
      examType: "mid-term",
      examDate: "2026-12-13",
      startTime: "9:05",
      endTime: "11:30",
      building: "Building B",
      room: "Room B4",
    },
    { courseCode: "???", examDate: "not-a-date" },
    null,
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    courseCode: "CSC341",
    examType: "MIDTERM",
    examDate: "2026-12-13",
    startTime: "09:05",
    endTime: "11:30",
    building: "Building B",
    room: "Room B4",
  });
});

test("normalizeImportedRows strips control characters and caps field length", () => {
  const [row] = normalizeImportedRows([
    {
      courseCode: "ECE201",
      examType: "FINAL",
      examDate: "2026-12-15",
      startTime: "10:00",
      endTime: "12:00",
      building: "A\u0000<script>",
      room: "x".repeat(200),
    },
  ]);
  assert.equal(row.building, "Ascript");
  assert.equal(row.room.length, 80);
});

test("importedExamKey matches the database idempotency identity", () => {
  const row = {
    courseCode: "CSC341",
    examType: "MIDTERM",
    examDate: "2026-12-13",
    startTime: "10:00",
    endTime: "12:00",
    building: "B",
    room: "B4",
  };
  assert.equal(importedExamKey(row), "CSC341|MIDTERM|2026-12-13|10:00|12:00");
  assert.equal(importedExamKey({ ...row, building: "Z" }), importedExamKey(row));
});
