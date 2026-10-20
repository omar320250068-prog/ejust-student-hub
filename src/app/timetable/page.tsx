"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Download, AlertTriangle, CalendarDays } from "lucide-react";
import {
  DAYS,
  type ClassBlock,
  type Day,
  findConflicts,
  isValidTimeRange,
  toMinutes,
  downloadIcs,
} from "@/lib/timetable";
import PrintButton from "@/components/PrintButton";

const STORAGE_KEY = "ejust-timetable-v1";

const PALETTE = [
  { name: "blue", hex: "#2563eb" },
  { name: "emerald", hex: "#059669" },
  { name: "amber", hex: "#d97706" },
  { name: "rose", hex: "#e11d48" },
  { name: "violet", hex: "#7c3aed" },
  { name: "cyan", hex: "#0891b2" },
];

const SEED: ClassBlock[] = [
  { id: "t1", courseCode: "MATH201", title: "Differential Equations", day: "Sun", start: "08:30", end: "10:10", location: "Lecture Hall B2", color: PALETTE[0].hex },
  { id: "t2", courseCode: "EECE201", title: "Circuit Analysis", day: "Mon", start: "10:30", end: "12:10", location: "Building 8 — Lab 3", color: PALETTE[1].hex },
  { id: "t3", courseCode: "CSE201", title: "Data Structures", day: "Mon", start: "13:00", end: "14:40", location: "Lecture Hall B1", color: PALETTE[2].hex },
  { id: "t4", courseCode: "STAT201", title: "Probability & Statistics", day: "Tue", start: "08:30", end: "10:10", location: "Lecture Hall B3", color: PALETTE[3].hex },
  { id: "t5", courseCode: "MATH201", title: "Differential Equations", day: "Wed", start: "10:30", end: "12:10", location: "Lecture Hall B2", color: PALETTE[0].hex },
  { id: "t6", courseCode: "EECE201", title: "Circuits Lab", day: "Wed", start: "14:00", end: "15:40", location: "Center of Excellence Labs", color: PALETTE[1].hex },
  { id: "t7", courseCode: "CSE201", title: "Data Structures", day: "Thu", start: "08:30", end: "10:10", location: "Lecture Hall B1", color: PALETTE[2].hex },
  { id: "t8", courseCode: "STAT201", title: "Statistics Tutorial", day: "Thu", start: "11:00", end: "12:00", location: "Smart Classroom S1", color: PALETTE[3].hex },
];

const HOUR_PX = 64;

export default function TimetablePage() {
  const [blocks, setBlocks] = useState<ClassBlock[]>(SEED);
  const [form, setForm] = useState({
    courseCode: "",
    title: "",
    day: "Sun" as Day,
    start: "08:30",
    end: "10:10",
    location: "",
    color: PALETTE[4].hex,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as ClassBlock[];
        if (Array.isArray(saved) && saved.length) setBlocks(saved);
      } catch {
        // fall back to seed
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
      } catch {
        // storage unavailable
      }
    }, 100);
    return () => window.clearTimeout(timer);
  }, [blocks]);

  const conflicts = useMemo(() => findConflicts(blocks), [blocks]);
  const conflictIds = useMemo(() => {
    const set = new Set<string>();
    for (const c of conflicts) {
      set.add(c.a.id);
      set.add(c.b.id);
    }
    return set;
  }, [conflicts]);

  const { dayStart, dayEnd } = useMemo(() => {
    let min = 8 * 60;
    let max = 18 * 60;
    for (const b of blocks) {
      min = Math.min(min, Math.floor(toMinutes(b.start) / 60) * 60);
      max = Math.max(max, Math.ceil(toMinutes(b.end) / 60) * 60);
    }
    return { dayStart: min, dayEnd: Math.max(max, min + 60) };
  }, [blocks]);

  const hours: number[] = [];
  for (let m = dayStart; m <= dayEnd; m += 60) hours.push(m);
  const gridHeight = ((dayEnd - dayStart) / 60) * HOUR_PX;

  function addBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!form.courseCode.trim() || !form.title.trim()) {
      setError("Course code and title are required.");
      return;
    }
    if (!isValidTimeRange(form.start, form.end)) {
      setError("End time must be after start time.");
      return;
    }
    setError("");
    setBlocks((prev) => [
      ...prev,
      {
        id: `t-${Date.now()}`,
        courseCode: form.courseCode.trim().toUpperCase(),
        title: form.title.trim(),
        day: form.day,
        start: form.start,
        end: form.end,
        location: form.location.trim(),
        color: form.color,
      },
    ]);
    setForm((f) => ({ ...f, courseCode: "", title: "", location: "" }));
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Timetable Builder</h1>
          <p className="mt-1 text-sm text-gray-500">
            Weekly schedule with conflict detection. Export to Google Calendar, Outlook, or Apple Calendar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrintButton />
          <button
            onClick={() => downloadIcs(blocks)}
            disabled={blocks.length === 0}
            className="print:hidden flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            <Download size={15} />
            Export .ics
          </button>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle size={15} />
            {conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} detected
          </p>
          <ul className="mt-1 list-inside list-disc text-xs">
            {conflicts.map((c, i) => (
              <li key={i}>
                {c.a.day} {c.a.start}–{c.a.end} ({c.a.courseCode}) overlaps {c.b.start}–{c.b.end} ({c.b.courseCode})
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex min-w-[760px]">
          <div className="w-12 shrink-0">
            <div className="h-7" />
            {hours.slice(0, -1).map((m) => (
              <div key={m} style={{ height: HOUR_PX }} className="relative">
                <span className="absolute -top-2 right-1.5 text-[10px] text-gray-400">
                  {String(Math.floor(m / 60)).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>
          {DAYS.map((day) => {
            const dayBlocks = blocks.filter((b) => b.day === day);
            return (
              <div key={day} className="min-w-0 flex-1 border-l border-gray-100">
                <div className="h-7 text-center text-xs font-semibold text-gray-600">{day}</div>
                <div className="relative" style={{ height: gridHeight }}>
                  {hours.map((m) => (
                    <div
                      key={m}
                      className="absolute left-0 right-0 border-t border-dashed border-gray-100"
                      style={{ top: ((m - dayStart) / 60) * HOUR_PX }}
                    />
                  ))}
                  {dayBlocks.map((b) => {
                    const top = ((toMinutes(b.start) - dayStart) / 60) * HOUR_PX;
                    const height = Math.max(24, ((toMinutes(b.end) - toMinutes(b.start)) / 60) * HOUR_PX - 3);
                    const conflicting = conflictIds.has(b.id);
                    return (
                      <div
                        key={b.id}
                        className="group absolute left-0.5 right-0.5 overflow-hidden rounded-md px-1.5 py-1 text-white shadow-sm"
                        style={{
                          top,
                          height,
                          background: b.color,
                          outline: conflicting ? "2px solid #dc2626" : undefined,
                        }}
                        title={`${b.courseCode} ${b.title} · ${b.start}–${b.end} · ${b.location}`}
                      >
                        <p className="truncate text-[11px] font-bold leading-tight">
                          {b.courseCode}
                        </p>
                        <p className="truncate text-[10px] leading-tight opacity-90">
                          {b.start}–{b.end} · {b.location}
                        </p>
                        <button
                          onClick={() => removeBlock(b.id)}
                          className="absolute right-0.5 top-0.5 hidden rounded bg-black/25 p-0.5 group-hover:block"
                          aria-label={`Remove ${b.courseCode}`}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    );
                  })}
                  {dayBlocks.length === 0 && (
                    <p className="absolute inset-x-0 top-4 text-center text-[10px] text-gray-300">
                      —
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <CalendarDays size={15} />
          Add class
        </h2>
        <form onSubmit={addBlock} className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-3">
          <Field label="Code">
            <input value={form.courseCode} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} placeholder="MATH201" className="w-28 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
          </Field>
          <Field label="Title" className="min-w-40 flex-1">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Differential Equations" className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
          </Field>
          <Field label="Day">
            <select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value as Day })} className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400">
              {DAYS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label="Start">
            <input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
          </Field>
          <Field label="End">
            <input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
          </Field>
          <Field label="Location" className="min-w-32 flex-1">
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Lecture Hall B2" className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
          </Field>
          <Field label="Color">
            <div className="flex gap-1 py-1">
              {PALETTE.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setForm({ ...form, color: c.hex })}
                  className={`h-5 w-5 rounded-full ${form.color === c.hex ? "ring-2 ring-gray-900 ring-offset-1" : ""}`}
                  style={{ background: c.hex }}
                  aria-label={c.name}
                />
              ))}
            </div>
          </Field>
          <button type="submit" className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={14} />
            Add
          </button>
        </form>
        {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
      </section>
    </main>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-0.5 text-xs text-gray-500 ${className}`}>
      {label}
      {children}
    </label>
  );
}
