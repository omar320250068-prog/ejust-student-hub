"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { FileUp, Loader2, Send, Sparkles } from "lucide-react";
import { MotionSection, ServicePageShell } from "@/components/ServicePageShell";

export default function ContributePage() {
  const { status } = useSession();
  const [category, setCategory] = useState("Lecture notes");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function acceptFile(nextFile: File | undefined) {
    if (!nextFile) return;
    if (nextFile.size > 10 * 1024 * 1024) {
      setMessage("Please choose a file smaller than 10 MB.");
      return;
    }
    setFile(nextFile);
    setMessage(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (status !== "authenticated") {
      await signIn("google");
      return;
    }
    if (!title.trim() || !file) {
      setMessage("Add a title and choose a file before submitting.");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: category.toLowerCase().replaceAll(" ", "-"), title: title.trim(), data: { fileName: file.name, size: file.size, type: file.type } }),
      });
      if (!response.ok) throw new Error("Submission failed");
      setTitle("");
      setFile(null);
      setMessage("Submitted for review. Your 25 merit points are pending approval.");
    } catch {
      setMessage("We could not submit that resource. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ServicePageShell eyebrow="Community contributions" title="Share what made the semester easier." description="Upload a useful note, exam archive, or campus update. Every approved contribution helps the next student and earns merit points.">
      <MotionSection className="mt-8 grid gap-4 lg:grid-cols-[1fr_0.75fr]" delay={0.14}>
        <form onSubmit={submit} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 sm:col-span-2">Resource title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. CSE201 final revision pack" className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">Category<select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-400"><option>Lecture notes</option><option>Past papers</option><option>Courseware</option><option>Campus update</option></select></label>
          </div>
          <label onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files[0]); }} className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-10 text-center transition ${dragging ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50 hover:border-blue-300"}`}>
            <FileUp size={24} className="text-blue-600" />
            <span className="mt-3 text-sm font-semibold text-gray-800">{file ? file.name : "Drop a file here or browse"}</span>
            <span className="mt-1 text-xs text-gray-500">PDF, DOCX, PPTX or image · max 10 MB</span>
            <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg" onChange={(event) => acceptFile(event.target.files?.[0])} className="sr-only" />
          </label>
          <button type="submit" disabled={submitting} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}{submitting ? "Sending…" : "Submit for review"}</button>
          {message && <p role="status" className="mt-3 text-sm text-gray-600">{message}</p>}
        </form>
        <aside className="rounded-2xl bg-blue-950 p-6 text-white">
          <Sparkles size={20} className="text-blue-300" />
          <h2 className="mt-5 text-xl font-semibold">Your contribution balance</h2>
          <p className="mt-2 text-sm leading-6 text-blue-100/70">Approved resources earn points that show your impact across the student hub.</p>
          <p className="mt-8 text-5xl font-bold">180</p>
          <p className="mt-1 text-sm text-blue-200">merit points</p>
          <div className="mt-7 border-t border-white/10 pt-4 text-xs text-blue-100/70"><p>+25 points per approved upload</p><p className="mt-2">Reviews usually take 1–2 days</p></div>
        </aside>
      </MotionSection>
    </ServicePageShell>
  );
}
