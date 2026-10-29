"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FileText, Search, SlidersHorizontal } from "lucide-react";
import { MotionSection, ServicePageShell } from "@/components/ServicePageShell";

const PAPERS = [
  { title: "Calculus I · Final examination", code: "MATH101", year: "2025", faculty: "Engineering", solutions: true, pages: 8 },
  { title: "Physics II · Midterm", code: "PHYS102", year: "2025", faculty: "Engineering", solutions: true, pages: 5 },
  { title: "Data Structures · Final examination", code: "CSE201", year: "2024", faculty: "Engineering", solutions: false, pages: 10 },
  { title: "Academic English · Final examination", code: "ENG101", year: "2024", faculty: "Humanities", solutions: true, pages: 6 },
  { title: "Chemistry I · Midterm", code: "CHEM101", year: "2023", faculty: "Engineering", solutions: false, pages: 7 },
] as const;

export default function PastPapersPage() {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("All years");
  const [solutionsOnly, setSolutionsOnly] = useState(false);

  const visiblePapers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return PAPERS.filter((paper) => {
      const matchesQuery = !needle || `${paper.title} ${paper.code}`.toLowerCase().includes(needle);
      return matchesQuery && (year === "All years" || paper.year === year) && (!solutionsOnly || paper.solutions);
    });
  }, [query, solutionsOnly, year]);

  return (
    <ServicePageShell
      eyebrow="Exam archives"
      title="Past papers, without the scavenger hunt."
      description="Find previous exams by course and year, then check whether a verified solution key is available."
    >
      <MotionSection className="mt-8" delay={0.14}>
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by course or exam title" className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          </label>
          <label className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-gray-400" />
            <select value={year} onChange={(event) => setYear(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-400">
              <option>All years</option><option>2025</option><option>2024</option><option>2023</option>
            </select>
          </label>
          <label className="flex items-center gap-2 whitespace-nowrap px-1 text-sm text-gray-600">
            <input type="checkbox" checked={solutionsOnly} onChange={(event) => setSolutionsOnly(event.target.checked)} className="h-4 w-4 accent-blue-600" />
            Solutions only
          </label>
        </div>
      </MotionSection>
      <MotionSection className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm" delay={0.2}>
        <div className="hidden grid-cols-[1fr_120px_140px_130px] gap-4 border-b border-gray-100 bg-gray-50 px-5 py-3 text-xs font-semibold text-gray-500 sm:grid">
          <span>Paper</span><span>Year</span><span>Coverage</span><span />
        </div>
        {visiblePapers.map((paper) => (
          <div key={`${paper.code}-${paper.year}`} className="grid gap-3 border-b border-gray-100 px-5 py-4 last:border-0 sm:grid-cols-[1fr_120px_140px_130px] sm:items-center sm:gap-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><FileText size={17} /></span>
              <div><p className="font-mono text-xs font-semibold text-blue-700">{paper.code}</p><p className="text-sm font-semibold text-gray-900">{paper.title}</p></div>
            </div>
            <span className="text-sm text-gray-600">{paper.year}</span>
            <span className="text-sm text-gray-500">{paper.pages} pages · {paper.faculty}</span>
            <span className={paper.solutions ? "flex items-center gap-1.5 text-sm font-medium text-emerald-700" : "text-sm text-gray-400"}>
              {paper.solutions && <CheckCircle2 size={15} />} {paper.solutions ? "Key available" : "Paper only"}
            </span>
          </div>
        ))}
      </MotionSection>
      {visiblePapers.length === 0 && <p className="mt-8 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">No papers match those filters.</p>}
    </ServicePageShell>
  );
}
