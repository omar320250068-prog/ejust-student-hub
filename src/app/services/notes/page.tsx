"use client";

import { useMemo, useState } from "react";
import { BookOpen, Download, Upload, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { SearchBar, StudyShell } from "@/components/ExperienceShells";

const NOTES = [
  { title: "Data Structures & Algorithms", code: "CSE201", faculty: "Engineering", type: "Lecture notes", term: "Year 2 · Term 1", pages: 84, size: "4.8 MB" },
  { title: "Differential Equations", code: "MATH201", faculty: "Engineering", type: "Courseware", term: "Year 2 · Term 1", pages: 112, size: "7.2 MB" },
  { title: "Japanese Language I", code: "JPN101", faculty: "Humanities", type: "Study pack", term: "Year 1 · Term 1", pages: 56, size: "3.1 MB" },
  { title: "Circuit Analysis", code: "EECE201", faculty: "Engineering", type: "Lecture notes", term: "Year 2 · Term 1", pages: 97, size: "5.6 MB" },
] as const;

export default function NotesPage() {
  const { t } = useLanguage(); const [query, setQuery] = useState(""); const [faculty, setFaculty] = useState("All"); const [uploadOpen, setUploadOpen] = useState(false);
  const visible = useMemo(() => NOTES.filter((item) => (!query || `${item.title} ${item.code}`.toLowerCase().includes(query.toLowerCase())) && (faculty === "All" || item.faculty === faculty)), [faculty, query]);
  return <StudyShell icon={<BookOpen size={19} />} title={t("study.notes")} description="Search courseware, revision packs, and student-shared lecture notes." action={<button onClick={() => setUploadOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"><Upload size={15} />{t("study.upload")}</button>}>
    <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row"><SearchBar value={query} onChange={setQuery} placeholder={t("study.search")} /><select value={faculty} onChange={(event) => setFaculty(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"><option>All</option><option>Engineering</option><option>Humanities</option></select></div>
    <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{visible.map((item) => <article key={item.code} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-cyan-400 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300"><BookOpen size={18} /></span><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">{item.type}</span></div><p className="mt-5 font-mono text-xs font-semibold text-cyan-700 dark:text-cyan-300">{item.code}</p><h2 className="mt-1 font-semibold">{item.title}</h2><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{item.faculty} · {item.term}</p><div className="mt-4 flex justify-between text-xs text-slate-500 dark:text-slate-400"><span>{item.pages} {t("study.pages")}</span><span>{item.size}</span></div><button className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 dark:text-cyan-300"><Download size={15} />{t("study.download")}</button></article>)}</div>
    {!visible.length && <p className="mt-8 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">{t("study.noResults")}</p>}
    {uploadOpen && <div className="fixed inset-0 z-30 flex justify-end bg-slate-950/40"><aside className="h-full w-full max-w-md bg-white p-6 shadow-2xl dark:bg-slate-900"><div className="flex justify-between"><h2 className="text-xl font-semibold">{t("study.upload")}</h2><button onClick={() => setUploadOpen(false)} aria-label="Close"><X size={18} /></button></div><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Share a clear, course-labelled resource with your classmates.</p><input type="file" className="mt-8 block w-full rounded-xl border border-dashed border-slate-300 p-5 text-sm dark:border-slate-700" /><button onClick={() => setUploadOpen(false)} className="mt-4 w-full rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white">Save resource</button></aside></div>}
  </StudyShell>;
}
