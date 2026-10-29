"use client";

import { useMemo, useState } from "react";
import { Calculator, Plus, Target, Trash2 } from "lucide-react";
import { MotionSection, ServicePageShell } from "@/components/ServicePageShell";

const GRADE_POINTS: Record<string, number> = { A: 4, "B+": 3.5, B: 3, "C+": 2.5, C: 2, D: 1, F: 0 };
type Course = { id: number; code: string; credits: number; grade: string };

export default function ServiceGpaPage() {
  const [courses, setCourses] = useState<Course[]>([
    { id: 1, code: "MATH101", credits: 4, grade: "A" },
    { id: 2, code: "CSE101", credits: 3, grade: "B+" },
  ]);
  const [target, setTarget] = useState(3.5);
  const [draft, setDraft] = useState({ code: "", credits: 3, grade: "A" });
  const totalCredits = courses.reduce((sum, course) => sum + course.credits, 0);
  const gpa = useMemo(
    () => (totalCredits ? courses.reduce((sum, course) => sum + course.credits * GRADE_POINTS[course.grade], 0) / totalCredits : 0),
    [courses, totalCredits],
  );
  const gap = Math.max(0, target - gpa);

  function addCourse(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.code.trim() || draft.credits < 1) return;
    setCourses((current) => [...current, { ...draft, code: draft.code.trim().toUpperCase(), id: Date.now() }]);
    setDraft({ code: "", credits: 3, grade: "A" });
  }

  return (
    <ServicePageShell eyebrow="Planning tool" title="Know where your GPA is headed." description="Add completed courses, test a target, and use the live calculation to make your next semester count.">
      <MotionSection className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]" delay={0.14}>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><Calculator size={18} className="text-blue-600" /><h2 className="font-semibold text-gray-900">Completed courses</h2></div>
          <div className="mt-4 divide-y divide-gray-100">
            {courses.map((course) => <div key={course.id} className="flex items-center gap-3 py-3"><span className="flex-1 font-mono text-xs font-semibold text-gray-700">{course.code}</span><span className="text-xs text-gray-500">{course.credits} credits</span><span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{course.grade}</span><button type="button" onClick={() => setCourses((current) => current.filter((item) => item.id !== course.id))} aria-label={`Remove ${course.code}`} className="text-gray-300 hover:text-red-600"><Trash2 size={15} /></button></div>)}
          </div>
          <form onSubmit={addCourse} className="mt-4 flex flex-wrap items-end gap-2 rounded-xl bg-gray-50 p-3">
            <label className="flex min-w-32 flex-1 flex-col gap-1 text-xs text-gray-500">Course code<input value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} placeholder="EECE201" className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm text-gray-900 outline-none focus:border-blue-400" /></label>
            <label className="flex w-20 flex-col gap-1 text-xs text-gray-500">Credits<input type="number" min={1} max={12} value={draft.credits} onChange={(event) => setDraft({ ...draft, credits: Number(event.target.value) || 1 })} className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm text-gray-900 outline-none focus:border-blue-400" /></label>
            <label className="flex w-24 flex-col gap-1 text-xs text-gray-500">Grade<select value={draft.grade} onChange={(event) => setDraft({ ...draft, grade: event.target.value })} className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm text-gray-900 outline-none focus:border-blue-400">{Object.keys(GRADE_POINTS).map((grade) => <option key={grade}>{grade}</option>)}</select></label>
            <button type="submit" className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={15} />Add</button>
          </form>
        </div>
        <div className="rounded-2xl bg-gray-950 p-6 text-white shadow-sm">
          <p className="text-sm text-gray-400">Current GPA</p>
          <p className="mt-2 text-6xl font-bold tracking-tight">{gpa.toFixed(2)}</p>
          <p className="mt-2 text-sm text-gray-400">{totalCredits} graded credits</p>
          <div className="mt-8 border-t border-white/10 pt-5">
            <label className="flex items-center justify-between gap-3 text-sm text-gray-300">Target GPA<input type="number" min={0} max={4} step={0.1} value={target} onChange={(event) => setTarget(Math.min(4, Math.max(0, Number(event.target.value) || 0)))} className="w-20 rounded-lg bg-white/10 px-2 py-1.5 text-right text-white outline-none focus:ring-2 focus:ring-blue-400" /></label>
            <p className="mt-5 flex items-center gap-2 text-sm text-gray-300"><Target size={16} className="text-blue-300" />{gap === 0 ? "You are at or above target." : `${gap.toFixed(2)} points to close.`}</p>
          </div>
        </div>
      </MotionSection>
    </ServicePageShell>
  );
}
