"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, FileText, Upload, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { SearchBar, StudyShell } from "@/components/ExperienceShells";

const PAPERS = [
  { title: "Calculus I · Final examination", code: "MATH101", year: "2025", faculty: "Engineering", solutions: true, pages: 8, size: "1.2 MB" },
  { title: "Physics II · Midterm", code: "PHYS102", year: "2025", faculty: "Engineering", solutions: true, pages: 5, size: "820 KB" },
  { title: "Data Structures · Final examination", code: "CSE201", year: "2024", faculty: "Engineering", solutions: false, pages: 10, size: "1.8 MB" },
  { title: "Academic English · Final examination", code: "ENG101", year: "2024", faculty: "Humanities", solutions: true, pages: 6, size: "940 KB" },
] as const;

export default function PastPapersPage() {
  const { t } = useLanguage(); const [query, setQuery] = useState(""); const [year, setYear] = useState("All"); const [solutions, setSolutions] = useState(false); const [uploadOpen, setUploadOpen] = useState(false);
  const visible = useMemo(() => PAPERS.filter((item) => (!query || `${item.title} ${item.code}`.toLowerCase().includes(query.toLowerCase())) && (year === "All" || item.year === year) && (!solutions || item.solutions)), [query, solutions, year]);
  return <StudyShell icon={<FileText size={19} />} title={t("study.pastPapers")} description="Find previous exams by course and year, with verified solution keys where available." action={<button onClick={() => setUploadOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"><Upload size={15} />{t("study.upload")}</button>}>
    <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row"><SearchBar value={query} onChange={setQuery} placeholder={t("study.search")} /><select value={year} onChange={(event) => setYear(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"><option>All</option><option>2025</option><option>2024</option></select><label className="flex items-center gap-2 px-2 text-sm"><input type="checkbox" checked={solutions} onChange={(event) => setSolutions(event.target.checked)} className="accent-cyan-600" />{t("study.solutions")}</label></div>
    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">{visible.map((item) => <div key={`${item.code}-${item.year}`} className="flex flex-col gap-3 border-b border-slate-100 p-5 last:border-0 dark:border-slate-800 sm:flex-row sm:items-center"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"><FileText size={18} /></span><div className="min-w-0 flex-1"><p className="font-mono text-xs font-semibold text-cyan-700 dark:text-cyan-300">{item.code}</p><h2 className="font-semibold">{item.title}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.year} · {item.pages} {t("study.pages")} · {item.size}</p></div><span className={item.solutions ? "flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300" : "text-xs text-slate-400"}>{item.solutions && <CheckCircle2 size={14} />}{item.solutions ? "Key available" : "Paper only"}</span><button className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 dark:text-cyan-300"><Download size={15} />{t("study.download")}</button></div>)}</div>
    {!visible.length && <p className="mt-8 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">{t("study.noResults")}</p>}
    {uploadOpen && <div className="fixed inset-0 z-30 flex justify-end bg-slate-950/40"><aside className="h-full w-full max-w-md bg-white p-6 shadow-2xl dark:bg-slate-900"><div className="flex justify-between"><h2 className="text-xl font-semibold">{t("study.upload")}</h2><button onClick={() => setUploadOpen(false)} aria-label="Close"><X size={18} /></button></div><input type="file" className="mt-8 block w-full rounded-xl border border-dashed border-slate-300 p-5 text-sm dark:border-slate-700" /><button onClick={() => setUploadOpen(false)} className="mt-4 w-full rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white">Save resource</button></aside></div>}
  </StudyShell>;
}
