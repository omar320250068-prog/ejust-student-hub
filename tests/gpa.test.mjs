import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_GPA_DATA,
  computeNeededGpa,
  computeStats,
  sanitizeGpaData,
  semesterSeries,
} from "../src/lib/gpa.ts";

const seededCourses = Array.from({ length: 16 }, (_, index) => ({
  id: `s${index + 1}`,
  code: `DEMO${index + 1}`,
  title: `Sample course ${index + 1}`,
  credits: 2,
  semester: index < 4 ? "Y1S1" : index < 8 ? "Y1S2" : index < 12 ? "Y2S1" : "Y2S2",
  status: "completed",
  grade: "A",
}));

test("a new GPA tracker has no pre-populated courses", () => {
  assert.deepEqual(EMPTY_GPA_DATA.courses, []);
  assert.equal(EMPTY_GPA_DATA.courses.length, 0);
  assert.equal(EMPTY_GPA_DATA.targetGpa, 3.5);
  assert.equal(EMPTY_GPA_DATA.degreeCredits, 160);

  const sanitized = sanitizeGpaData({
    courses: seededCourses,
    targetGpa: 3.5,
    degreeCredits: 160,
  });
  assert.deepEqual(sanitized.courses, []);
  assert.equal(sanitized.courses.some((course) => /^s\d+$/.test(course.id)), false);
});

test("needed GPA is calculated across remaining degree credits", () => {
  const needed = computeNeededGpa(2.99, 28, 160, 3.5);

  assert.equal(needed.remainingCredits, 132);
  assert.ok(Math.abs(needed.neededGpa - 3.608181818181818) < 0.000001);
  assert.equal(needed.achievable, true);
});

test("computeStats uses degree credits rather than only scheduled courses", () => {
  const stats = computeStats(
    [{ id: "c1", code: "C1", title: "Course", credits: 28, semester: "Y1S1", status: "completed", grade: "B" }],
    3.5,
    160,
  );

  assert.equal(stats.completedCredits, 28);
  assert.equal(stats.remainingCredits, 132);
  assert.ok(Math.abs(stats.requiredAverage - 3.606060606060606) < 0.000001);
  assert.equal(stats.achievable, true);
});

test("target is unachievable only when needed GPA exceeds the scale", () => {
  assert.equal(computeNeededGpa(2.0, 120, 160, 3.9).achievable, false);
  assert.equal(computeNeededGpa(3.8, 160, 160, 3.5).achievable, true);
  assert.equal(computeNeededGpa(3.0, 160, 160, 3.5).achievable, false);
});

test("semester series marks semesters without grades as unplotted", () => {
  const series = semesterSeries([
    { id: "c1", code: "C1", title: "Course 1", credits: 3, semester: "Y1S1", status: "completed", grade: "A+" },
    { id: "c2", code: "C2", title: "Course 2", credits: 3, semester: "Y1S2", status: "in-progress" },
  ]);

  assert.deepEqual(series.map((point) => point.semesterGpa), [4, null]);
  assert.deepEqual(series.map((point) => point.cumulativeGpa), [4, null]);
});
