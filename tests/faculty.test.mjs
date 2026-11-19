import test from "node:test";
import assert from "node:assert/strict";
import {
  FACULTIES,
  FACULTY_PREFIXES,
  facultyLabel,
  inferFacultyFromCourseCode,
  isFaculty,
  isKnownCoursePrefix,
  tagExamsWithFaculty,
  tagNoticesWithFaculty,
} from "../src/lib/faculty.ts";

test("inferFacultyFromCourseCode maps CSIT prefixes", () => {
  for (const code of ["CSC341", "AID401", "CNC311", "BIF301"]) {
    assert.equal(inferFacultyFromCourseCode(code), "CSIT", code);
  }
});

test("inferFacultyFromCourseCode maps every FOE engineering prefix", () => {
  for (const code of FACULTY_PREFIXES.FOE.map((prefix) => `${prefix}201`)) {
    assert.equal(inferFacultyFromCourseCode(code), "FOE", code);
  }
});

test("inferFacultyFromCourseCode maps FIBH business prefixes", () => {
  for (const code of ["ACC101", "FIN220", "MGT310", "MKT240", "ECO110", "BUS150", "HRM330"]) {
    assert.equal(inferFacultyFromCourseCode(code), "FIBH", code);
  }
});

test("inferFacultyFromCourseCode maps the new FOP, BAS and FAD faculties", () => {
  for (const code of ["PHM101", "PHC201", "PCL301", "PCE401", "PHA501", "BIO110"]) {
    assert.equal(inferFacultyFromCourseCode(code), "FOP", code);
  }
  for (const code of ["NAN101", "BTC201", "ACM301", "EMT401", "SPC501", "SCI601"]) {
    assert.equal(inferFacultyFromCourseCode(code), "BAS", code);
  }
  for (const code of ["ART101", "DES201", "VIS301", "GRD401", "IND501"]) {
    assert.equal(inferFacultyFromCourseCode(code), "FAD", code);
  }
});

test("inferFacultyFromCourseCode maps every SHARED prefix including JPN", () => {
  for (const code of FACULTY_PREFIXES.SHARED.map((prefix) => `${prefix}101`)) {
    assert.equal(inferFacultyFromCourseCode(code), "SHARED", code);
  }
});

test("inferFacultyFromCourseCode normalizes case, spaces and punctuation", () => {
  assert.equal(inferFacultyFromCourseCode(" csc-341 "), "CSIT");
  assert.equal(inferFacultyFromCourseCode("Ece 201"), "FOE");
  assert.equal(inferFacultyFromCourseCode("mth 101"), "SHARED");
  assert.equal(inferFacultyFromCourseCode("FIN.220"), "FIBH");
  assert.equal(inferFacultyFromCourseCode("bio-101"), "FOP");
});

test("inferFacultyFromCourseCode falls back to SHARED for unknown or empty codes", () => {
  for (const code of ["", "   ", "341", "XYZ999", null, undefined]) {
    assert.equal(inferFacultyFromCourseCode(code), "SHARED", String(code));
  }
});

test("FACULTIES exposes all seven supported faculties in display order", () => {
  assert.deepEqual(FACULTIES, ["FOE", "CSIT", "FIBH", "FOP", "BAS", "FAD", "SHARED"]);
});

test("isFaculty and isKnownCoursePrefix recognize the expanded taxonomy", () => {
  for (const faculty of FACULTIES) {
    assert.equal(isFaculty(faculty.toLowerCase()), true, faculty);
    assert.equal(isFaculty(`${faculty}1`), false, faculty);
  }
  assert.equal(isFaculty("MED"), false);
  assert.equal(isKnownCoursePrefix("BIO101"), true);
  assert.equal(isKnownCoursePrefix("XYZ101"), false);
  assert.equal(isKnownCoursePrefix("BIO"), true);
  assert.equal(isKnownCoursePrefix("BI"), false);
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
    { id: "3", courseCode: "BIO201" },
    { id: "4", courseCode: "unknown" },
  ];
  assert.deepEqual(
    tagExamsWithFaculty(exams, (exam) => exam.courseCode).map((exam) => exam.faculty),
    ["CSIT", "FOE", "FOP", "SHARED"]
  );
});

test("tagNoticesWithFaculty prefers an explicit target faculty and infers the rest", () => {
  const notices = [
    { id: "1", targetFaculty: "FIBH", courseCode: "CSC341" },
    { id: "2", targetFaculty: "", courseCode: "ECE220" },
    { id: "3", targetFaculty: "FAD", courseCode: "ART101" },
  ];
  const tagged = tagNoticesWithFaculty(notices);
  assert.equal(tagged[0].faculty, "FIBH");
  assert.equal(tagged[1].faculty, "FOE");
  assert.equal(tagged[2].faculty, "FAD");
});
