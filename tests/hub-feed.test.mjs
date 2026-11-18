import test from "node:test";
import assert from "node:assert/strict";
import {
  examRowToUi,
  filterActiveNotices,
  isNoticeActive,
  normalizeCode,
  noticeMatchesAudience,
  parseCodeList,
} from "../src/lib/hub-feed.ts";

const examRow = {
  id: "exam-1",
  courseCode: "CSC 341",
  courseName: "Database Systems",
  courseNameAr: "قواعد البيانات",
  examType: "MIDTERM",
  examDate: "2026-12-13",
  startTime: "10:00",
  endTime: "12:00",
  building: "B",
  room: "B4",
  notes: "Bring a student ID",
};

const noticeRow = {
  id: "notice-1",
  title: "CSC 341 midterm room change",
  body: "The exam moved to Building B, Room B4.",
  category: "EXAM",
  courseCode: "CSC341",
  courseName: "Database Systems",
  targetFaculty: "CSIT",
  expiresAt: "2026-12-20T00:00:00.000Z",
  createdAt: "2026-11-18T08:00:00.000Z",
};

test("normalizeCode strips spaces and punctuation and uppercases", () => {
  assert.equal(normalizeCode(" csc-341 "), "CSC341");
  assert.equal(normalizeCode("م ق"), "");
  assert.equal(normalizeCode(null), "");
});

test("parseCodeList accepts comma and space separated codes", () => {
  assert.deepEqual(parseCodeList("CSC341, Math 201|PHY-101"), [
    "CSC341",
    "MATH201",
    "PHY101",
  ]);
  assert.deepEqual(parseCodeList(undefined), []);
});

test("examRowToUi maps hub rows into planner exams with a real date and location", () => {
  const exam = examRowToUi(examRow);
  assert.equal(exam.id, "hub:exam-1");
  assert.equal(exam.courseCode, "CSC341");
  assert.equal(exam.type, "Midterm");
  assert.equal(exam.weight, 30);
  assert.equal(exam.difficulty, 3);
  assert.equal(exam.location, "B · B4");
  assert.equal(exam.courseName, "Database Systems");
  assert.equal(exam.courseNameAr, "قواعد البيانات");
  assert.equal(exam.notes, "Bring a student ID");
  assert.equal(
    exam.date,
    new Date("2026-12-13T10:00:00").toISOString()
  );
});

test("examRowToUi uses planner-safe defaults for missing time and location", () => {
  const exam = examRowToUi({ ...examRow, examType: "QUIZ", startTime: "", building: null, room: null });
  assert.equal(exam.type, "Quiz");
  assert.equal(exam.weight, 15);
  assert.equal(exam.difficulty, 2);
  assert.equal(exam.location, "TBA");
  assert.equal(exam.date, new Date("2026-12-13T09:00:00").toISOString());
});

test("isNoticeActive respects expiration", () => {
  const now = Date.parse("2026-11-18T12:00:00.000Z");
  assert.equal(isNoticeActive(noticeRow, now), true);
  assert.equal(isNoticeActive({ ...noticeRow, expiresAt: null }, now), true);
  assert.equal(
    isNoticeActive({ ...noticeRow, expiresAt: "2026-11-01T00:00:00.000Z" }, now),
    false
  );
});

test("noticeMatchesAudience requires faculty and synced-course matches", () => {
  assert.equal(noticeMatchesAudience(noticeRow, "CSIT", ["CSC341"]), true);
  assert.equal(noticeMatchesAudience(noticeRow, "CSIT", ["MATH201"]), false);
  assert.equal(noticeMatchesAudience(noticeRow, "Engineering", ["CSC341"]), false);
  assert.equal(
    noticeMatchesAudience({ ...noticeRow, courseCode: "", targetFaculty: "" }, "Engineering", []),
    true
  );
  // Removing the course scope must not bypass the faculty filter.
  assert.equal(
    noticeMatchesAudience({ ...noticeRow, courseCode: "" }, "Engineering", []),
    false
  );
});

test("filterActiveNotices drops expired and irrelevant notices and sorts newest first", () => {
  const older = {
    ...noticeRow,
    id: "notice-2",
    title: "Faculty-wide exam guidance",
    courseCode: "",
    targetFaculty: "",
    category: "ACADEMIC",
    createdAt: "2026-11-17T08:00:00.000Z",
  };
  const expired = {
    ...noticeRow,
    id: "notice-3",
    title: "Old notice",
    expiresAt: "2026-11-01T00:00:00.000Z",
  };
  const unrelated = { ...noticeRow, id: "notice-4", courseCode: "MATH201" };

  const notices = filterActiveNotices([expired, older, unrelated, noticeRow], {
    nowMs: Date.parse("2026-11-18T12:00:00.000Z"),
    faculty: "CSIT",
    codes: ["CSC341"],
  });

  assert.deepEqual(
    notices.map((notice) => notice.id),
    ["notice-1", "notice-2"]
  );
  assert.equal(notices[0].category, "EXAM");
});
