/**
 * Pure prerequisite graph evaluation and "what-if" analysis.
 *
 * The functions here never read browser storage and never mutate the GPA
 * record. They take a curriculum plus a set of completed course codes and
 * return status/impact data that the UI can render deterministically.
 */

import {
  DEPARTMENTS,
  SEMESTERS,
  getCurriculum,
  isDepartmentId,
  type CourseNode,
  type DepartmentId,
  type Semester,
} from "../data/prerequisites.ts";
import type { GpaData } from "./gpa.ts";

export type PrerequisiteStatus = "completed" | "unlocked" | "locked";

export interface NodeEvaluation extends CourseNode {
  status: PrerequisiteStatus;
  missingPrerequisites: string[];
}

export interface CourseImpact extends CourseNode {
  directUnlocks: CourseNode[];
  downstreamChain: CourseNode[];
  transitiveBlockedCount: number;
  affectedSemesters: Semester[];
  /** Number of downstream edges in the longest chain starting at this course. */
  criticalDepth: number;
  /** Course codes along that longest downstream chain, including this course. */
  criticalChain: string[];
}

export interface CurriculumSummary {
  completedCount: number;
  unlockedCount: number;
  lockedCount: number;
  completedCredits: number;
  totalCredits: number;
}

export interface PrereqState {
  department: DepartmentId;
  completedCourseCodes: string[];
}

export const DEFAULT_PREREQ_STATE: PrereqState = {
  department: "CSE",
  completedCourseCodes: [],
};

/** Courses with at least this many downstream edges are flagged as critical. */
export const CRITICAL_PATH_MIN_DEPTH = 3;

const FAILED_MARKERS = new Set(["F", "W", "FAIL", "ABSENT", "INCOMPLETE"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeCourseCode(code: string): string {
  return code.trim().replace(/\s+/g, " ").toUpperCase();
}

function completedSet(completedCourseCodes: Iterable<string>): Set<string> {
  return new Set(
    [...completedCourseCodes]
      .map((code) => normalizeCourseCode(code))
      .filter((code) => code.length > 0),
  );
}

function semesterIndex(semester: string): number {
  const value = Number.parseInt(semester.replace(/\D/g, ""), 10);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function sortBySemesterThenCode(courses: CourseNode[]): CourseNode[] {
  return [...courses].sort(
    (a, b) => semesterIndex(a.semester) - semesterIndex(b.semester) || a.code.localeCompare(b.code),
  );
}

/** Validate uniqueness, references, and the "prerequisites precede" DAG rule. */
export function validateCurriculum(courses: CourseNode[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const byCode = new Map<string, CourseNode>();

  for (const node of courses) {
    const code = normalizeCourseCode(node.code);
    if (!code) {
      errors.push("A course has an empty code");
      continue;
    }
    if (byCode.has(code)) errors.push(`Duplicate course code: ${code}`);
    else byCode.set(code, node);
  }

  for (const node of courses) {
    const code = normalizeCourseCode(node.code);
    for (const raw of node.prerequisites) {
      const prerequisite = normalizeCourseCode(raw);
      const target = byCode.get(prerequisite);
      if (!target) {
        errors.push(`${code} references missing prerequisite ${prerequisite}`);
      } else if (prerequisite === code) {
        errors.push(`${code} cannot be its own prerequisite`);
      } else if (semesterIndex(target.semester) >= semesterIndex(node.semester)) {
        errors.push(`${prerequisite} must precede ${code}`);
      }
    }
    for (const raw of node.corequisites ?? []) {
      const corequisite = normalizeCourseCode(raw);
      if (!byCode.has(corequisite)) {
        errors.push(`${code} references missing corequisite ${corequisite}`);
      } else if (corequisite === code) {
        errors.push(`${code} cannot be its own corequisite`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function isDag(courses: CourseNode[]): boolean {
  return validateCurriculum(courses).valid;
}

export function missingPrerequisitesFor(node: CourseNode, completedCourseCodes: Iterable<string>): string[] {
  const done = completedSet(completedCourseCodes);
  return node.prerequisites
    .map(normalizeCourseCode)
    .filter((code) => !done.has(code));
}

export function getNodeStatus(
  node: CourseNode,
  completedCourseCodes: Iterable<string>,
): NodeEvaluation {
  const done = completedSet(completedCourseCodes);
  const missingPrerequisites = missingPrerequisitesFor(node, done);

  let status: PrerequisiteStatus;
  if (done.has(normalizeCourseCode(node.code))) status = "completed";
  else if (missingPrerequisites.length === 0) status = "unlocked";
  else status = "locked";

  return { ...node, status, missingPrerequisites };
}

export function evaluateCurriculum(
  courses: CourseNode[],
  completedCourseCodes: Iterable<string>,
): NodeEvaluation[] {
  const done = completedSet(completedCourseCodes);
  return courses.map((node) => getNodeStatus(node, done));
}

function buildDependents(courses: CourseNode[]): Map<string, CourseNode[]> {
  const dependents = new Map<string, CourseNode[]>();
  for (const node of courses) {
    const code = normalizeCourseCode(node.code);
    for (const raw of node.prerequisites) {
      const prerequisite = normalizeCourseCode(raw);
      const list = dependents.get(prerequisite) ?? [];
      if (!list.some((entry) => normalizeCourseCode(entry.code) === code)) list.push(node);
      dependents.set(prerequisite, list);
    }
  }
  return dependents;
}

function byCodeMap(courses: CourseNode[]): Map<string, CourseNode> {
  return new Map(courses.map((node) => [normalizeCourseCode(node.code), node]));
}

/** Every course reachable downstream of a code, excluding the starting course. */
export function downstreamCourses(courses: CourseNode[], code: string): CourseNode[] {
  const dependents = buildDependents(courses);
  const start = normalizeCourseCode(code);
  const seen = new Set<string>([start]);
  const found: CourseNode[] = [];
  const queue = [...(dependents.get(start) ?? [])];

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) continue;
    const nodeCode = normalizeCourseCode(node.code);
    if (seen.has(nodeCode)) continue;
    seen.add(nodeCode);
    found.push(node);
    queue.push(...(dependents.get(nodeCode) ?? []));
  }

  return sortBySemesterThenCode(found);
}

/** Every prerequisite reachable upstream of a code, excluding the starting course. */
export function upstreamCourses(courses: CourseNode[], code: string): CourseNode[] {
  const byCode = byCodeMap(courses);
  const start = normalizeCourseCode(code);
  const seen = new Set<string>([start]);
  const found: CourseNode[] = [];
  const queue = [...(byCode.get(start)?.prerequisites ?? [])];

  while (queue.length > 0) {
    const rawPrerequisite = queue.shift();
    if (!rawPrerequisite) continue;
    const prerequisite = normalizeCourseCode(rawPrerequisite);
    if (seen.has(prerequisite)) continue;
    seen.add(prerequisite);
    const node = byCode.get(prerequisite);
    if (!node) continue;
    found.push(node);
    queue.push(...node.prerequisites);
  }

  return sortBySemesterThenCode(found);
}

/** Blast radius and longest-chain analysis for one course. */
export function analyzeCourse(courses: CourseNode[], code: string): CourseImpact | null {
  const byCode = byCodeMap(courses);
  const start = normalizeCourseCode(code);
  const node = byCode.get(start);
  if (!node) return null;

  const dependents = buildDependents(courses);
  const depthMemo = new Map<string, { depth: number; chain: string[] }>();
  const visiting = new Set<string>();

  function longestPath(current: string): { depth: number; chain: string[] } {
    const cached = depthMemo.get(current);
    if (cached) return cached;
    if (visiting.has(current)) return { depth: 0, chain: [current] };

    visiting.add(current);
    const children = (dependents.get(current) ?? [])
      .map((child) => normalizeCourseCode(child.code))
      .filter((child) => child !== current);
    let best = { depth: 0, chain: [current] };
    for (const child of children) {
      const path = longestPath(child);
      if (path.depth + 1 > best.depth) {
        best = { depth: path.depth + 1, chain: [current, ...path.chain] };
      }
    }
    visiting.delete(current);
    depthMemo.set(current, best);
    return best;
  }

  const downstreamChain = downstreamCourses(courses, start);
  const directUnlocks = sortBySemesterThenCode(dependents.get(start) ?? []);
  const affected = new Set<Semester>(downstreamChain.map((course) => course.semester));
  const path = longestPath(start);

  return {
    ...node,
    directUnlocks,
    downstreamChain,
    transitiveBlockedCount: downstreamChain.length,
    affectedSemesters: SEMESTERS.filter((semester) => affected.has(semester)),
    criticalDepth: path.depth,
    criticalChain: path.chain,
  };
}

export function isCriticalPath(courses: CourseNode[], code: string): boolean {
  return (analyzeCourse(courses, code)?.criticalDepth ?? 0) >= CRITICAL_PATH_MIN_DEPTH;
}

export function criticalPathCodes(courses: CourseNode[]): string[] {
  const dependents = buildDependents(courses);
  return sortBySemesterThenCode(courses)
    .filter((node) => {
      const code = normalizeCourseCode(node.code);
      return (dependents.get(code)?.length ?? 0) > 0 && isCriticalPath(courses, code);
    })
    .map((node) => normalizeCourseCode(node.code));
}

export function summarizeCurriculum(
  courses: CourseNode[],
  completedCourseCodes: Iterable<string>,
): CurriculumSummary {
  const evaluations = evaluateCurriculum(courses, completedCourseCodes);
  return {
    completedCount: evaluations.filter((node) => node.status === "completed").length,
    unlockedCount: evaluations.filter((node) => node.status === "unlocked").length,
    lockedCount: evaluations.filter((node) => node.status === "locked").length,
    completedCredits: evaluations
      .filter((node) => node.status === "completed")
      .reduce((total, node) => total + node.credits, 0),
    totalCredits: courses.reduce((total, node) => total + node.credits, 0),
  };
}

/**
 * Turn passed GPA courses into prerequisite codes. Failed/withdrawn markers
 * never count as completed, and the GPA record is left untouched.
 */
export function syncPassedCoursesFromGpa(gpa: GpaData | null | undefined): string[] {
  if (!gpa || !Array.isArray(gpa.courses)) return [];
  const codes = new Set<string>();

  for (const course of gpa.courses) {
    if (course.status !== "completed") continue;
    const grade = typeof course.grade === "string" ? course.grade.trim().toUpperCase() : "";
    if (!grade || FAILED_MARKERS.has(grade)) continue;
    const code = normalizeCourseCode(course.code ?? "");
    if (code) codes.add(code);
  }

  return [...codes].sort((a, b) => a.localeCompare(b));
}

export function sanitizePrereqState(
  value: unknown,
  options: { requireValidDepartment?: boolean } = {},
): PrereqState | null {
  if (!isRecord(value)) {
    return options.requireValidDepartment ? null : { ...DEFAULT_PREREQ_STATE };
  }

  const department = isDepartmentId(value.department) ? value.department : null;
  if (options.requireValidDepartment && !department) return null;
  const resolvedDepartment = department ?? DEFAULT_PREREQ_STATE.department;

  const completedCourseCodes = Array.isArray(value.completedCourseCodes)
    ? [
        ...new Set(
          value.completedCourseCodes
            .filter((code): code is string => typeof code === "string")
            .map(normalizeCourseCode)
            .filter((code) => code.length > 0),
        ),
      ]
    : [];

  return { department: resolvedDepartment, completedCourseCodes };
}

export function getSanitizedCurriculum(state: PrereqState) {
  return getCurriculum(state.department).courses;
}

export function allCurriculaAreValid(): boolean {
  return DEPARTMENTS.every((program) => isDag(program.courses));
}
