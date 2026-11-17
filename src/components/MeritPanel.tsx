"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Award,
  CheckCircle2,
  GraduationCap,
  Loader2,
  MessageSquare,
  Sparkles,
  Zap,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

interface MeritResponse {
  viewer: {
    name: string | null;
    role: "STUDENT" | "ADMIN" | "TA";
    taStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
    points: number;
    tier: "EXPLORER" | "PEER_HELPER" | "CAMPUS_AMBASSADOR" | "EJUST_MENTOR";
    effectiveTier: "EXPLORER" | "PEER_HELPER" | "CAMPUS_AMBASSADOR" | "EJUST_MENTOR";
    override: string | null;
    isStaff: boolean;
    isApprovedTa: boolean;
    autoApproveRevoked: boolean;
  };
  tiers: { tier: string; min: number; max: number | null; label: string; labelAr: string; perks: string }[];
  next: { tier: string; label: string; labelAr: string; min: number; pointsAway: number } | null;
  progress: number;
  history: { id: string; delta: number; reason: string; createdAt: string }[];
  quota: { used: number; limit: number; remaining: number };
  qa: { activeThreads: number };
}

const TIER_STYLE: Record<string, string> = {
  EXPLORER: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  PEER_HELPER: "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200",
  CAMPUS_AMBASSADOR: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200",
  EJUST_MENTOR: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
};

const TIER_KEY = {
  EXPLORER: "merit.tierExplorer",
  PEER_HELPER: "merit.tierPeerHelper",
  CAMPUS_AMBASSADOR: "merit.tierCampusAmbassador",
  EJUST_MENTOR: "merit.tierEjustMentor",
} as const;

const TIER_PERKS = {
  EXPLORER: "merit.perksExplorer",
  PEER_HELPER: "merit.perksPeerHelper",
  CAMPUS_AMBASSADOR: "merit.perksCampusAmbassador",
  EJUST_MENTOR: "merit.perksEjustMentor",
} as const;

type MeritTierName = keyof typeof TIER_KEY;

export default function MeritPanel({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  const [data, setData] = useState<MeritResponse | null>(null);
  const [error, setError] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/merit")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("failed"))))
      .then((payload: MeritResponse) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function applyForTa() {
    setApplying(true);
    setNotice(null);
    try {
      const response = await fetch("/api/ta/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "failed");
      setData((current) => (current ? { ...current, viewer: { ...current.viewer, taStatus: "PENDING" } } : current));
      setShowForm(false);
      setNote("");
      setNotice(t("merit.applySuccess"));
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : t("merit.applyFailed"));
    } finally {
      setApplying(false);
    }
  }

  if (error) {
    return (
      <section className={`rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 ${className}`}>
        {t("merit.signIn")}{" "}
        <Link href="/login" className="font-semibold text-cyan-700 hover:underline dark:text-cyan-300">
          {t("nav.signIn")}
        </Link>
      </section>
    );
  }

  if (!data) {
    return (
      <section className={`flex min-h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${className}`}>
        <Loader2 size={18} className="animate-spin text-cyan-600 dark:text-cyan-300" />
      </section>
    );
  }

  const { viewer, next, progress, quota, qa } = data;
  const tierName = viewer.tier as MeritTierName;
  const canApply = viewer.role === "STUDENT" && (viewer.taStatus === "NONE" || viewer.taStatus === "REJECTED");

  return (
    <section className={`rounded-2xl border border-white/20 bg-slate-950/40 p-5 shadow-xl backdrop-blur-md ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">{t("merit.title")}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-semibold text-white">{viewer.points}</span>
            <span className="text-sm text-slate-300">{t("merit.points")}</span>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${TIER_STYLE[viewer.tier]}`}>
          {t(TIER_KEY[tierName])}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>{next ? t("merit.next") : t("merit.maxed")}</span>
          {next && <span className="font-semibold text-cyan-200">{next.pointsAway} {t("merit.toGo")}</span>}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 transition-all"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        {next && (
          <p className="mt-2 text-xs text-slate-400">
            {t("merit.nextTier")}: <span className="font-semibold text-slate-200">{t(TIER_KEY[next.tier as MeritTierName])}</span>
          </p>
        )}
      </div>

      <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs leading-5 text-slate-300">
        <Sparkles size={13} className="mr-1 inline text-amber-300" />
        {t(TIER_PERKS[tierName])}
      </p>

      {viewer.override && (
        <p className="mt-2 text-[11px] font-semibold text-amber-200">
          {t("merit.override")}: {viewer.override}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <p className="text-slate-400">{t("merit.quota")}</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {quota.remaining}
            <span className="text-xs font-normal text-slate-400"> / {quota.limit}</span>
          </p>
        </div>
        <Link
          href="/qa"
          className="group rounded-xl border border-white/10 bg-white/5 px-3 py-2 transition hover:border-cyan-300/50 hover:bg-white/10"
        >
          <p className="text-slate-400">{t("merit.qa")}</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {qa.activeThreads}
            <ArrowUpRight size={14} className="ml-1 inline text-cyan-200 transition group-hover:-translate-y-0.5" />
          </p>
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {viewer.isStaff && (
          <Link
            href="/ta"
            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-400"
          >
            <GraduationCap size={14} /> {t("merit.taPortal")}
          </Link>
        )}
        {!viewer.isStaff && viewer.taStatus === "PENDING" && (
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/40 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200">
            <Loader2 size={13} className="animate-spin" /> {t("merit.applyPending")}
          </span>
        )}
        {!viewer.isStaff && viewer.taStatus === "APPROVED" && (
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200">
            <CheckCircle2 size={13} /> {t("merit.applyApproved")}
          </span>
        )}
        {canApply && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            <Award size={14} /> {t("merit.applyTa")}
          </button>
        )}
        <Link
          href="/contribute"
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
        >
          <Zap size={14} /> {t("merit.contribute")}
        </Link>
      </div>

      {canApply && showForm && (
        <div className="mt-3 rounded-xl border border-white/15 bg-white/5 p-3">
          <p className="text-xs text-slate-300">{t("merit.applyHint")}</p>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder={t("merit.applyNote")}
            className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={applyForTa}
              disabled={applying}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-900 transition hover:bg-cyan-100 disabled:opacity-60"
            >
              {applying ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              {t("merit.applySubmit")}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
            >
              {t("timetable.cancel")}
            </button>
          </div>
        </div>
      )}

      {notice && <p className="mt-2 text-xs font-semibold text-cyan-200">{notice}</p>}

      {data.history.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-white/10 pt-3 text-xs">
          {data.history.slice(0, 4).map((event) => (
            <li key={event.id} className="flex items-center justify-between gap-2 text-slate-300">
              <span className="flex items-center gap-1.5">
                <MessageSquare size={12} className="text-cyan-200" />
                {event.reason.replace(/([A-Z])/g, " $1").toLowerCase()}
              </span>
              <span className={event.delta >= 0 ? "font-semibold text-emerald-300" : "font-semibold text-rose-300"}>
                {event.delta >= 0 ? "+" : ""}
                {event.delta}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
