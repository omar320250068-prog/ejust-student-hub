"use client";

import { useMemo, useState } from "react";
import { BookOpen, Download, Search, SlidersHorizontal } from "lucide-react";
import { MotionSection, ServicePageShell } from "@/components/ServicePageShell";

const NOTES = [
  { title: "Data Structures & Algorithms", code: "CSE201", faculty: "Engineering", type: "Lecture notes", term: "Year 2 · Term 1", pages: 84 },
  { title: "Differential Equations", code: "MATH201", faculty: "Engineering", type: "Courseware", term: "Year 2 · Term 1", pages: 112 },
  { title: "Japanese Language I", code: "JPN101", faculty: "Humanities", type: "Study pack", term: "Year 1 · Term 1", pages: 56 },
  { title: "Circuit Analysis", code: "EECE201", faculty: "Engineering", type: "Lecture notes", term: "Year 2 · Term 1", pages: 97 },
  { title: "Academic English", code: "ENG101", faculty: "Humanities", type: "Courseware", term: "Year 1 · Term 2", pages: 42 },
  { title: "Probability & Statistics", code: "STAT201", faculty: "Engineering", type: "Study pack", term: "Year 2 · Term 1", pages: 73 },
] as const;

export default function NotesPage() {
  const [query, setQuery] = useState("");
  const [faculty, setFaculty] = useState("All faculties");
  const [type, setType] = useState("All formats");

  const visibleNotes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return NOTES.filter((note) => {
      const matchesQuery =
        !needle ||
        `${note.title} ${note.code} ${note.faculty}`.toLowerCase().includes(needle);
      return (
        matchesQuery &&
        (faculty === "All faculties" || note.faculty === faculty) &&
        (type === "All formats" || note.type === type)
      );
    });
  }, [faculty, query, type]);

  return (
    <ServicePageShell
      eyebrow="Learning library"
      title="Lecture notes that keep your week moving."
      description="Search courseware, revision packs, and lecture notes shared by EJUST students. Start with a course code or subject name."
    >
      <MotionSection className="mt-8" delay={0.14}>
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by course code or title"
              className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-gray-400" />
            <select value={faculty} onChange={(event) => setFaculty(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-400">
              <option>All faculties</option>
              <option>Engineering</option>
              <option>Humanities</option>
            </select>
          </label>
          <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-400">
            <option>All formats</option>
            <option>Lecture notes</option>
            <option>Courseware</option>
            <option>Study pack</option>
          </select>
        </div>
      </MotionSection>

      <MotionSection className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3" delay={0.2}>
        {visibleNotes.map((note) => (
          <article key={note.code} className="group rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <BookOpen size={19} />
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-500">{note.type}</span>
            </div>
            <p className="mt-5 font-mono text-xs font-semibold text-blue-700">{note.code}</p>
            <h2 className="mt-1 text-base font-semibold text-gray-900">{note.title}</h2>
            <p className="mt-2 text-xs text-gray-500">{note.faculty} · {note.term} · {note.pages} pages</p>
            <button type="button" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-gray-700 transition group-hover:text-blue-700">
              <Download size={15} />
              View resource
            </button>
          </article>
        ))}
      </MotionSection>
      {visibleNotes.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          No resources match those filters.
        </p>
      )}
    </ServicePageShell>
  );
}
