export type ScanVerdict = {
  status: "clean" | "review";
  scoreText: string;
  details: string;
};

const MERIT_BY_CATEGORY: Record<string, number> = {
  "lecture-notes": 5,
  "past-papers": 10,
  courseware: 8,
  "campus-update": 3,
};

export function meritForCategory(category: string): number {
  return MERIT_BY_CATEGORY[category] ?? 5;
}

export function scanContribution(input: {
  category: string;
  title: string;
  data: unknown;
  notes?: string | null;
}): ScanVerdict {
  const reasons: string[] = [];
  let score = 10;

  if (input.title.trim().length >= 8) {
    score += 25;
  } else {
    reasons.push("short title");
  }

  const data =
    input.data && typeof input.data === "object"
      ? (input.data as Record<string, unknown>)
      : {};

  const filled = Object.values(data).filter(
    (value) => value !== null && value !== undefined && String(value).trim() !== "",
  );

  if (filled.length >= 3) {
    score += 35;
  } else if (filled.length > 0) {
    score += 20;
    reasons.push("partial metadata");
  } else {
    reasons.push("no metadata");
  }

  const fileKeys = ["fileName", "size", "type"];
  const fileFields = fileKeys.filter(
    (key) => data[key] !== null && data[key] !== undefined && String(data[key]).trim() !== "",
  ).length;

  if (fileFields === fileKeys.length) {
    score += 20;
  } else if (fileFields > 0) {
    score += 10;
    reasons.push("incomplete file info");
  } else {
    reasons.push("no file attached");
  }

  if (input.notes?.trim()) {
    score += 10;
  }

  const percent = Math.max(0, Math.min(100, score));

  return {
    status: percent >= 80 ? "clean" : "review",
    scoreText: `${percent}% complete`,
    details: reasons.length
      ? `Needs: ${reasons.join(", ")}`
      : "All expected fields present",
  };
}
