import test from "node:test";
import assert from "node:assert/strict";

import { DEPARTMENTS, SEMESTERS, getCurriculum } from "../src/data/prerequisites.ts";
import {
  analyzeCourse,
  criticalPathCodes,
  DEFAULT_PREREQ_STATE,
  evaluateCurriculum,
  getNodeStatus,
  isCriticalPath,
  isDag,
  sanitizePrereqState,
  syncPassedCoursesFromGpa,
  upstreamCourses,
  validateCurriculum,
} from "../src/lib/prerequisite-tree.ts";
import {
  applyBackup,
  collectBackup,
  validateBackup,
} from "../src/lib/data-backup.ts";
import {
  prereqStorageKey,
  readPrereqState,
  writePrereqState,
} from "../src/lib/student-data.ts";

function memoryStore(initial = new Map()) {
  return {
    getItem: (key) => (initial.has(key) ? initial.get(key) : null),
    setItem: (key, value) => initial.set(key, String(value)),
    removeItem: (key) => initial.delete(key),
    keys: () => [...initial.keys()],
  };
}

test("every department curriculum is a cycle-free, complete eight-semester DAG", () => {
  assert.deepEqual(DEPARTMENTS.map((program) => program.id), ["CSE", "ECE", "MTR", "IEM", "BME"]);

  for (const program of DEPARTMENTS) {
    const result = validateCurriculum(program.courses);
    assert.deepEqual(result.errors, [], `${program.id} curriculum errors`);
    assert.equal(result.valid, true, `${program.id} must be a DAG`);
    assert.equal(isDag(program.courses), true);

    const semesters = new Set(program.courses.map((course) => course.semester));
    assert.deepEqual(SEMESTERS.filter((semester) => semesters.has(semester)), SEMESTERS);
    assert.ok(program.courses.every((course) => course.credits > 0 && course.title.length > 0));
    assert.ok(program.advisory.en.length > 0);
    assert.ok(program.advisory.ar.length > 0);
    assert.ok(program.advisory.ja.length > 0);
  }
});

test("completing prerequisites unlocks downstream courses with exact missing lists", () => {
  const courses = getCurriculum("CSE").courses;
  const algorithms = courses.find((course) => course.code === "CSE211");
  assert.ok(algorithms);

  const locked = getNodeStatus(algorithms, []);
  assert.equal(locked.status, "locked");
  assert.deepEqual(locked.missingPrerequisites, ["CSE102", "MATH102"]);

  const unlocked = getNodeStatus(algorithms, ["CSE102", "MATH102"]);
  assert.equal(unlocked.status, "unlocked");
  assert.deepEqual(unlocked.missingPrerequisites, []);

  const statuses = evaluateCurriculum(courses, ["CSE101", "MATH101"]);
  const dataStructures = statuses.find((node) => node.code === "CSE102");
  const database = statuses.find((node) => node.code === "CSE221");
  assert.equal(dataStructures?.status, "unlocked");
  assert.equal(database?.status, "locked");
  assert.deepEqual(database?.missingPrerequisites, ["CSE211", "CSE215"]);
});

test("failing a bottleneck reports its direct and transitive blast radius", () => {
  const courses = getCurriculum("CSE").courses;
  const impact = analyzeCourse(courses, "CSE211");
  assert.ok(impact);

  assert.deepEqual(impact.directUnlocks.map((course) => course.code), [
    "CSE221", "CSE223", "CSE225", "CSE341",
  ]);
  assert.equal(impact.transitiveBlockedCount, 24);
  assert.ok(impact.transitiveBlockedCount > impact.directUnlocks.length);
  assert.deepEqual(impact.affectedSemesters, [
    "Sem 4", "Sem 5", "Sem 6", "Sem 7", "Sem 8",
  ]);
  assert.equal(impact.criticalDepth, 4);
  assert.deepEqual(impact.criticalChain, [
    "CSE211", "CSE221", "CSE331", "CSE517", "CSE611",
  ]);
  assert.ok(impact.downstreamChain.some((course) => course.code === "CSE611"));

  assert.equal(isCriticalPath(courses, "CSE211"), true);
  assert.equal(isCriticalPath(courses, "CSE611"), false);
  assert.ok(criticalPathCodes(courses).includes("CSE211"));

  const upstream = upstreamCourses(courses, "CSE211").map((course) => course.code);
  assert.ok(upstream.includes("CSE101"));
  assert.ok(upstream.includes("CSE102"));
  assert.ok(upstream.includes("MATH102"));
});

test("GPA sync maps only passed courses and never mutates GPA data", () => {
  const gpa = {
    targetGpa: 3.5,
    degreeCredits: 160,
    courses: [
      { id: "c1", code: " cse101 ", title: "Intro", credits: 3, semester: "Sem 1", status: "completed", grade: "A" },
      { id: "c2", code: "MATH101", title: "Calculus", credits: 3, semester: "Sem 1", status: "completed", grade: "F" },
      { id: "c3", code: "CSE102", title: "DS", credits: 3, semester: "Sem 2", status: "completed", grade: "W" },
      { id: "c4", code: "PHYS101", title: "Physics", credits: 3, semester: "Sem 1", status: "in-progress", expectedGrade: "A" },
      { id: "c5", code: "chem101", title: "Chemistry", credits: 2, semester: "Sem 1", status: "completed", grade: "B+" },
      { id: "c6", code: "CSE101", title: "Duplicate", credits: 3, semester: "Sem 1", status: "completed", grade: "A" },
    ],
  };
  const before = JSON.stringify(gpa);

  assert.deepEqual(syncPassedCoursesFromGpa(gpa), ["CHEM101", "CSE101"]);
  assert.equal(JSON.stringify(gpa), before);
  assert.deepEqual(syncPassedCoursesFromGpa(null), []);
});

test("prerequisite state validation rejects hostile departments and duplicate codes", () => {
  assert.deepEqual(sanitizePrereqState(undefined), DEFAULT_PREREQ_STATE);
  assert.deepEqual(sanitizePrereqState({ department: "ECE", completedCourseCodes: ["ece101", "ECE101"] }), {
    department: "ECE",
    completedCourseCodes: ["ECE101"],
  });
  assert.equal(sanitizePrereqState({ department: "XYZ" }, { requireValidDepartment: true }), null);
  assert.equal(sanitizePrereqState({ department: "CSE", completedCourseCodes: [42] }, { requireValidDepartment: true }) !== null, true);
});

test("prerequisite state uses per-user keys and survives JSON backup and restore", () => {
  const store = memoryStore();
  const state = { department: "MTR", completedCourseCodes: ["MTR101"] };

  writePrereqState(store, { id: "user-1" }, state);
  assert.equal(prereqStorageKey({ id: "user-1" }), "ejust:prereqs:u:user-1");
  assert.equal(store.getItem("ejust:prereqs:u:user-1") !== null, true);
  assert.deepEqual(readPrereqState(store, { id: "user-1" }), state);
  assert.deepEqual(readPrereqState(store, { id: "user-2" }), DEFAULT_PREREQ_STATE);

  writePrereqState(store, null, state);
  assert.equal(prereqStorageKey(null), "ejust:prereqs");

  const backup = collectBackup(store);
  assert.deepEqual(backup.data["ejust:prereqs"], state);
  assert.deepEqual(backup.data["ejust:prereqs:u:user-1"], state);

  const validated = validateBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(validated.ok, true);
  if (!validated.ok) return;

  const target = memoryStore();
  assert.equal(applyBackup(target, validated.backup), 2);
  assert.deepEqual(readPrereqState(target, { id: "user-1" }), state);
});
