"use client";

import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  BookOpen,
  Bot,
  CalendarDays,
  Database,
  GraduationCap,
  Loader2,
  MapPin,
  Megaphone,
  RefreshCw,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import RoomBadge from "@/components/RoomBadge";

type LiveFieldKey =
  | "name" | "title" | "department" | "location" | "email" | "officeHours"
  | "status" | "program" | "level" | "credits" | "prerequisites" | "description"
  | "date" | "type" | "category" | "expires";

interface LiveField {
  key: LiveFieldKey;
  value: string;
}

interface FusedResult {
  id: string;
  title: string;
  category: string;
  sourceType: string;
  snippet?: string;
  rrf: number;
  fields?: LiveField[];
}

const PREVIEW_LENGTH = 240;

const FIELD_KEY: Record<LiveFieldKey, TranslationKey> = {
  name: "assistant.fieldName",
  title: "assistant.fieldTitle",
  department: "assistant.fieldDepartment",
  location: "assistant.fieldLocation",
  email: "assistant.fieldEmail",
  officeHours: "assistant.fieldOfficeHours",
  status: "assistant.fieldStatus",
  program: "assistant.fieldProgram",
  level: "assistant.fieldLevel",
  credits: "assistant.fieldCredits",
  prerequisites: "assistant.fieldPrerequisites",
  description: "assistant.fieldDescription",
  date: "assistant.fieldDate",
  type: "assistant.fieldType",
  category: "assistant.fieldCategory",
  expires: "assistant.fieldExpires",
};

interface LookupRow {
  [key: string]: unknown;
}

type LookupKind = "schedule" | "office" | "courses";

interface Turn {
  id: string;
  question: string;
  lookup: LookupKind | null;
  results: FusedResult[];
  rows: LookupRow[];
  quota: { used: number; limit: number } | null;
  error: string | null;
}

const SUGGESTIONS: { key: TranslationKey; query: string }[] = [
  { key: "assistant.suggestFaculties", query: "What do FOE, CSIT, FIBH and BAS mean at E-JUST?" },
  { key: "assistant.suggestGpaScale", query: "What is the E-JUST GPA scale?" },
  { key: "assistant.suggestBuildings", query: "How are the campus buildings organized?" },
  { key: "assistant.suggestBus", query: "What is the campus shuttle bus schedule?" },
  { key: "assistant.suggestLibrary", query: "Where is the Central Library?" },
  { key: "assistant.suggestGpa", query: "How is GPA calculated?" },
  { key: "assistant.suggestLab", query: "Which room is the COE computer lab?" },
  { key: "assistant.suggestScholarship", query: "Which scholarships can an Egyptian student apply to?" },
];

const LOOKUPS: { kind: LookupKind; key: TranslationKey; icon: typeof CalendarDays }[] = [
  { kind: "schedule", key: "assistant.lookupSchedule", icon: CalendarDays },
  { kind: "office", key: "assistant.lookupOffice", icon: MapPin },
  { kind: "courses", key: "assistant.lookupCourses", icon: GraduationCap },
];

const SOURCE_BADGE: Record<string, { key: TranslationKey; tone: string; icon: typeof BookOpen }> = {
  static: {
    key: "assistant.sourceHandbook",
    tone: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
    icon: BookOpen,
  },
  handbook: {
    key: "assistant.sourceHandbook",
    tone: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
    icon: BookOpen,
  },
  qa: {
    key: "assistant.sourcePeer",
    tone: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200",
    icon: BadgeCheck,
  },
  "qa:ta": {
    key: "assistant.sourceTa",
    tone: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200",
    icon: BadgeCheck,
  },
  "qa:peer": {
    key: "assistant.sourcePeer",
    tone: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200",
    icon: BadgeCheck,
  },
  scholarship: {
    key: "assistant.sourceLive",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    icon: Database,
  },
  lookup: {
    key: "assistant.sourceLive",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    icon: Database,
  },
  "live-db": {
    key: "assistant.sourceLive",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    icon: Database,
  },
  exam: {
    key: "assistant.sourceExam",
    tone: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
    icon: CalendarDays,
  },
  announcement: {
    key: "assistant.sourceAnnouncement",
    tone: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200",
    icon: Megaphone,
  },
};

function rowsFor(lookup: LookupKind, payload: Record<string, unknown>): LookupRow[] {
  const key = lookup === "schedule" ? "meetings" : lookup === "office" ? "offices" : lookup;
  const value = payload[key];
  return Array.isArray(value) ? (value as LookupRow[]) : [];
}

function rowLocation(row: LookupRow): string | null {
  if (typeof row.location === "string" && row.location.trim()) return row.location;
  const building = typeof row.building === "string" ? row.building.trim() : "";
  const room = typeof row.room === "string" ? row.room.trim() : "";
  return building && room ? `${building} ${room}` : null;
}

export default function AssistantPage() {
  const { t } = useLanguage();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [lookup, setLookup] = useState<LookupKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const turnSeq = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  async function ask(rawQuery: string) {
    const query = rawQuery.trim();
    if (busy) return;
    if (!lookup && query.length < 3) return;

    setBusy(true);
    setInput("");
    turnSeq.current += 1;
    const turnId = `turn-${turnSeq.current}`;
    const turn: Turn = {
      id: turnId,
      question: query || t(LOOKUPS.find((item) => item.kind === lookup)?.key ?? "assistant.lookupSchedule"),
      lookup,
      results: [],
      rows: [],
      quota: null,
      error: null,
    };
    setTurns((current) => [...current, turn]);

    try {
      const params = new URLSearchParams();
      if (lookup) {
        params.set("lookup", lookup);
        if (lookup === "office") params.set("name", query);
        else params.set("code", query);
      } else {
        params.set("q", query);
      }

      const response = await fetch(`/api/knowledge?${params.toString()}`);
      const payload = (await response.json()) as Record<string, unknown>;

      if (response.status === 429) {
        setTurns((current) =>
          current.map((item) =>
            item.id === turnId
              ? { ...item, error: t("assistant.limitReached"), quota: null }
              : item
          )
        );
        return;
      }

      if (!response.ok) throw new Error("failed");

      const nextQuota = (payload.quota as { used: number; limit: number } | null) ?? null;
      if (nextQuota) setQuota(nextQuota);

      const results = Array.isArray(payload.fused) ? (payload.fused as FusedResult[]) : [];
      const rows = lookup
        ? rowsFor(lookup, payload)
        : Array.isArray(payload.meetings)
          ? (payload.meetings as LookupRow[])
          : [];

      setTurns((current) =>
        current.map((item) =>
          item.id === turnId
            ? {
                ...item,
                results,
                rows,
                quota: nextQuota,
                error: !results.length && !rows.length ? t("assistant.noAnswer") : null,
              }
            : item
        )
      );
    } catch {
      setTurns((current) =>
        current.map((item) =>
          item.id === turnId ? { ...item, error: t("assistant.offline"), quota: null } : item
        )
      );
    } finally {
      setBusy(false);
    }
  }

  const remaining = quota ? Math.max(0, quota.limit - quota.used) : null;

  return (
    <main className="min-h-[calc(100vh-3rem)] bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-4xl flex-col px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-300">
              {t("assistant.eyebrow")}
            </p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Bot size={24} className="text-cyan-600 dark:text-cyan-300" />
              {t("assistant.title")}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              {t("assistant.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {remaining !== null && (
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                {t("assistant.remaining")}: <span className="text-cyan-700 dark:text-cyan-300">{remaining}</span>
                {quota ? ` / ${quota.limit}` : ""}
              </span>
            )}
            <button
              type="button"
              onClick={() => setTurns([])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-white dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              <RefreshCw size={13} /> {t("assistant.clear")}
            </button>
          </div>
        </header>

        <div
          ref={scrollRef}
          className="mt-5 min-h-[46vh] flex-1 space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          {turns.length === 0 && (
            <div className="py-8 text-center">
              <Sparkles size={28} className="mx-auto text-cyan-500" />
              <p className="mt-3 text-sm font-semibold">{t("assistant.emptyTitle")}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("assistant.emptyHint")}</p>
              <div className="mx-auto mt-4 grid max-w-xl gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion.query}
                    type="button"
                    onClick={() => ask(suggestion.query)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-left text-xs text-slate-600 transition hover:border-cyan-300 hover:bg-cyan-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-cyan-500/10"
                  >
                    {t(suggestion.key)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((turn) => (
            <div key={turn.id} className="space-y-3">
              <div className="flex items-start justify-end gap-2">
                <p className="max-w-[85%] rounded-2xl rounded-tr-sm bg-cyan-700 px-4 py-2.5 text-sm text-white">
                  {turn.question}
                </p>
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <User size={14} className="text-slate-500" />
                </span>
              </div>

              <div className="flex items-start gap-2">
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-100 dark:bg-cyan-500/15">
                  <Bot size={14} className="text-cyan-700 dark:text-cyan-300" />
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  {turn.error && (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                      {turn.error}
                    </p>
                  )}

                  {turn.results.map((result, index) => {
                    const badge = SOURCE_BADGE[result.sourceType] ?? SOURCE_BADGE.static;
                    const Icon = badge.icon;
                    const cardId = `${turn.id}:${result.id}`;
                    const snippet = result.snippet ?? "";
                    const isLong = snippet.length > PREVIEW_LENGTH;
                    const isOpen = expanded[cardId] ?? false;
                    const shown = isOpen || !isLong ? snippet : `${snippet.slice(0, PREVIEW_LENGTH).trimEnd()}…`;
                    return (
                      <article
                        key={result.id}
                        className={`rounded-xl border px-3 py-2.5 ${
                          index === 0
                            ? "border-cyan-200 bg-cyan-50/70 dark:border-cyan-800/60 dark:bg-cyan-500/5"
                            : "border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/50"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{result.title}</p>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.tone}`}>
                            <Icon size={11} /> {t(badge.key)}
                          </span>
                        </div>
                        {snippet && (
                          <p className="mt-1.5 text-xs leading-5 text-slate-600 dark:text-slate-300">{shown}</p>
                        )}
                        {result.fields && result.fields.length > 0 && (
                          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                            {result.fields.map((field, fieldIndex) => (
                              <div key={`${field.key}-${fieldIndex}`} className="flex min-w-0 gap-1">
                                <dt className="font-semibold text-slate-500 dark:text-slate-400">{t(FIELD_KEY[field.key])}:</dt>
                                <dd className="min-w-0 break-words">
                                  {field.key === "status" && (field.value === "yes" || field.value === "no")
                                    ? t(field.value === "yes" ? "assistant.fieldYes" : "assistant.fieldNo")
                                    : field.key === "location"
                                      ? <RoomBadge location={field.value} />
                                      : field.value}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        )}
                        {isLong && (
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            onClick={() => setExpanded((current) => ({ ...current, [cardId]: !isOpen }))}
                            className="mt-1.5 text-[11px] font-semibold text-cyan-700 underline-offset-2 transition hover:underline dark:text-cyan-300"
                          >
                            {isOpen ? t("assistant.showLess") : t("assistant.showMore")}
                          </button>
                        )}
                      </article>
                    );
                  })}

                  {turn.rows.map((row, index) => {
                    const location = rowLocation(row);
                    return (
                      <article
                        key={`row-${index}`}
                        className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 dark:border-emerald-800/50 dark:bg-emerald-500/5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">
                            {String(row.courseCode ?? row.code ?? row.title ?? row.name ?? t("assistant.rowFallback"))}
                          </p>
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                            <Database size={11} /> {t("assistant.sourceLive")}
                          </span>
                        </div>
                        {location && (
                          <div className="mt-1.5"><RoomBadge location={location} /></div>
                        )}
                        <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                          {Object.entries(row)
                            .filter(([key, value]) => key !== "id" && !(location && ["location", "building", "room"].includes(key)) && (typeof value === "string" || typeof value === "number" || typeof value === "boolean"))
                            .slice(0, 6)
                            .map(([key, value]) => (
                              <div key={key} className="flex min-w-0 gap-1">
                                <dt className="shrink-0 font-semibold text-slate-500 dark:text-slate-400">{key}:</dt>
                                <dd className="min-w-0 break-words">{String(value)}</dd>
                              </div>
                            ))}
                        </dl>
                      </article>
                    );
                  })}

                  {turn.quota && (
                    <p className="text-[10px] text-slate-400">
                      {t("assistant.quotaNote")} {Math.max(0, turn.quota.limit - turn.quota.used)} / {turn.quota.limit}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Loader2 size={14} className="animate-spin" /> {t("assistant.thinking")}
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {LOOKUPS.map(({ kind, key, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              onClick={() => setLookup((current) => (current === kind ? null : kind))}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                lookup === kind
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                  : "border-slate-200 text-slate-600 hover:bg-white dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
              }`}
            >
              <Icon size={13} /> {t(key)}
            </button>
          ))}
          {lookup && (
            <span className="self-center text-[11px] text-slate-500 dark:text-slate-400">
              {t("assistant.lookupHint")}
            </span>
          )}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            ask(input);
          }}
          className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={lookup ? t("assistant.lookupPlaceholder") : t("assistant.placeholder")}
            className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {t("assistant.send")}
          </button>
        </form>
      </div>
    </main>
  );
}
