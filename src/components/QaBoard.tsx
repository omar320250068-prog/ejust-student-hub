"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

interface QaThread {
  id: string;
  userId: string | null;
  status: "OPEN" | "ESCALATED" | "ASSIGNED" | "PEER_ANSWERED" | "TA_ANSWERED" | "VERIFIED" | "REJECTED";
  question: string;
  questionAr: string | null;
  ragAnswer: string | null;
  peerAnswer: string | null;
  taAnswer: string | null;
  createdAt: string;
}

interface QaViewer {
  tier: string;
  points: number;
  isStaff: boolean;
  taStatus: string;
  privileges: { peerAnswer: boolean };
}

const STATUS_TONE: Record<string, string> = {
  OPEN: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  ESCALATED: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
  ASSIGNED: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200",
  PEER_ANSWERED: "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200",
  TA_ANSWERED: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200",
  VERIFIED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
  REJECTED: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200",
};

type Translate = ReturnType<typeof useLanguage>["t"];

const STATUS_KEY: Record<QaThread["status"], string> = {
  OPEN: "qa.statusOpen",
  ESCALATED: "qa.statusEscalated",
  ASSIGNED: "qa.statusAssigned",
  PEER_ANSWERED: "qa.statusPeerAnswered",
  TA_ANSWERED: "qa.statusTaAnswered",
  VERIFIED: "qa.statusVerified",
  REJECTED: "qa.statusRejected",
};

function statusLabel(status: QaThread["status"], t: Translate) {
  return t(STATUS_KEY[status] as Parameters<Translate>[0]);
}

export default function QaBoard() {
  const { t } = useLanguage();
  const [threads, setThreads] = useState<QaThread[]>([]);
  const [viewer, setViewer] = useState<QaViewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  const [question, setQuestion] = useState("");
  const [questionAr, setQuestionAr] = useState("");
  const [asking, setAsking] = useState(false);
  const [askMessage, setAskMessage] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [answerBusyId, setAnswerBusyId] = useState<string | null>(null);
  const [answerMessage, setAnswerMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/qa")
      .then(async (response) => {
        if (response.status === 401) {
          if (!cancelled) setUnauthorized(true);
          return;
        }
        if (!response.ok) throw new Error("failed");
        const payload = (await response.json()) as { viewer: QaViewer; threads: QaThread[] };
        if (cancelled) return;
        setViewer(payload.viewer);
        setThreads(payload.threads);
        setUnauthorized(false);
      })
      .catch(() => {
        if (!cancelled) setAskMessage(t("qa.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    if (question.trim().length < 10) {
      setAskMessage(t("qa.tooShort"));
      return;
    }
    setAsking(true);
    setAskMessage(null);
    try {
      const response = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), questionAr: questionAr.trim() || undefined }),
      });
      const payload = (await response.json()) as { error?: string; thread?: QaThread };
      if (response.status === 429) {
        setAskMessage(t("qa.quota"));
        return;
      }
      if (!response.ok || !payload.thread) throw new Error(payload.error ?? "failed");
      setThreads((current) => [payload.thread as QaThread, ...current]);
      setQuestion("");
      setQuestionAr("");
      setAskMessage(t("qa.asked"));
    } catch {
      setAskMessage(t("qa.askFailed"));
    } finally {
      setAsking(false);
    }
  }

  async function answer(thread: QaThread) {
    const body = (drafts[thread.id] ?? "").trim();
    if (body.length < 10) {
      setAnswerMessage({ ok: false, text: t("qa.tooShort") });
      return;
    }
    const kind = viewer?.isStaff ? "ta" : "peer";
    setAnswerBusyId(thread.id);
    setAnswerMessage(null);
    try {
      const response = await fetch(`/api/qa/${thread.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, kind }),
      });
      const payload = (await response.json()) as { error?: string; thread?: QaThread };
      if (!response.ok || !payload.thread) throw new Error(payload.error ?? "failed");
      setThreads((current) => current.map((item) => (item.id === thread.id ? (payload.thread as QaThread) : item)));
      setDrafts((current) => ({ ...current, [thread.id]: "" }));
      setAnswerMessage({ ok: true, text: t("qa.answerSent") });
    } catch (cause) {
      setAnswerMessage({
        ok: false,
        text: cause instanceof Error && cause.message ? cause.message : t("qa.answerFailed"),
      });
    } finally {
      setAnswerBusyId(null);
    }
  }

  if (unauthorized) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-300">{t("qa.locked")}</p>
        <Link
          href="/login"
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
        >
          {t("nav.signIn")}
        </Link>
      </div>
    );
  }

  const canPeer = Boolean(viewer?.privileges.peerAnswer);
  const canAnswer = canPeer || Boolean(viewer?.isStaff);

  return (
    <div className="space-y-4">
      <form
        onSubmit={ask}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <MessageSquare size={17} className="text-cyan-600 dark:text-cyan-300" />
          {t("qa.ask")}
        </h2>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={3}
          placeholder={t("qa.questionPlaceholder")}
          className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-950"
        />
        <input
          value={questionAr}
          onChange={(event) => setQuestionAr(event.target.value)}
          dir="rtl"
          placeholder={t("qa.questionAr")}
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-950"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={asking}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:opacity-60"
          >
            {asking ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {t("qa.post")}
          </button>
          {askMessage && <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{askMessage}</span>}
        </div>
      </form>

      {answerMessage && (
        <p className={`text-xs font-semibold ${answerMessage.ok ? "text-emerald-600" : "text-rose-600"}`}>
          {answerMessage.text}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={20} className="animate-spin text-cyan-600 dark:text-cyan-300" />
        </div>
      ) : threads.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {t("qa.empty")}
        </p>
      ) : (
        <div className="space-y-3">
          {threads.map((thread) => {
            const answerKind = viewer?.isStaff ? "ta" : "peer";
            const alreadyAnswered =
              answerKind === "ta" ? Boolean(thread.taAnswer) : Boolean(thread.peerAnswer || thread.taAnswer);
            const closed = thread.status === "VERIFIED" || thread.status === "REJECTED";

            return (
              <article
                key={thread.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="max-w-2xl">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{thread.question}</p>
                    {thread.questionAr && (
                      <p dir="rtl" className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {thread.questionAr}
                      </p>
                    )}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${STATUS_TONE[thread.status]}`}>
                    {statusLabel(thread.status, t)}
                  </span>
                </div>

                {thread.ragAnswer && !thread.peerAnswer && !thread.taAnswer && (
                  <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 dark:bg-slate-950/60 dark:text-slate-300">
                    <Sparkles size={12} className="mr-1 inline text-cyan-500" />
                    <span className="font-semibold">{t("qa.assistantDraft")}: </span>
                    {thread.ragAnswer}
                  </p>
                )}

                {thread.peerAnswer && (
                  <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 dark:border-cyan-800/60 dark:bg-cyan-500/10">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-cyan-800 dark:text-cyan-200">
                      <BadgeCheck size={13} /> {t("qa.peerAnswer")}
                    </p>
                    <p className="mt-1 text-sm text-cyan-950 dark:text-cyan-50">{thread.peerAnswer}</p>
                  </div>
                )}

                {thread.taAnswer && (
                  <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 dark:border-violet-800/60 dark:bg-violet-500/10">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-violet-800 dark:text-violet-200">
                      <ShieldCheck size={13} /> {t("qa.taAnswer")}
                    </p>
                    <p className="mt-1 text-sm text-violet-950 dark:text-violet-50">{thread.taAnswer}</p>
                  </div>
                )}

                {!closed && canAnswer && !alreadyAnswered && (
                  <div className="mt-3">
                    <textarea
                      value={drafts[thread.id] ?? ""}
                      onChange={(event) =>
                        setDrafts((current) => ({ ...current, [thread.id]: event.target.value }))
                      }
                      rows={2}
                      placeholder={viewer?.isStaff ? t("qa.taPlaceholder") : t("qa.peerPlaceholder")}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-950"
                    />
                    <button
                      type="button"
                      onClick={() => answer(thread)}
                      disabled={answerBusyId === thread.id}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {answerBusyId === thread.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={13} />
                      )}
                      {viewer?.isStaff ? t("qa.postTa") : t("qa.postPeer")}
                    </button>
                  </div>
                )}

                {!closed && !alreadyAnswered && !canAnswer && (
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t("qa.needsTier")}</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
