export type ExamType = "Quiz" | "Midterm" | "Final" | "Project";

export interface Exam {
  id: string;
  courseCode: string;
  title: string;
  type: ExamType;
  date: string; // ISO string from datetime-local
  weight: number; // % of course grade
  difficulty: number; // 1–4
  notes?: string;
}

export const EXAM_TYPES: ExamType[] = ["Quiz", "Midterm", "Final", "Project"];

const MS_PER_DAY = 86_400_000;

export function daysLeft(iso: string, now = new Date()): number {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / MS_PER_DAY);
}

export function formatExamDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface StudyAllocation {
  exam: Exam;
  days: number;
  perDayMin: number;
  totalHours: number;
  share: number;
}

/**
 * Distributes a fixed daily study budget across upcoming exams.
 * Priority = difficulty × weight / days remaining (sooner + heavier exams get more time).
 */
export function allocateStudy(exams: Exam[], dailyHours: number, now = new Date()): StudyAllocation[] {
  const upcoming = exams
    .map((exam) => ({ exam, days: daysLeft(exam.date, now) }))
    .filter((x) => x.days >= 0)
    .sort((a, b) => a.days - b.days);

  const priorities = upcoming.map(
    ({ exam, days }) => (exam.difficulty * Math.max(1, exam.weight)) / Math.max(1, days)
  );
  const totalPriority = priorities.reduce((a, b) => a + b, 0) || 1;

  return upcoming.map(({ exam, days }, i) => {
    const share = priorities[i] / totalPriority;
    const perDayMin = Math.round(dailyHours * 60 * share);
    return {
      exam,
      days,
      perDayMin,
      totalHours: Math.round((perDayMin / 60) * days * 10) / 10,
      share,
    };
  });
}
