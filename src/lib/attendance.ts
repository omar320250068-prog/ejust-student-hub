/**
 * Pure attendance/DN tracking helpers.
 *
 * Absences are stored per course code so official timetable rows (whose ids
 * change between syncs) and hand-added classes share one stable record.
 */

export const DEFAULT_MAX_ALLOWED = 4;

export interface AttendanceRecord {
  absences: number;
  maxAllowed: number;
}

export type AttendanceMap = Record<string, AttendanceRecord>;
export type AttendanceRisk = "safe" | "warning" | "danger";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeAttendanceCode(code: string): string {
  return code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

function cleanRecord(value: unknown): AttendanceRecord | null {
  if (!isRecord(value)) return null;
  const { absences, maxAllowed } = value;
  if (
    typeof absences !== "number" ||
    !Number.isFinite(absences) ||
    !Number.isInteger(absences) ||
    absences < 0 ||
    typeof maxAllowed !== "number" ||
    !Number.isFinite(maxAllowed) ||
    !Number.isInteger(maxAllowed) ||
    maxAllowed < 1
  ) {
    return null;
  }
  return { absences, maxAllowed };
}

/** Drop malformed entries so corrupt local storage cannot poison the tracker. */
export function sanitizeAttendance(value: unknown): AttendanceMap {
  if (!isRecord(value)) return {};
  const clean: AttendanceMap = {};
  for (const [code, entry] of Object.entries(value)) {
    const normalized = normalizeAttendanceCode(code);
    const record = cleanRecord(entry);
    if (!normalized || !record) continue;
    clean[normalized] = record;
  }
  return clean;
}

/** Amber from half the limit, red from three quarters or the limit itself. */
export function attendanceRisk(record: AttendanceRecord | undefined): AttendanceRisk {
  if (!record) return "safe";
  const { absences, maxAllowed } = record;
  if (absences >= maxAllowed || absences / maxAllowed >= 0.75) return "danger";
  if (absences / maxAllowed >= 0.5) return "warning";
  return "safe";
}

export function updateAttendance(
  map: AttendanceMap,
  code: string,
  patch: Partial<AttendanceRecord>,
): AttendanceMap {
  const normalized = normalizeAttendanceCode(code);
  if (!normalized) return map;
  const current = sanitizeAttendance(map)[normalized] ?? {
    absences: 0,
    maxAllowed: DEFAULT_MAX_ALLOWED,
  };
  const next = cleanRecord({ ...current, ...patch });
  if (!next) return map;
  return { ...sanitizeAttendance(map), [normalized]: next };
}

export function shiftAbsences(
  map: AttendanceMap,
  code: string,
  delta: number,
): AttendanceMap {
  const normalized = normalizeAttendanceCode(code);
  const current = sanitizeAttendance(map)[normalized] ?? {
    absences: 0,
    maxAllowed: DEFAULT_MAX_ALLOWED,
  };
  return updateAttendance(map, normalized, {
    absences: Math.max(0, current.absences + (Number.isFinite(delta) ? Math.trunc(delta) : 0)),
  });
}
