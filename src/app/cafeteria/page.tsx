"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Check, Info, Plus, Send, Trash2, UtensilsCrossed, Wallet } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { CampusLifeShell } from "@/components/ExperienceShells";
import { DAYS, PERIODS, formatEgp, itemById, menuFor, type DayName } from "@/data/cafeteria";
import {
  readCafeteria,
  readCafeteriaFeedback,
  writeCafeteria,
  writeCafeteriaFeedback,
} from "@/lib/student-data";

type Trays = Partial<Record<DayName, string[]>>;
interface FeedbackEntry { text: string; at: string }

export default function CafeteriaPage() {
  const { t } = useLanguage();
  const { data: session, status } = useSession();
  const studentUser = status === "authenticated" ? session?.user : null;
  const userScope = studentUser?.id ?? studentUser?.email ?? null;
  const [trays, setTrays] = useState<Trays>({});
  const [budget, setBudget] = useState(120);
  const [day, setDay] = useState<DayName | null>(null);
  const [mounted, setMounted] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>([]);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = DAYS[new Date().getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6];
      setDay(current); setMounted(true);
      try {
        const saved = readCafeteria(window.localStorage, studentUser);
        if (saved) {
          setTrays(saved.trays);
          setBudget(saved.budget);
        }
        setFeedbackList(
          readCafeteriaFeedback(window.localStorage, studentUser).flatMap((entry) =>
            typeof entry.at === "string" && typeof entry.text === "string"
              ? [{ text: entry.text, at: entry.at }]
              : [],
          ),
        );
      } catch { /* use defaults */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [studentUser, userScope]);

  useEffect(() => {
    if (mounted) writeCafeteria(window.localStorage, studentUser, { trays, budget });
  }, [budget, mounted, trays, studentUser, userScope]);

  useEffect(() => {
    if (mounted) writeCafeteriaFeedback(window.localStorage, studentUser, feedbackList);
  }, [feedbackList, mounted, studentUser, userScope]);

  function submitFeedback() {
    const text = feedback.trim();
    if (!text) return;
    setFeedbackList((previous) => [{ text, at: new Date().toISOString() }, ...previous].slice(0, 20));
    setFeedback("");
    setSent(true);
  }

  const activeItems = day ? trays[day] ?? [] : [];
  const trayItems = activeItems.map(itemById).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const total = trayItems.reduce((sum, item) => sum + item.price, 0);
  const crowd = day === "Friday" ? "low" : day === "Monday" ? "high" : "medium";

  function toggle(id: string) {
    if (!day) return;
    setTrays((previous) => ({ ...previous, [day]: activeItems.includes(id) ? activeItems.filter((item) => item !== id) : [...activeItems, id] }));
  }

  return (
    <CampusLifeShell title={t("cafeteria.title")} description={t("cafeteria.subtitle")}>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="rounded-3xl border border-white/20 bg-slate-950/45 p-4 shadow-2xl backdrop-blur-xl sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="flex items-center gap-2 text-lg font-semibold"><UtensilsCrossed size={18} className="text-cyan-300" />{t("cafeteria.menu")}</h2><p className="mt-1 text-xs text-slate-300">{t("cafeteria.opening")}: 07:30–20:00 · {t(crowd === "low" ? "cafeteria.low" : crowd === "high" ? "cafeteria.high" : "cafeteria.medium")}</p></div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${crowd === "low" ? "bg-emerald-400/20 text-emerald-200" : crowd === "high" ? "bg-rose-400/20 text-rose-200" : "bg-amber-400/20 text-amber-200"}`}>{t("cafeteria.crowd")}: {t(`cafeteria.${crowd}`)}</span>
          </div>
          <div className="mt-5 flex gap-1 overflow-x-auto border-b border-white/10 pb-3">{DAYS.map((item) => <button key={item} onClick={() => setDay(item)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition ${day === item ? "bg-cyan-300 text-slate-950" : "text-slate-300 hover:bg-white/10"}`}>{item.slice(0, 3)}</button>)}</div>
          {day && <div className="mt-4 space-y-3">{PERIODS.map((period) => <div key={period} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5"><div className="flex justify-between border-b border-white/10 px-4 py-3"><h3 className="text-sm font-semibold">{period}</h3><span className="text-xs text-slate-400">{menuFor(day)[period].length} {t("cafeteria.options")}</span></div>{menuFor(day)[period].map((item) => { const picked = activeItems.includes(item.id); return <div key={item.id} className="flex items-center gap-3 border-b border-white/5 px-4 py-3 last:border-0"><div className="min-w-0 flex-1"><p className="truncate text-sm">{item.name}</p><div className="mt-1 flex gap-1">{item.tags.map((tag) => <span key={tag} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">{tag}</span>)}</div></div><span className="text-sm font-semibold text-cyan-200">{formatEgp(item.price)}</span><button onClick={() => toggle(item.id)} className={`flex h-8 w-8 items-center justify-center rounded-full border ${picked ? "border-emerald-300 bg-emerald-400 text-slate-950" : "border-white/20 text-slate-300 hover:border-cyan-300"}`}>{picked ? <Check size={14} /> : <Plus size={14} />}</button></div>; })}</div>)}</div>}
        </section>
        <aside className="space-y-4">
          <section className="rounded-3xl border border-white/20 bg-slate-950/55 p-5 backdrop-blur-xl"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold"><Wallet size={16} className="text-cyan-300" />{t("cafeteria.tray")}</h2>{trayItems.length > 0 && <button onClick={() => day && setTrays((previous) => ({ ...previous, [day]: [] }))} className="text-xs text-slate-400 hover:text-white"><Trash2 size={13} /></button>}</div><div className="mt-4 space-y-2">{trayItems.length ? trayItems.map((item) => <div key={item.id} className="flex justify-between text-xs text-slate-300"><span>{item.name}</span><span>{formatEgp(item.price)}</span></div>) : <p className="text-sm text-slate-400">Choose items from the live menu.</p>}</div><div className="mt-4 flex justify-between border-t border-white/10 pt-4 text-sm font-semibold"><span>Total</span><span className="text-cyan-200">{formatEgp(total)}</span></div><label className="mt-4 block text-xs text-slate-400">Daily budget<input type="number" value={budget} onChange={(event) => setBudget(Math.max(0, Number(event.target.value) || 0))} className="mt-1 w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300" /></label></section>
          <section className="rounded-3xl border border-white/20 bg-slate-950/55 p-5 backdrop-blur-xl">
            <h2 className="text-sm font-semibold">{t("cafeteria.feedback")}</h2>
            <textarea value={feedback} onChange={(event) => { setFeedback(event.target.value); setSent(false); }} placeholder={t("cafeteria.feedbackPlaceholder")} className="mt-3 min-h-24 w-full resize-none rounded-xl border border-white/15 bg-white/10 p-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300" />
            <button onClick={submitFeedback} disabled={!feedback.trim()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50"><Send size={14} />{t("cafeteria.submit")}</button>
            {sent && (
              <p role="status" className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-3 text-xs text-emerald-100">
                <Check size={14} className="mt-0.5 shrink-0" />
                {t("cafeteria.sent")}
              </p>
            )}
            {feedbackList[0] && (
              <p className="mt-3 line-clamp-3 break-words text-[11px] leading-5 text-slate-400">
                {new Date(feedbackList[0].at).toLocaleDateString()}: {feedbackList[0].text}
              </p>
            )}
          </section>
          <p className="flex gap-2 text-xs leading-5 text-slate-300"><Info size={14} className="mt-0.5 shrink-0 text-cyan-300" />Menu and crowd indicators are campus planning estimates and may change during service.</p>
        </aside>
      </div>
    </CampusLifeShell>
  );
}
