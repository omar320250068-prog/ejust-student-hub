"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, User, Info, RefreshCw } from "lucide-react";

interface Citation {
  id: string;
  title: string;
  category: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
  confidence?: "high" | "medium" | "low" | "none";
  error?: boolean;
}

const SUGGESTIONS = [
  "Where is the Central Library?",
  "How is GPA calculated?",
  "What cafeteria food is cheap?",
  "Which scholarships can an Egyptian student apply to?",
  "How do I get to the Center of Excellence?",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setReady(true);
      setMessages([
        {
          id: "intro",
          role: "assistant",
          text: [
            "Hi — I'm the campus assistant. I answer only from this app's own knowledge base (campus places, GPA scale, timetable, exams, cafeteria, scholarships).",
            "",
            "Ask a question or tap a suggestion below. I'll always show which entries I used.",
          ].join("\n"),
          confidence: "high",
        },
      ]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || busy) return;

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", text: trimmed },
    ]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = (await res.json()) as {
        reply?: string;
        confidence?: Message["confidence"];
        citations?: Citation[];
        error?: string;
      };

      if (!res.ok || data.error) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: data.reply ?? "",
          citations: data.citations,
          confidence: data.confidence,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          text:
            err instanceof Error
              ? `I couldn't reach the search service: ${err.message}`
              : "Something went wrong.",
          error: true,
        },
      ]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function reset() {
    setMessages((prev) => prev.slice(0, 1));
    setInput("");
    inputRef.current?.focus();
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-3rem)] max-w-3xl flex-col px-4 py-6 print:hidden">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Bot size={20} className="text-blue-600" />
            Campus Assistant
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Retrieval-augmented search over this app&apos;s own data — answers cite their sources.
          </p>
        </div>
        {messages.length > 1 && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900"
          >
            <RefreshCw size={13} />
            Reset
          </button>
        )}
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
        <Info size={13} className="mt-0.5 shrink-0" />
        <p>
          Runs fully offline with a local BM25 retriever — no API key and no external model. It
          quotes the knowledge base rather than paraphrasing, and says so when it doesn&apos;t know.
        </p>
      </div>

      <div
        ref={scrollRef}
        className="mt-3 flex-1 space-y-3 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4"
      >
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && (
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  m.error ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                }`}
              >
                <Bot size={13} />
              </span>
            )}
            <div className={`max-w-[85%] ${m.role === "user" ? "order-first" : ""}`}>
              <div
                className={`whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-blue-600 text-white"
                    : m.error
                      ? "bg-red-50 text-red-700"
                      : "bg-gray-50 text-gray-800"
                }`}
              >
                {m.text}
              </div>

              {m.citations && m.citations.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <span className="flex items-center gap-1 text-[10px] font-medium text-gray-400">
                    <Sparkles size={10} />
                    {m.confidence} confidence · sources
                  </span>
                  {m.citations.map((c) => (
                    <span
                      key={c.id}
                      className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700"
                      title={c.id}
                    >
                      {c.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {m.role === "user" && (
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                <User size={13} />
              </span>
            )}
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Bot size={13} />
            </span>
            Searching the knowledge base…
          </div>
        )}
      </div>

      {ready && messages.length <= 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex items-center gap-2"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about campus, GPA, exams, food, or scholarships…"
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
        <button
          type="submit"
          disabled={busy || input.trim().length === 0}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          <Send size={15} />
          Send
        </button>
      </form>
    </main>
  );
}
