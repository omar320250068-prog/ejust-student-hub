import type {
  ParsedSisCourse,
  SisSummaryMetadata,
  SisTableType,
} from "./sis-parser";

/** Standard E-JUST 4.0 grade points. */
export const GPA_POINTS: Record<string, number> = {
  "A+": 4.0,
  A: 4.0,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  "C-": 1.7,
  "D+": 1.3,
  D: 1.0,
  F: 0.0,
};

export const GRADUATION_CREDITS = 134;

export interface SyncedCourse extends ParsedSisCourse {
  id?: string;
  updatedAt?: string;
}

export interface SyncSummary {
  /** Weighted CGPA on the 4.0 scale, rounded to two decimals. */
  cgpa: number;
  /** Earned credits (graded courses other than F). */
  completedCredits: number;
  remainingCredits: number;
  progressPercent: number;
  courseCount: number;
}

export interface SyncResponse {
  courses: SyncedCourse[];
  summary: SyncSummary;
  /** Flat aliases used by the lightweight extension popup. */
  cgpa: number;
  completedCredits: number;
  /** Shown in the guide so the extension can authenticate. */
  syncToken?: string;
  syncedAt?: string;
  /** Official SIS header values when the pasted text contained them. */
  metadata?: SisSummaryMetadata | null;
  tableType?: SisTableType;
}

export interface SyncPreviewResponse {
  courses: ParsedSisCourse[];
  metadata?: SisSummaryMetadata | null;
  tableType?: SisTableType;
}
