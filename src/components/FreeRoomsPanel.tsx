"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { Building2, Search, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import {
  defaultFreeRoomsQuery,
  findFreeRooms,
  type FreeRoom,
} from "@/lib/free-rooms";
import { readTimetableSnapshot } from "@/lib/student-data";
import { DAYS, type ClassBlock, type Day } from "@/lib/timetable";

interface RoomQuery {
  day: Day;
  start: string;
  end: string;
  filter: string;
}

export interface FreeRoomsPanelProps {
  /** Pre-fill the filter, e.g. from a `/master-plan?building=B17&room=G0.22` link. */
  initialFilter?: string;
}

/** Find rooms with no scheduled overlap in a Cairo-time window. */
export default function FreeRoomsPanel({ initialFilter = "" }: FreeRoomsPanelProps) {
  const { t } = useLanguage();
  const { data: session, status } = useSession();
  const studentUser = status === "authenticated" ? session?.user : null;
  const userScope = studentUser?.id ?? studentUser?.email ?? null;
  const [form, setForm] = useState<RoomQuery>(() => ({
    ...defaultFreeRoomsQuery(),
    filter: initialFilter,
  }));
  const [applied, setApplied] = useState<RoomQuery>(form);
  const [customClasses, setCustomClasses] = useState<ClassBlock[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const snapshot = readTimetableSnapshot(window.localStorage, studentUser);
        setCustomClasses(Object.values(snapshot.schedules).flat());
      } catch {
        setCustomClasses([]);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [studentUser, userScope]);

  const results = useMemo<FreeRoom[]>(
    () => findFreeRooms({ ...applied, customClasses }),
    [applied, customClasses],
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApplied({ ...form });
  }

  function clearFilter() {
    setForm((current) => ({ ...current, filter: "" }));
    setApplied((current) => ({ ...current, filter: "" }));
  }

  return (
    <section
      id="free-rooms"
      aria-labelledby="free-rooms-title"
      className="scroll-mt-20 rounded-[1.5rem] border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/75 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="free-rooms-title"
            className="flex items-center gap-2 text-xl font-semibold text-slate-900 dark:text-white"
          >
            <Building2 size={19} className="text-cyan-600 dark:text-cyan-300" />
            {t("freeRooms.title")}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t("freeRooms.subtitle")}
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t("freeRooms.day")}
            <select
              value={form.day}
              onChange={(event) => setForm({ ...form, day: event.target.value as Day })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              {DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t("freeRooms.from")}
            <input
              type="time"
              value={form.start}
              onChange={(event) => setForm({ ...form, start: event.target.value })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t("freeRooms.to")}
            <input
              type="time"
              value={form.end}
              onChange={(event) => setForm({ ...form, end: event.target.value })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 sm:col-span-2 lg:col-span-1">
            {t("freeRooms.filter")}
            <input
              value={form.filter}
              onChange={(event) => setForm({ ...form, filter: event.target.value })}
              placeholder={t("freeRooms.filterPlaceholder")}
              className="min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
            <button
              type="submit"
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
            >
              <Search size={15} />
              {t("freeRooms.search")}
            </button>
            <button
              type="button"
              onClick={clearFilter}
              aria-label={t("freeRooms.clear")}
              title={t("freeRooms.clear")}
              className="inline-flex min-h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <X size={15} />
            </button>
          </div>
      </form>

      <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {t("freeRooms.estimated")}
      </p>

      <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {t("freeRooms.results", { n: results.length })}
      </p>

      {results.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {t("freeRooms.empty")}
        </p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((room) => (
            <li key={room.key}>
              <a
                href={`/master-plan?building=${encodeURIComponent(room.building)}&room=${encodeURIComponent(room.room)}#free-rooms`}
                title={t("freeRooms.viewRoom")}
                className="block rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-cyan-300 hover:bg-cyan-50 dark:border-slate-700 dark:bg-slate-950/50 dark:hover:border-cyan-700 dark:hover:bg-cyan-950/30"
              >
                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {room.label}
                </span>
                <span className="mt-1 block text-xs text-cyan-700 dark:text-cyan-300">
                  {room.nextClass
                    ? t("freeRooms.freeUntil", { time: room.nextClass.start })
                    : t("freeRooms.freeRestOfDay")}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
