import test from "node:test";
import assert from "node:assert/strict";
import {
  FACULTIES,
  facultyLabel,
  inferFacultyFromCourseCode,
  tagExamsWithFaculty,
  tagNoticesWithFaculty,
} from "../src/lib/faculty.ts";

test("inferFacultyFromCourseCode maps CSIT prefixes", () => {
  for (const code of ["CSC341", "AID401", "CNC311", "BIF301"]) {
    assert.equal(inferFacultyFromCourseCode(code), "CSIT", code);
  }
});

test("inferFacultyFromCourseCode maps FOE engineering prefixes", () => {
  for (const code of ["ECE201", "MEC110", "EEE220", "MSE330", "ENV410", "CBE305", "IPE210", "ARC120"]) {
    assert.equal(inferFacultyFromCourseCode(code), "FOE", code);
  }
});

test("inferFacultyFromCourseCode maps FIBH business prefixes", () => {
  for (const code of ["ACC101", "FIN220", "MGT310", "MKT240", "ECO110", "BUS150", "HRM330"]) {
    assert.equal(inferFacultyFromCourseCode(code), "FIBH", code);
  }
});

test("inferFacultyFromCourseCode maps SHARED prefixes", () => {
  for (const code of ["MTH101", "PHY102", "CHM103", "LRA104", "HUM105", "ENG106"]) {
    assert.equal(inferFacultyFromCourseCode(code), "SHARED", code);
  }
});

test("inferFacultyFromCourseCode normalizes case, spaces and punctuation", () => {
  assert.equal(inferFacultyFromCourseCode(" csc-341 "), "CSIT");
  assert.equal(inferFacultyFromCourseCode("Ece 201"), "FOE");
  assert.equal(inferFacultyFromCourseCode("mth 101"), "SHARED");
  assert.equal(inferFacultyFromCourseCode("FIN.220"), "FIBH");
});

test("inferFacultyFromCourseCode falls back to SHARED for unknown or empty codes", () => {
  for (const code of ["", "   ", "341", "XYZ999", null, undefined]) {
    assert.equal(inferFacultyFromCourseCode(code), "SHARED", String(code));
  }
});

test("FACULTIES exposes the four supported faculties in display order", () => {
  assert.deepEqual(FACULTIES, ["CSIT", "FOE", "FIBH", "SHARED"]);
});

test("facultyLabel returns a stable display label for every faculty", () => {
  for (const faculty of FACULTIES) {
    assert.equal(facultyLabel(faculty), faculty);
  }
});

test("tagExamsWithFaculty tags each exam from its course code", () => {
  const exams = [
    { id: "1", courseCode: "CSC341" },
    { id: "2", courseCode: "MEC201" },
    { id: "3", courseCode: "unknown" },
  ];
  assert.deepEqual(
    tagExamsWithFaculty(exams, (exam) => exam.courseCode).map((exam) => exam.faculty),
    ["CSIT", "FOE", "SHARED"]
  );
});

test("tagNoticesWithFaculty prefers an explicit target faculty and infers the rest", () => {
  const notices = [
    { id: "1", targetFaculty: "FIBH", courseCode: "CSC341" },
    { id: "2", targetFaculty: "", courseCode: "ECE220" },
  ];
  const tagged = tagNoticesWithFaculty(notices);
  assert.equal(tagged[0].faculty, "FIBH");
  assert.equal(tagged[1].faculty, "FOE");
});
