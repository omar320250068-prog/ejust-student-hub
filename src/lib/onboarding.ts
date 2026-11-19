/**
 * Shared academic-profile state for first-time student onboarding.
 *
 * The wizard, Today, Timetable and Exams all read the same localStorage record;
 * signed-in students additionally mirror it through `/api/user-data`. Keeping
 * the validation and gating logic here makes it testable without React.
 */
import type { Faculty } from "./faculty";

/** The six teachable faculties shown in onboarding (SHARED is a service pool). */
export const ONBOARDING_FACULTIES = [
  "FOE",
  "CSIT",
  "FIBH",
  "FOP",
  "BAS",
  "FAD",
] as const;
export type OnboardingFaculty = (typeof ONBOARDING_FACULTIES)[number];

export const ACADEMIC_YEARS = [1, 2, 3, 4, 5] as const;
export type AcademicYear = (typeof ACADEMIC_YEARS)[number];

/** Department / specialization presets; CSIT uses its four official tracks. */
export const DEPARTMENTS_BY_FACULTY = {
  FOE: ["ECE", "MEC", "MTR", "EEE", "MSE", "ENV", "ERE", "CBE", "CPE", "IPE", "IME", "BME", "ARC"],
  CSIT: ["CNC", "AID", "CSC", "BIF"],
  FIBH: ["ACC", "FIN", "MGT", "MKT", "ECO", "BUS", "HRM"],
  FOP: ["PHM", "PHC", "PCL", "PCE", "PHA", "BIO"],
  BAS: ["NAN", "BTC", "ACM", "EMT", "SPC", "SCI"],
  FAD: ["ART", "DES", "VIS", "GRD", "IND"],
} as const;

export const CSIT_TRACKS = DEPARTMENTS_BY_FACULTY.CSIT;
export type CsitTrack = (typeof CSIT_TRACKS)[number];

export const ONBOARDING_TRACKS = [
  ...DEPARTMENTS_BY_FACULTY.CSIT,
  ...DEPARTMENTS_BY_FACULTY.FOE,
  ...DEPARTMENTS_BY_FACULTY.FIBH,
  ...DEPARTMENTS_BY_FACULTY.FOP,
  ...DEPARTMENTS_BY_FACULTY.BAS,
  ...DEPARTMENTS_BY_FACULTY.FAD,
  "General",
] as const;
export type OnboardingTrack = (typeof ONBOARDING_TRACKS)[number];

/** Translation keys for the faculty names, shared by the wizard and filters. */
export const FACULTY_LABEL_KEY: Record<
  Faculty,
  "onboarding.foe" | "onboarding.csit" | "onboarding.fibh" | "onboarding.fop" | "onboarding.bas" | "onboarding.fad" | "onboarding.shared"
> = {
  FOE: "onboarding.foe",
  CSIT: "onboarding.csit",
  FIBH: "onboarding.fibh",
  FOP: "onboarding.fop",
  BAS: "onboarding.bas",
  FAD: "onboarding.fad",
  SHARED: "onboarding.shared",
};

export const SECTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1));
export const GROUPS = ["1", "2", "3", "4"] as const;

export interface AcademicProfile {
  faculty: OnboardingFaculty;
  year: AcademicYear;
  group: string;
  track: OnboardingTrack;
  section: string;
  updatedAt?: string;
}

export interface OnboardingGate {
  authenticated: boolean;
  profile: AcademicProfile | null;
  syncedCourseCount: number;
  dismissed: boolean;
  /** Fresh-account arrival via `/today?welcome=1` overrides the empty-state gate. */
  welcome?: boolean;
}

export const ACADEMIC_PROFILE_KEY = "ejust:academic-profile";
export const ACADEMIC_PROFILE_EVENT = "ejust:academic-profile-updated";

export function dismissalKey(userId: string): string {
  return `ejust:onboarding-dismissed:${userId}`;
}

function asFaculty(value: unknown): OnboardingFaculty | null {
  const candidate = String(value ?? "").toUpperCase();
  return ONBOARDING_FACULTIES.find((faculty) => faculty === candidate) ?? null;
}

function asTrack(value: unknown): OnboardingTrack | null {
  const candidate = String(value ?? "").toLowerCase();
  return ONBOARDING_TRACKS.find((track) => track.toLowerCase() === candidate) ?? null;
}

function asYear(value: unknown): AcademicYear | null {
  const candidate = Number(value);
  return ACADEMIC_YEARS.find((year) => year === candidate) ?? null;
}

function asNumberString(value: unknown, max: number): string | null {
  const candidate = Number(value);
  return Number.isInteger(candidate) && candidate >= 1 && candidate <= max
    ? String(candidate)
    : null;
}

/** Sanitize untrusted stored/API profile data; return null when it is unusable. */
export function normalizeAcademicProfile(value: unknown): AcademicProfile | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const faculty = asFaculty(raw.faculty);
  const year = asYear(raw.year);
  const section = asNumberString(raw.section, 12);
  if (!faculty || !year || !section) return null;

  const profile: AcademicProfile = {
    faculty,
    year,
    group: asNumberString(raw.group, 4) ?? "1",
    track: asTrack(raw.track) ?? "General",
    section,
  };
  if (typeof raw.updatedAt === "string" && !Number.isNaN(Date.parse(raw.updatedAt))) {
    profile.updatedAt = raw.updatedAt;
  }
  return profile;
}

/** Read the shared profile from localStorage (safe during SSR). */
export function readAcademicProfile(): AcademicProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACADEMIC_PROFILE_KEY);
    return raw ? normalizeAcademicProfile(JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

/** Persist the profile and notify already-mounted hub pages. */
export function saveAcademicProfile(profile: AcademicProfile): AcademicProfile {
  const normalized: AcademicProfile = { ...profile, updatedAt: new Date().toISOString() };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ACADEMIC_PROFILE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent(ACADEMIC_PROFILE_EVENT, { detail: normalized }));
  }
  return normalized;
}

export function isOnboardingDismissed(userId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(dismissalKey(userId)) === "1";
}

export function markOnboardingDismissed(userId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(dismissalKey(userId), "1");
}

/** Wipe a stale dismissal flag when a brand new account is registered. */
export function clearOnboardingDismissed(userId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(dismissalKey(userId));
}

/** First visit: authenticated, no profile, no SIS courses, not dismissed. */
export function shouldShowOnboarding(gate: OnboardingGate): boolean {
  if (!gate.authenticated) return false;
  if (gate.welcome) return true;
  return !gate.dismissed && gate.profile === null && gate.syncedCourseCount === 0;
}

/** The timetable page uses friendlier faculty/group labels than the hub feed. */
export function toTimetableFaculty(
  faculty: OnboardingFaculty
): "CSIT" | "Engineering" | "Business" | "FOP" | "BAS" | "FAD" {
  if (faculty === "FOE") return "Engineering";
  if (faculty === "FIBH") return "Business";
  if (faculty === "CSIT") return "CSIT";
  return faculty;
}

export function toTimetableGroup(group: string): "Group 1" | "Group 2" | "Group 3" | "Group 4" {
  const number = asNumberString(group, 4) ?? "1";
  return `Group ${number}` as "Group 1" | "Group 2" | "Group 3" | "Group 4";
}

/**
 * The legacy timetable grid only has four CSIT columns; other faculties' track
 * selections fall back to its default program.
 */
export function toTimetableTrack(track: OnboardingTrack): CsitTrack {
  return CSIT_TRACKS.find((candidate) => candidate === track) ?? "CSC";
}

/** Hub exam/notice filters use the same short faculty codes as the wizard. */
export function toHubFaculty(faculty: OnboardingFaculty): Faculty {
  return faculty;
}
