/**
 * Pure final-exam target math for the 9-grade E-JUST marking scale.
 *
 * Coursework and the final exam contribute raw marks to one total (100 by
 * default). A target grade is the minimum mark on that 100-mark scale, so the
 * marks still needed in the final exam are:
 *
 *   targetMark * (courseworkMax + finalMax) / 100 - currentScore
 */

/** Minimum overall mark required for each grade, high to low. */
export const FINAL_GRADE_BOUNDARIES = {
  "A+": 97,
  A: 93,
  "B+": 89,
  B: 84,
  "C+": 79,
  C: 74,
  "D+": 69,
  D: 60,
  F: 0,
} as const;

export type FinalTargetGrade = keyof typeof FINAL_GRADE_BOUNDARIES;

export const FINAL_TARGET_GRADES = Object.keys(
  FINAL_GRADE_BOUNDARIES,
) as FinalTargetGrade[];

export const DEFAULT_COURSEWORK_MAX = 60;
export const DEFAULT_FINAL_MAX = 40;

export interface FinalTargetInput {
  /** Marks already earned on the coursework/midterm component. */
  currentScore: number;
  courseworkMax: number;
  finalMax: number;
  targetGrade: FinalTargetGrade;
}

export interface FinalTargetResult {
  /** Minimum overall mark (out of 100) that earns the target grade. */
  targetMark: number;
  totalMax: number;
  /** Raw marks needed in the final exam, clamped at zero. */
  requiredRaw: number;
  /** Percentage of the final exam that the raw mark represents. */
  requiredPercent: number;
  /** False when the required mark exceeds the final exam maximum. */
  achievable: boolean;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function positiveOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function computeFinalTarget(input: FinalTargetInput): FinalTargetResult {
  const targetMark = FINAL_GRADE_BOUNDARIES[input.targetGrade] ?? 0;
  const courseworkMax = positiveOr(input.courseworkMax, DEFAULT_COURSEWORK_MAX);
  const finalMax = positiveOr(input.finalMax, DEFAULT_FINAL_MAX);
  const currentScore = Number.isFinite(input.currentScore)
    ? Math.max(0, input.currentScore)
    : 0;
  const totalMax = courseworkMax + finalMax;

  // Multiply before dividing to avoid 0.79 * 100 style floating-point drift.
  const rawNeeded = (targetMark * totalMax) / 100 - currentScore;
  const requiredRaw = Math.max(0, rawNeeded);

  return {
    targetMark,
    totalMax,
    requiredRaw: round2(requiredRaw),
    requiredPercent: round2((requiredRaw / finalMax) * 100),
    achievable: round2(rawNeeded) <= finalMax,
  };
}

/** Map an overall mark (out of 100) back onto the displayed grade scale. */
export function gradeForMark(mark: number): FinalTargetGrade {
  if (!Number.isFinite(mark)) return "F";
  for (const grade of FINAL_TARGET_GRADES) {
    if (mark >= FINAL_GRADE_BOUNDARIES[grade]) return grade;
  }
  return "F";
}
