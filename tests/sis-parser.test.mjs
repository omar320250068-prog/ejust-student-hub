import assert from "node:assert/strict";
import test from "node:test";

import {
  detectSisTableType,
  parseSisDocument,
} from "../src/lib/sis-parser.ts";

const registeredSample = [
  "Registered Courses",
  "2026/2027 - Fall",
  "Total Passed CH : 15.00",
  "CGPA : 1.84",
  "Registered CH : 9.00",
  [
    "Select", "Course Code", "Course Title", "CH", "Repeat", "Status",
    "Fee Amount", "Payment", "Teaching Method", "Delete Section", "Section",
  ].join(" | "),
  "PHY113 | Physics 1 | 3.00 | 0 | A | Yes | LEC",
  "PHY113 | Physics 1 | 3.00 | 0 | A | Yes | TUT",
  "PHY113 | Physics 1 | 3.00 | 0 | A | Yes | LAB S1 2-3",
].join("\n");

test("registered table: Status A is approval, not a letter grade", () => {
  assert.equal(detectSisTableType(registeredSample), "registered");

  const result = parseSisDocument(registeredSample);
  assert.equal(result.courses.length, 1);
  const course = result.courses[0];
  assert.equal(course.courseCode.replace(/\s/g, ""), "PHY113");
  assert.equal(course.creditHours, 3);
  assert.equal(course.grade, null);
  assert.equal(course.status, "registered");
  assert.deepEqual(course.sections, ["LEC", "TUT", "LAB S1 2-3"]);
});

test("registered rows are recognised even without headers", () => {
  const result = parseSisDocument(
    "PHY113 | Physics 1 | 3.00 | 0 | A | Yes | LEC\n" +
    "PHY113 | Physics 1 | 3.00 | 0 | A | Yes | TUT"
  );
  assert.equal(result.courses.length, 1);
  assert.equal(result.courses[0].grade, null);
  assert.equal(result.courses[0].status, "registered");
  assert.equal(result.courses[0].creditHours, 3);
});

test("transcript table still parses letter grades", () => {
  const raw = [
    "Academic Transcript",
    "Course Code | Course Title | CH | Grade",
    "PHY113 | Physics 1 | 3.00 | A",
    "CSE112 | Programming 2 | 3.00 | B+",
  ].join("\n");

  const result = parseSisDocument(raw);
  assert.equal(result.tableType, "transcript");
  assert.deepEqual(
    result.courses.map((c) => [c.courseCode.replace(/\s/g, ""), c.grade, c.status]),
    [
      ["CSE112", "B+", "completed"],
      ["PHY113", "A", "completed"],
    ]
  );
});

test("header summary metadata and semester are extracted", () => {
  const { metadata } = parseSisDocument(registeredSample);
  assert.equal(metadata.cgpa, 1.84);
  assert.equal(metadata.passedCredits, 15);
  assert.equal(metadata.registeredCredits, 9);
  assert.equal(metadata.semester, "Fall 2026/2027");
});
