"use client";

import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/today": "Today Dashboard",
  "/": "Campus Master Plan",
  "/map": "Campus GPS Map",
  "/gpa": "GPA Predictor & Degree Tracker",
  "/timetable": "Weekly Timetable",
  "/exams": "Exam Countdown & Study Plan",
  "/cafeteria": "Cafeteria & Meal Budget",
  "/scholarships": "Scholarship Finder",
};

export default function PrintHeader() {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? "EJUST Student Hub";

  return (
    <div className="hidden print:mb-4 print:block print:border-b print:border-gray-300 print:pb-2">
      <p className="text-base font-bold text-black">{title}</p>
      <p className="text-xs text-gray-600">
        EJUST Student Hub · Egypt-Japan University of Science &amp; Technology
      </p>
    </div>
  );
}
