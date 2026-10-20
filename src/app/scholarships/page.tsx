"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  Bookmark,
  BookmarkCheck,
  CalendarClock,
  ExternalLink,
  Search,
  GraduationCap,
  Coins,
  ChevronDown,
  ChevronUp,
  CalendarPlus,
  Download,
} from "lucide-react";
import {
  SCHOLARSHIPS,
  daysUntil,
  formatDeadline,
  type Level,
} from "@/data/scholarships";
import { downloadEventIcs, scholarshipDeadlineEvent } from "@/lib/ics";

const SAVED_KEY = "ejust-scholarships-saved-v1";

const LEVELS: Level[] = ["Bachelor", "Master", "PhD"];

export default function ScholarshipsPage() {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<Level | "all">("all");
  const [funding, setFunding] = useState<"all" | "Full" | "Stipend">("all");
  const [sort, setSort] = useState<"deadline" | "name">("deadline");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMounted(true);
      try {
        const raw = window.localStorage.getItem(SAVED_KEY);
        if (raw) setSaved(new Set(JSON.parse(raw) as string[]));
      } catch {
        // ignore corrupt storage
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify([...saved]));
    } catch {
      // storage unavailable
    }
  }, [saved, mounted]);

  function toggleSaved(id: string) {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = SCHOLARSHIPS.filter((s) => {
      if (level !== "all" && !s.levels.includes(level)) return false;
      if (funding !== "all" && s.funding !== funding) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.provider.toLowerCase().includes(q) ||
        s.country.toLowerCase().includes(q) ||
        s.fields.toLowerCase().includes(q)
      );
    });
    return list.sort((a, b) =>
      sort === "deadline" ? a.deadline.localeCompare(b.deadline) : a.name.localeCompare(b.name)
    );
  }, [query, level, funding, sort]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Award size={20} className="text-blue-600" />
            Scholarship Finder
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Funding opportunities for Egyptian STEM students. Deadlines are indicative — always
            verify on the official page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saved.size > 0 && (
            <button
              onClick={() =>
                downloadEventIcs(
                  SCHOLARSHIPS.filter((s) => saved.has(s.id)).map(scholarshipDeadlineEvent),
                  "ejust-scholarship-deadlines.ics",
                  "EJUST Scholarship Deadlines"
                )
              }
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
            >
              <Download size={13} />
              Export saved deadlines
            </button>
          )}
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            {saved.size} saved
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, provider, country, or field…"
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400"
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">Level</span>
            <FilterChip active={level === "all"} onClick={() => setLevel("all")}>All</FilterChip>
            {LEVELS.map((l) => (
              <FilterChip key={l} active={level === l} onClick={() => setLevel(l)}>
                {l}
              </FilterChip>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">Funding</span>
            <FilterChip active={funding === "all"} onClick={() => setFunding("all")}>All</FilterChip>
            <FilterChip active={funding === "Full"} onClick={() => setFunding("Full")}>Full</FilterChip>
            <FilterChip active={funding === "Stipend"} onClick={() => setFunding("Stipend")}>Stipend</FilterChip>
          </div>
          <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "deadline" | "name")}
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400"
            >
              <option value="deadline">Deadline (soonest)</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {results.map((s) => {
          const isSaved = saved.has(s.id);
          const isOpen = expanded === s.id;
          const days = mounted ? daysUntil(s.deadline) : null;
          const urgent = days !== null && days >= 0 && days <= 45;
          return (
            <article
              key={s.id}
              className="flex flex-col rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-gray-900">{s.name}</h2>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {s.provider} · {s.country}
                  </p>
                </div>
                <button
                  onClick={() => toggleSaved(s.id)}
                  className={`shrink-0 rounded-md p-1.5 transition ${
                    isSaved
                      ? "bg-blue-50 text-blue-600"
                      : "text-gray-300 hover:bg-gray-50 hover:text-gray-500"
                  }`}
                  aria-label={isSaved ? `Remove ${s.name} from saved` : `Save ${s.name}`}
                >
                  {isSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {s.levels.map((l) => (
                  <span
                    key={l}
                    className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600"
                  >
                    <GraduationCap size={11} />
                    {l}
                  </span>
                ))}
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    s.funding === "Full"
                      ? "bg-green-50 text-green-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  <Coins size={11} />
                  {s.funding === "Full" ? "Full funding" : "Stipend"}
                </span>
              </div>

              <p className="mt-2 text-xs text-gray-600">{s.fundingDetails}</p>

              <div className="mt-2 flex items-center gap-1.5 text-xs">
                <CalendarClock size={13} className="text-gray-400" />
                <span className="font-medium text-gray-700">{formatDeadline(s.deadline)}</span>
                {days !== null && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      days < 0
                        ? "bg-gray-100 text-gray-500"
                        : urgent
                          ? "bg-red-50 text-red-600"
                          : "bg-blue-50 text-blue-600"
                    }`}
                  >
                    {days < 0 ? "closed" : `${days} days left`}
                  </span>
                )}
              </div>

              <button
                onClick={() => setExpanded(isOpen ? null : s.id)}
                className="mt-3 flex items-center justify-between rounded-md bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                {isOpen ? "Hide details" : "Eligibility, tips & link"}
                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {isOpen && (
                <div className="mt-2 space-y-2 text-xs">
                  <p className="text-gray-500">Fields: {s.fields}</p>
                  {s.deadlineNote && (
                    <p className="rounded-md bg-blue-50 px-2 py-1 text-blue-700">{s.deadlineNote}</p>
                  )}
                  <div>
                    <p className="font-semibold text-gray-700">Eligibility</p>
                    <ul className="mt-1 space-y-0.5 text-gray-600">
                      {s.eligibility.map((e) => (
                        <li key={e} className="flex items-start gap-1.5">
                          <span className="mt-0.5 text-green-600">✓</span>
                          {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="rounded-md bg-amber-50 px-2 py-1.5 text-amber-800">
                    <strong>Tip:</strong> {s.tips}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() =>
                        downloadEventIcs(
                          [scholarshipDeadlineEvent(s)],
                          `ejust-${s.id}-deadline.ics`,
                          `${s.name} deadline`
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
                    >
                      <CalendarPlus size={12} />
                      Add deadline to calendar
                    </button>
                    <a
                      href={s.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      Official page
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {results.length === 0 && (
        <p className="mt-10 text-center text-sm text-gray-400">
          No scholarships match these filters.
        </p>
      )}
    </main>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
        active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {children}
    </button>
  );
}
