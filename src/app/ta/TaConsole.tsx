"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  Trash2,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import type { MeritTier } from "@/lib/merit";
import {
  answerQaThread,
  postCourseAnnouncement,
  saveFacultyOffice,
  setOfficePresence,
  type OfficeHourSlot,
} from "./actions";

export type TaAnnouncement = {
  id: string;
  courseCode: string;
  kind: string;
  title: string;
  body: string;
  location: string;
  createdAt: string;
};

export type TaQuestion = {
  id: string;
  question: string;
  questionAr: string | null;
  status: string;
  peerAnswer: string | null;
  createdAt: string;
};

type Office = {
  id: string;
  name: string;
  department: string;
  building: string;
  officeNumber: string;
  officeHours: OfficeHourSlot[];
  statusNote: string | null;
  isInOffice: boolean;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const KINDS = [
  { value: "LAB_CHANGE", key: "ta.kindLabChange" },
  { value: "ROOM_CHANGE", key: "ta.kindRoomChange" },
  { value: "CANCELLATION", key: "ta.kindCancellation" },
  { value: "RESCHEDULE", key: "ta.kindReschedule" },
  { value: "GENERAL", key: "ta.kindGeneral" },
] as const;

export default function TaConsole({
  staffName,
  tier,
  office,
  courses,
  announcements,
  questions,
}: {
  staffName: string;
  tier: MeritTier;
  office: Office | null;
  courses: { id: string; code: string; name: string }[];
  announcements: TaAnnouncement[];
  questions: TaQuestion[];
}) {
  const { t } = useLanguage();

  const [building, setBuilding] = useState(office?.building ?? "");
  const [room, setRoom] = useState(office?.officeNumber ?? "");
  const [note, setNote] = useState(office?.statusNote ?? "");
  const [hours, setHours] = useState<OfficeHourSlot[]>(office?.officeHours ?? []);
  const [inOffice, setInOffice] = useState(office?.isInOffice ?? false);
  const [officeBusy, setOfficeBusy] = useState(false);
  const [officeMessage, setOfficeMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [feed, setFeed] = useState(announcements);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [kind, setKind] = useState<string>("LAB_CHANGE");
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annBuilding, setAnnBuilding] = useState("");
  const [annRoom, setAnnRoom] = useState("");
  const [annBusy, setAnnBusy] = useState(false);
  const [annMessage, setAnnMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [queue, setQueue] = useState(questions);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [answerBusyId, setAnswerBusyId] = useState<string | null>(null);
  const [answerMessage, setAnswerMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function updateHour(index: number, patch: Partial<OfficeHourSlot>) {
    setHours((current) => current.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  }

  async function submitOffice(event: React.FormEvent) {
    event.preventDefault();
    setOfficeBusy(true);
    setOfficeMessage(null);
    const result = await saveFacultyOffice({
      building,
      officeNumber: room,
      officeHours: hours,
      statusNote: note,
    });
    setOfficeMessage({ ok: result.ok, text: result.ok ? result.message : result.error });
    setOfficeBusy(false);
  }

  async function togglePresence() {
    const next = !inOffice;
    setInOffice(next);
    setOfficeBusy(true);
    setOfficeMessage(null);
    const result = await setOfficePresence({ isInOffice: next, statusNote: note });
    if (!result.ok) {
      setInOffice(!next);
      setOfficeMessage({ ok: false, text: result.error });
    } else {
      setOfficeMessage({ ok: true, text: result.message });
    }
    setOfficeBusy(false);
  }

  async function submitAnnouncement(event: React.FormEvent) {
    event.preventDefault();
    setAnnBusy(true);
    setAnnMessage(null);
    const result = await postCourseAnnouncement({
      courseId,
      kind,
      title: annTitle,
      body: annBody,
      building: annBuilding,
      room: annRoom,
    });
    if (result.ok) {
      setFeed((current) => [
        {
          id: `local-${Date.now()}`,
          courseCode: courses.find((course) => course.id === courseId)?.code ?? "—",
          kind,
          title: annTitle,
          body: annBody,
          location: [annBuilding, annRoom].filter(Boolean).join(" · "),
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);
      setAnnTitle("");
      setAnnBody("");
      setAnnBuilding("");
      setAnnRoom("");
      setAnnMessage({ ok: true, text: result.message });
    } else {
      setAnnMessage({ ok: false, text: result.error });
    }
    setAnnBusy(false);
  }

  async function submitAnswer(threadId: string) {
    const body = (drafts[threadId] ?? "").trim();
    setAnswerBusyId(threadId);
    setAnswerMessage(null);
    const result = await answerQaThread({ threadId, body });
    if (result.ok) {
      setQueue((current) => current.filter((thread) => thread.id !== threadId));
      setDrafts((current) => ({ ...current, [threadId]: "" }));
      setAnswerMessage({ ok: true, text: result.message });
    } else {
      setAnswerMessage({ ok: false, text: result.error });
    }
    setAnswerBusyId(null);
  }

  const statusTone = (ok: boolean) => (ok ? "text-emerald-600" : "text-rose-600");

  return (
    <main className="min-h-[calc(100vh-3rem)] bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href="/today"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-300"
        >
          <ArrowLeft size={15} /> {t("ta.back")}
        </Link>

        <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-300">
              {t("ta.eyebrow")}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t("ta.title")}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">{t("ta.subtitle")}</p>
          </div>
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 dark:border-cyan-800/60 dark:bg-cyan-950/40 dark:text-cyan-200">
            {staffName} · {tier.replace("_", " ")}
          </div>
        </header>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <MapPin size={17} className="text-cyan-600 dark:text-cyan-300" />
                {t("ta.office")}
              </h2>
              {office && (
                <button
                  type="button"
                  onClick={togglePresence}
                  disabled={officeBusy}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    inOffice
                      ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${inOffice ? "bg-emerald-500" : "bg-slate-400"}`} />
                  {inOffice ? t("ta.inOffice") : t("ta.away")}
                </button>
              )}
            </div>

            {!office ? (
              <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                {t("ta.noOffice")}
              </p>
            ) : (
              <form onSubmit={submitOffice} className="mt-4 space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {office.name} · {office.department}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {t("ta.building")}
                    <input
                      value={building}
                      onChange={(event) => setBuilding(event.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-950"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {t("ta.room")}
                    <input
                      value={room}
                      onChange={(event) => setRoom(event.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-950"
                    />
                  </label>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {t("ta.officeHours")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setHours((current) => [...current, { day: "Sunday", start: "10:00", end: "11:00" }])}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-900 dark:text-cyan-300"
                    >
                      <Plus size={13} /> {t("ta.addSlot")}
                    </button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {hours.length === 0 && (
                      <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        {t("ta.noSlots")}
                      </p>
                    )}
                    {hours.map((slot, index) => (
                      <div key={`${slot.day}-${index}`} className="flex flex-wrap items-center gap-2">
                        <select
                          value={slot.day}
                          onChange={(event) => updateHour(index, { day: event.target.value })}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                        >
                          {DAYS.map((day) => (
                            <option key={day} value={day}>{day}</option>
                          ))}
                        </select>
                        <input
                          type="time"
                          value={slot.start}
                          onChange={(event) => updateHour(index, { start: event.target.value })}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                        />
                        <span className="text-xs text-slate-400">→</span>
                        <input
                          type="time"
                          value={slot.end}
                          onChange={(event) => updateHour(index, { end: event.target.value })}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                        />
                        <button
                          type="button"
                          onClick={() => setHours((current) => current.filter((_, i) => i !== index))}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                          aria-label={t("ta.removeSlot")}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t("ta.statusNote")}
                  <input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t("ta.statusNoteHint")}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={officeBusy}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:opacity-60"
                  >
                    {officeBusy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                    {t("ta.save")}
                  </button>
                  {officeMessage && (
                    <span className={`text-xs font-medium ${statusTone(officeMessage.ok)}`}>
                      {officeMessage.text}
                    </span>
                  )}
                </div>
              </form>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <BellRing size={17} className="text-cyan-600 dark:text-cyan-300" />
              {t("ta.announcements")}
            </h2>

            <form onSubmit={submitAnnouncement} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t("ta.course")}
                  <select
                    value={courseId}
                    onChange={(event) => setCourseId(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950"
                  >
                    {courses.length === 0 && <option value="">{t("ta.noCourses")}</option>}
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.code} — {course.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t("ta.kind")}
                  <select
                    value={kind}
                    onChange={(event) => setKind(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950"
                  >
                    {KINDS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.key)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <input
                value={annTitle}
                onChange={(event) => setAnnTitle(event.target.value)}
                placeholder={t("ta.annTitle")}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-950"
              />
              <textarea
                value={annBody}
                onChange={(event) => setAnnBody(event.target.value)}
                rows={3}
                placeholder={t("ta.annBody")}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-950"
              />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={annBuilding}
                  onChange={(event) => setAnnBuilding(event.target.value)}
                  placeholder={t("ta.annBuilding")}
                  className="w-36 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-950"
                />
                <input
                  value={annRoom}
                  onChange={(event) => setAnnRoom(event.target.value)}
                  placeholder={t("ta.annRoom")}
                  className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-950"
                />
                <button
                  type="submit"
                  disabled={annBusy || !courseId}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-cyan-700 dark:hover:bg-cyan-800"
                >
                  {annBusy ? <Loader2 size={15} className="animate-spin" /> : <BellRing size={15} />}
                  {t("ta.post")}
                </button>
              </div>
              {annMessage && (
                <p className={`text-xs font-medium ${statusTone(annMessage.ok)}`}>{annMessage.text}</p>
              )}
            </form>

            <div className="mt-5 max-h-64 space-y-2 overflow-y-auto pr-1">
              {feed.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("ta.emptyAnnouncements")}</p>
              )}
              {feed.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-cyan-700 dark:text-cyan-300">
                      {item.courseCode}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">
                      {item.kind.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{item.body}</p>
                  {item.location && (
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">{item.location}</p>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <MessageSquare size={17} className="text-cyan-600 dark:text-cyan-300" />
              {t("ta.questions")}
            </h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {queue.length}
            </span>
          </div>

          {answerMessage && (
            <p className={`mt-3 text-xs font-medium ${statusTone(answerMessage.ok)}`}>{answerMessage.text}</p>
          )}

          <div className="mt-4 space-y-3">
            {queue.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("ta.emptyQuestions")}</p>
            )}
            {queue.map((thread) => (
              <article
                key={thread.id}
                className="rounded-xl border border-slate-100 p-4 dark:border-slate-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{thread.question}</p>
                    {thread.questionAr && (
                      <p dir="rtl" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {thread.questionAr}
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                    {thread.status.replace("_", " ")}
                  </span>
                </div>
                {thread.peerAnswer && (
                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-950/60 dark:text-slate-300">
                    <span className="font-semibold">{t("ta.peerSaid")}: </span>
                    {thread.peerAnswer}
                  </p>
                )}
                <textarea
                  value={drafts[thread.id] ?? ""}
                  onChange={(event) =>
                    setDrafts((current) => ({ ...current, [thread.id]: event.target.value }))
                  }
                  rows={2}
                  placeholder={t("ta.answerPlaceholder")}
                  className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-950"
                />
                <button
                  type="button"
                  onClick={() => submitAnswer(thread.id)}
                  disabled={answerBusyId === thread.id}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-100 disabled:opacity-60 dark:border-cyan-800/60 dark:bg-cyan-500/10 dark:text-cyan-200"
                >
                  {answerBusyId === thread.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  {t("ta.postAnswer")}
                </button>
              </article>
            ))}
          </div>
        </section>

        <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
          <Clock size={13} /> {t("ta.footer")}
        </p>
      </div>
    </main>
  );
}
