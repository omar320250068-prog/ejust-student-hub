"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Award, Bookmark, BookmarkCheck, Check, ExternalLink } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { CampusLifeShell, SearchBar } from "@/components/ExperienceShells";
import { SCHOLARSHIPS, daysUntil, formatDeadline, type Level } from "@/data/scholarships";
import { readSavedScholarships, writeSavedScholarships } from "@/lib/student-data";

const LEVELS: Level[] = ["Bachelor", "Master", "PhD"];

export default function ScholarshipsPage() {
  const { t } = useLanguage();
  const { data: session, status } = useSession();
  const studentUser = status === "authenticated" ? session?.user : null;
  const userScope = studentUser?.id ?? studentUser?.email ?? null;
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<Level | "all">("all");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => { const timer = window.setTimeout(() => { setMounted(true); try { setSaved(new Set(readSavedScholarships(window.localStorage, studentUser))); } catch { /* use empty set */ } }, 0); return () => window.clearTimeout(timer); }, [studentUser, userScope]);
  useEffect(() => { if (mounted) writeSavedScholarships(window.localStorage, studentUser, [...saved]); }, [mounted, saved, studentUser, userScope]);
  const results = useMemo(() => { const needle = query.trim().toLowerCase(); return SCHOLARSHIPS.filter((item) => (!needle || `${item.name} ${item.provider} ${item.country} ${item.fields}`.toLowerCase().includes(needle)) && (level === "all" || item.levels.includes(level))).toSorted((a, b) => a.deadline.localeCompare(b.deadline)); }, [level, query]);
  const toggle = (id: string) => setSaved((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return <CampusLifeShell title={t("scholarships.title")} description={t("scholarships.subtitle")}>
    <div className="rounded-3xl border border-white/20 bg-slate-950/45 p-4 backdrop-blur-xl sm:p-5">
      <div className="flex flex-col gap-3 md:flex-row"><SearchBar value={query} onChange={setQuery} placeholder={t("scholarships.search")} /><div className="flex gap-2 overflow-x-auto">{(["all", ...LEVELS] as const).map((item) => <button key={item} onClick={() => setLevel(item)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold ${level === item ? "bg-cyan-300 text-slate-950" : "bg-white/10 text-slate-300 hover:bg-white/15"}`}>{item === "all" ? t("scholarships.all") : item === "Bachelor" ? t("scholarships.undergraduate") : item === "Master" ? t("scholarships.exchange") : t("scholarships.research")}</button>)}</div></div>
      <p className="mt-4 text-xs text-slate-400">{saved.size} {t("scholarships.saved")}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">{results.map((item) => { const days = mounted ? daysUntil(item.deadline) : null; const isSaved = saved.has(item.id); return <article key={item.id} className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-300/50 hover:bg-white/10"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-cyan-200">{item.provider}</p><h2 className="mt-1 text-lg font-semibold">{item.name}</h2><p className="mt-1 text-xs text-slate-400">{item.country} · {item.fields}</p></div><button onClick={() => toggle(item.id)} className={`rounded-lg p-2 ${isSaved ? "bg-cyan-300 text-slate-950" : "bg-white/10 text-slate-400 hover:text-white"}`} aria-label={isSaved ? "Remove saved scholarship" : "Save scholarship"}>{isSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}</button></div><div className="mt-4 flex flex-wrap gap-2">{item.levels.map((itemLevel) => <span key={itemLevel} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-slate-300">{itemLevel}</span>)}<span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] text-emerald-200">{item.funding}</span></div><div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4"><div><p className="text-[11px] text-slate-400">{t("scholarships.deadline")}</p><p className={`mt-1 text-sm font-semibold ${days !== null && days <= 45 ? "text-amber-200" : "text-white"}`}>{formatDeadline(item.deadline)}</p></div><div><p className="text-[11px] text-slate-400">{t("scholarships.eligibility")}</p><p className="mt-1 flex items-center gap-1 text-sm font-semibold text-slate-200"><Check size={14} className="text-emerald-300" />{item.eligibility.length} checks</p></div></div><div className="mt-4 flex items-center justify-between"><a href={item.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-200 hover:text-white">{t("scholarships.apply")}<ExternalLink size={13} /></a><span className="inline-flex items-center gap-1 text-xs text-slate-400"><Award size={13} />{item.fundingDetails}</span></div></article>; })}</div>
      {!results.length && <p className="py-12 text-center text-sm text-slate-400">No scholarships match this search.</p>}
    </div>
  </CampusLifeShell>;
}
