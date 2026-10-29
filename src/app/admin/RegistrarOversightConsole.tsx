"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Award,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  Eye,
  FileText,
  Loader2,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { ScanVerdict } from "@/lib/contribution-scan";
import { reviewSubmission } from "./actions";

export type AdminSubmission = {
  id: string;
  studentName: string;
  studentEmail: string;
  category: string;
  title: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  meritPoints: number;
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
  verdict: ScanVerdict;
};

export type AdminMetrics = {
  totalStudents: number;
  pending: number;
  approved: number;
  meritAwarded: number;
};

const NAV = [
  { href: "/dashboard", label: "Portal Home" },
  { href: "/services/notes", label: "Notes Library" },
  { href: "/services/past-papers", label: "Past Papers" },
  { href: "/services/gpa", label: "GPA Planner" },
  { href: "/contribute", label: "Contribute" },
];

const PAGE_SIZE = 5;

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function RegistrarOversightConsole({
  submissions,
  metrics,
  adminName,
  generatedAt,
}: {
  submissions: AdminSubmission[];
  metrics: AdminMetrics;
  adminName: string;
  generatedAt: string;
}) {
  const [items, setItems] = useState(submissions);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const pendingCount = items.filter((item) => item.status === "pending").length;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      `${item.title} ${item.studentName} ${item.studentEmail} ${item.category} ${item.fileName}`
        .toLowerCase()
        .includes(needle),
    );
  }, [items, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  async function decide(id: string, decision: "approved" | "rejected") {
    setBusyId(id);
    setToast(null);

    try {
      const result = await reviewSubmission(id, decision);

      if (!result.ok) {
        setToast({ kind: "err", text: result.error });
        return;
      }

      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, status: decision } : item)),
      );
      setToast({
        kind: "ok",
        text:
          decision === "approved"
            ? `Approved — ${result.awarded} merit points credited.`
            : "Submission rejected.",
      });
    } catch {
      setToast({ kind: "err", text: "Could not reach the server. Try again." });
    } finally {
      setBusyId(null);
    }
  }

  const kpis = [
    { label: "Total Students", value: metrics.totalStudents, icon: Users, tone: "text-cyan-400" },
    { label: "Pending Approvals", value: pendingCount, icon: Clock, tone: "text-amber-400" },
    { label: "Approved All-Time", value: metrics.approved, icon: CheckCircle2, tone: "text-emerald-400" },
    { label: "Merit Awarded", value: metrics.meritAwarded, icon: Award, tone: "text-violet-400" },
  ];

  return (
    <div className="min-h-screen bg-[#050a18]">
      <header className="border-b border-slate-800/80 bg-[#070e22]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-950 border border-cyan-800/60">
              <ShieldCheck className="h-4 w-4 text-cyan-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Registrar Oversight Console</div>
              <div className="text-[11px] text-slate-400">EJUST Student Hub · signed in as {adminName}</div>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-1.5">
            {NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:border-cyan-800 hover:text-cyan-300"
              >
                {link.label}
              </Link>
            ))}
            <span className="rounded-lg border border-cyan-800/60 bg-cyan-950/70 px-2.5 py-1.5 text-[11px] font-bold text-cyan-300">
              ADMIN
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map(({ label, value, icon: Icon, tone }) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-800/90 bg-[#0b132b]/80 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {label}
                </span>
                <Icon className={`h-4 w-4 ${tone}`} />
              </div>
              <div className="mt-2 text-2xl font-bold text-white">{value}</div>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0b132b]/80">
          <div className="flex flex-col gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Submission Review Queue</h2>
              <p className="text-[11px] text-slate-400">
                Approving credits merit points to the contributor&apos;s profile.
              </p>
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-slate-500" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search student, title, file…"
                className="w-48 bg-transparent text-xs text-slate-200 placeholder:text-slate-500 outline-none"
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-[#070e22]/80 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Student</th>
                  <th className="px-4 py-2.5 font-semibold">Submission</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Merit</th>
                  <th className="px-4 py-2.5 font-semibold">Pre-Scan</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Oversight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      No submissions match this view.
                    </td>
                  </tr>
                )}

                {visible.map((sub) => {
                  const busy = busyId === sub.id;
                  const reviewed = sub.status !== "pending";
                  const expanded = expandedId === sub.id;

                  return (
                    <Fragment key={sub.id}>
                      <tr className="align-top">
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-100">{sub.studentName}</div>
                          <div className="text-[10px] text-slate-400">{sub.studentEmail}</div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-slate-500" />
                            <span className="font-semibold text-slate-200">{sub.title}</span>
                            {reviewed && (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                  sub.status === "approved"
                                    ? "bg-emerald-950/80 text-emerald-300"
                                    : "bg-rose-950/80 text-rose-300"
                                }`}
                              >
                                {sub.status.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                            {sub.fileName} · {formatBytes(sub.fileSize)} · {sub.category}
                          </div>
                          <div className="text-[10px] text-slate-500">{timeAgo(sub.submittedAt)}</div>
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center rounded border border-cyan-800/50 bg-cyan-950/80 px-2 py-0.5 text-[11px] font-bold text-cyan-300">
                            +{sub.meritPoints} pts
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            {sub.verdict.status === "clean" ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                            )}
                            <span
                              className={`text-[11px] font-semibold ${
                                sub.verdict.status === "clean" ? "text-emerald-400" : "text-amber-400"
                              }`}
                            >
                              {sub.verdict.scoreText}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400">{sub.verdict.details}</div>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              type="button"
                              title="Inspect / Preview"
                              onClick={() => setExpandedId(expanded ? null : sub.id)}
                              className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300 transition hover:bg-slate-700"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Approve & Publish"
                              disabled={busy || reviewed}
                              onClick={() => decide(sub.id, "approved")}
                              className="rounded-lg border border-emerald-700/50 bg-emerald-950/80 p-1.5 text-emerald-300 transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {busy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              title="Reject & Flag"
                              disabled={busy || reviewed}
                              onClick={() => decide(sub.id, "rejected")}
                              className="rounded-lg border border-rose-700/50 bg-rose-950/80 p-1.5 text-rose-300 transition hover:bg-rose-900 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {expanded && (
                        <tr className="bg-[#070e22]/60">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="grid gap-2 text-[11px] text-slate-300 sm:grid-cols-2">
                              <div>
                                <span className="text-slate-500">Record ID: </span>
                                <span className="font-mono">{sub.id}</span>
                              </div>
                              <div>
                                <span className="text-slate-500">Submitted: </span>
                                {new Date(sub.submittedAt).toLocaleString()}
                              </div>
                              <div>
                                <span className="text-slate-500">File: </span>
                                <span className="font-mono">
                                  {sub.fileName} ({sub.fileType})
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500">Category: </span>
                                {sub.category}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-800 bg-[#070e22]/90 p-4 text-xs text-slate-400 sm:flex-row">
            <div>
              Showing{" "}
              <span className="font-semibold text-white">
                {visible.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
                {(safePage - 1) * PAGE_SIZE + visible.length}
              </span>{" "}
              of <span className="font-semibold text-white">{filtered.length}</span> submissions ·{" "}
              {pendingCount} awaiting decision
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={safePage === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 font-medium text-slate-300">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage === totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-800/90 bg-[#0b132b]/80 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">System Telemetry</h3>
            </div>
            <span className="flex items-center space-x-1 text-[11px] font-mono font-semibold text-emerald-400">
              <span className="mr-1 h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              LIVE FROM DATABASE
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: "POSTGRES", status: "Connected", detail: "Neon serverless", value: "us-east-2" },
              { name: "STUDENTS", status: `${metrics.totalStudents} registered`, detail: "Role STUDENT", value: "user" },
              { name: "PENDING", status: `${pendingCount} in queue`, detail: "Status pending", value: "contribution" },
              { name: "SNAPSHOT", status: "Rendered", detail: new Date(generatedAt).toLocaleTimeString(), value: "server" },
            ].map((node) => (
              <div key={node.name} className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider text-slate-200">{node.name}</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </div>
                <div className="text-xs font-semibold text-emerald-400">{node.status}</div>
                <div className="text-[10px] text-slate-400">{node.detail}</div>
                <div className="flex justify-between border-t border-slate-800/60 pt-1.5 text-[10px] text-slate-500">
                  <span>table</span>
                  <span className="font-mono text-slate-400">{node.value}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border px-4 py-2 text-xs font-semibold shadow-lg ${
            toast.kind === "ok"
              ? "border-emerald-700/60 bg-emerald-950 text-emerald-200"
              : "border-rose-700/60 bg-rose-950 text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.kind === "ok" ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            {toast.text}
            <button type="button" onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
