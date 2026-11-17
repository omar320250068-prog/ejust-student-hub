"use client";

import { useEffect, useState } from "react";
import {
  Award,
  BadgeCheck,
  Check,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Search,
  ShieldOff,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { MeritTier } from "@/lib/merit";
import {
  restoreAutoApprove,
  reviewTaApplication,
  revokeAutoApprove,
  searchStudents,
  setStudentTierOverride,
  type StudentRow,
} from "./tier-actions";

export type TaApplicationRow = {
  id: string;
  name: string;
  email: string;
  note: string | null;
  points: number;
  tier: MeritTier;
  appliedAt: string;
};

export type QaQueueRow = {
  id: string;
  question: string;
  questionAr: string | null;
  peerAnswer: string | null;
  taAnswer: string | null;
  status: string;
  createdAt: string;
};

const TIERS: MeritTier[] = [
  "EXPLORER",
  "PEER_HELPER",
  "CAMPUS_AMBASSADOR",
  "EJUST_MENTOR",
];

const panelClass =
  "rounded-2xl border border-slate-800/90 bg-[#0b132b]/80 p-5";
const inputClass =
  "rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-200 outline-none placeholder:text-slate-500 focus:border-cyan-700";

export default function TierPanels({
  taApplications,
  qaQueue,
  notify,
}: {
  taApplications: TaApplicationRow[];
  qaQueue: QaQueueRow[];
  notify: (kind: "ok" | "err", text: string) => void;
}) {
  const [taList, setTaList] = useState(taApplications);
  const [qaList, setQaList] = useState(qaQueue);
  const [busy, setBusy] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [tierDraft, setTierDraft] = useState<Record<string, MeritTier>>({});

  useEffect(() => {
    let cancelled = false;
    void searchStudents("").then((rows) => {
      if (!cancelled) setStudents(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function runSearch(event: React.FormEvent) {
    event.preventDefault();
    setSearching(true);
    try {
      const rows = await searchStudents(query);
      setStudents(rows);
    } finally {
      setSearching(false);
    }
  }

  async function decideTa(id: string, decision: "APPROVED" | "REJECTED") {
    setBusy(`ta-${id}`);
    try {
      const result = await reviewTaApplication(id, decision);
      if (!result.ok) {
        notify("err", result.error);
      } else {
        setTaList((current) => current.filter((row) => row.id !== id));
        notify("ok", result.message);
      }
    } catch {
      notify("err", "Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  async function decideQa(id: string, action: "verify" | "reject") {
    setBusy(`qa-${id}`);
    try {
      const response = await fetch(`/api/admin/qa/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        notify("err", payload.error ?? "Could not update the thread.");
      } else {
        setQaList((current) => current.filter((row) => row.id !== id));
        notify(
          "ok",
          action === "verify"
            ? "Verified and promoted into the retrieval corpus."
            : "Answer rejected and removed from the queue."
        );
      }
    } catch {
      notify("err", "Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  async function pinTier(row: StudentRow) {
    const tier = tierDraft[row.id] ?? row.tier;
    setBusy(`student-${row.id}`);
    try {
      const result = await setStudentTierOverride(row.id, tier);
      if (!result.ok) {
        notify("err", result.error);
      } else {
        setStudents((current) =>
          current.map((item) => (item.id === row.id ? { ...item, override: tier } : item))
        );
        notify("ok", result.message);
      }
    } finally {
      setBusy(null);
    }
  }

  async function clearTier(row: StudentRow) {
    setBusy(`student-${row.id}`);
    try {
      const result = await setStudentTierOverride(row.id, null);
      if (!result.ok) {
        notify("err", result.error);
      } else {
        setStudents((current) =>
          current.map((item) => (item.id === row.id ? { ...item, override: null } : item))
        );
        notify("ok", result.message);
      }
    } finally {
      setBusy(null);
    }
  }

  async function toggleAutoApprove(row: StudentRow) {
    setBusy(`student-${row.id}`);
    try {
      const result = row.autoApproveRevoked
        ? await restoreAutoApprove(row.id)
        : await revokeAutoApprove(row.id);
      if (!result.ok) {
        notify("err", result.error);
      } else {
        setStudents((current) =>
          current.map((item) =>
            item.id === row.id ? { ...item, autoApproveRevoked: !item.autoApproveRevoked } : item
          )
        );
        notify("ok", result.message);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">TA Applications Queue</h2>
          </div>
          <span className="rounded-lg border border-amber-800/50 bg-amber-950/60 px-2 py-0.5 text-[10px] font-bold text-amber-300">
            {taList.length} PENDING
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {taList.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-xs text-slate-500">
              No TA applications waiting. Everything is reviewed.
            </p>
          )}
          {taList.map((row) => {
            const rowBusy = busy === `ta-${row.id}`;
            return (
              <article
                key={row.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-100">{row.name}</p>
                    <p className="text-[10px] text-slate-400">{row.email}</p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="rounded border border-cyan-800/50 bg-cyan-950/80 px-1.5 py-0.5 font-bold text-cyan-300">
                      {row.points} pts · {row.tier.replace(/_/g, " ")}
                    </span>
                    <span>{new Date(row.appliedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                {row.note && (
                  <p className="mt-2 rounded-lg bg-slate-950/70 px-2.5 py-1.5 text-[11px] text-slate-300">
                    {row.note}
                  </p>
                )}
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={rowBusy}
                    onClick={() => decideTa(row.id, "APPROVED")}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-700/50 bg-emerald-950/80 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-900 disabled:opacity-40"
                  >
                    {rowBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Approve as TA
                  </button>
                  <button
                    type="button"
                    disabled={rowBusy}
                    onClick={() => decideTa(row.id, "REJECTED")}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-700/50 bg-rose-950/80 px-2.5 py-1 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-900 disabled:opacity-40"
                  >
                    <X className="h-3 w-3" /> Reject
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">Q&amp;A Verification Queue</h2>
          </div>
          <span className="rounded-lg border border-cyan-800/50 bg-cyan-950/60 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
            {qaList.length} AWAITING VERIFICATION
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {qaList.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-xs text-slate-500">
              No answered threads waiting for verification.
            </p>
          )}
          {qaList.map((row) => {
            const rowBusy = busy === `qa-${row.id}`;
            return (
              <article
                key={row.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="max-w-2xl text-xs font-semibold text-slate-100">{row.question}</p>
                  <span className="rounded border border-violet-800/50 bg-violet-950/60 px-1.5 py-0.5 text-[10px] font-bold text-violet-300">
                    {row.status.replace(/_/g, " ")}
                  </span>
                </div>
                {row.questionAr && (
                  <p dir="rtl" className="mt-1 text-[11px] text-slate-400">
                    {row.questionAr}
                  </p>
                )}
                {(row.taAnswer || row.peerAnswer) && (
                  <p className="mt-2 rounded-lg bg-slate-950/70 px-2.5 py-1.5 text-[11px] leading-5 text-slate-300">
                    {row.taAnswer ?? row.peerAnswer}
                  </p>
                )}
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={rowBusy}
                    onClick={() => decideQa(row.id, "verify")}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-700/50 bg-emerald-950/80 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-900 disabled:opacity-40"
                  >
                    {rowBusy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    Verify &amp; Promote to RAG
                  </button>
                  <button
                    type="button"
                    disabled={rowBusy}
                    onClick={() => decideQa(row.id, "reject")}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-700/50 bg-rose-950/80 px-2.5 py-1 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-900 disabled:opacity-40"
                  >
                    <X className="h-3 w-3" /> Reject
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">Student Merit &amp; Overrides</h2>
          </div>
          <form onSubmit={runSearch} className="flex items-center gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name or email…"
                className="w-44 bg-transparent text-xs text-slate-200 placeholder:text-slate-500 outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={searching}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
            >
              {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Search"}
            </button>
          </form>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2 font-semibold">Student</th>
                <th className="px-3 py-2 text-center font-semibold">Points</th>
                <th className="px-3 py-2 font-semibold">Tier</th>
                <th className="px-3 py-2 font-semibold">Pin override</th>
                <th className="px-3 py-2 text-right font-semibold">Auto-approve</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {students.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                    No students match this search.
                  </td>
                </tr>
              )}
              {students.map((row) => {
                const rowBusy = busy === `student-${row.id}`;
                return (
                  <tr key={row.id} className="align-middle">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-100">{row.name ?? "Unnamed"}</div>
                      <div className="text-[10px] text-slate-400">{row.email ?? "—"}</div>
                      <div className="mt-0.5 text-[10px] text-slate-500">
                        {row.role}
                        {row.taStatus !== "NONE" ? ` · TA ${row.taStatus}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="rounded border border-cyan-800/50 bg-cyan-950/80 px-1.5 py-0.5 text-[11px] font-bold text-cyan-300">
                        {row.points}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-semibold text-slate-200">
                          {row.tier.replace(/_/g, " ")}
                        </span>
                        {row.override && (
                          <span className="inline-flex w-fit items-center gap-1 rounded border border-amber-800/50 bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                            <Award className="h-2.5 w-2.5" /> PINNED
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <select
                          value={tierDraft[row.id] ?? row.tier}
                          onChange={(event) =>
                            setTierDraft((current) => ({
                              ...current,
                              [row.id]: event.target.value as MeritTier,
                            }))
                          }
                          className={inputClass}
                        >
                          {TIERS.map((tier) => (
                            <option key={tier} value={tier}>
                              {tier.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={rowBusy}
                          onClick={() => pinTier(row)}
                          className="rounded-lg border border-cyan-800/50 bg-cyan-950/70 px-2 py-1 text-[10px] font-semibold text-cyan-300 transition hover:bg-cyan-900/70 disabled:opacity-40"
                        >
                          {rowBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Pin"}
                        </button>
                        {row.override && (
                          <button
                            type="button"
                            disabled={rowBusy}
                            onClick={() => clearTier(row)}
                            className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-300 transition hover:bg-slate-700 disabled:opacity-40"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        disabled={rowBusy}
                        onClick={() => toggleAutoApprove(row)}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition disabled:opacity-40 ${
                          row.autoApproveRevoked
                            ? "border-emerald-700/50 bg-emerald-950/70 text-emerald-300 hover:bg-emerald-900/70"
                            : "border-rose-700/50 bg-rose-950/70 text-rose-300 hover:bg-rose-900/70"
                        }`}
                      >
                        {row.autoApproveRevoked ? (
                          <>
                            <ShieldCheck className="h-3 w-3" /> Restore
                          </>
                        ) : (
                          <>
                            <ShieldOff className="h-3 w-3" /> Revoke
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[10px] text-slate-500">
          Auto-approve only affects E-JUST Mentors: revoking it sends their FAQ and schedule
          updates back through manual review.
        </p>
      </section>
    </div>
  );
}
