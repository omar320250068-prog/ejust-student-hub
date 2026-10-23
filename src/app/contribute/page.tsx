"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { PlusCircle, Send, Loader2, Clock, CheckCircle, XCircle } from "lucide-react";

const CATEGORIES = [
  { value: "academic-calendar", label: "Academic Calendar" },
  { value: "exam-schedule", label: "Exam Schedule" },
  { value: "scholarships", label: "Scholarships" },
  { value: "courses", label: "Course Catalog" },
  { value: "faculty", label: "Faculty Info" },
  { value: "campus-locations", label: "Campus Locations/POIs" },
  { value: "announcements", label: "Announcements" },
  { value: "other", label: "Other / General" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

type Submission = {
  id: string;
  category: string;
  title: string;
  data: any;
  status: "pending" | "approved" | "rejected";
  notes: string | null;
  createdAt: string;
};

export default function ContributePage() {
  const { data: session, status } = useSession();
  const [category, setCategory] = useState<Category>("academic-calendar");
  const [title, setTitle] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [rawJson, setRawJson] = useState("");
  const [useRaw, setUseRaw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }
    fetch("/api/contributions")
      .then((r) => r.json())
      .then((j) => setSubs(j.contributions || []))
      .finally(() => setLoading(false));
  }, [status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== "authenticated") return signIn("google");

    setSubmitting(true);
    setMsg(null);

    try {
      let data: any = {};

      if (useRaw) {
        try {
          data = JSON.parse(rawJson || "{}");
        } catch {
          setMsg("Invalid JSON in raw data field");
          setSubmitting(false);
          return;
        }
      } else {
        data = { ...form };
      }

      const res = await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, title, data }),
      });

      if (!res.ok) throw new Error("Failed");

      setTitle("");
      setForm({});
      setRawJson("");
      setMsg("Submitted successfully. It will be reviewed for inclusion.");
      const r = await fetch("/api/contributions");
      const j = await r.json();
      setSubs(j.contributions || []);
    } catch {
      setMsg("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderFields = () => {
    switch (category) {
      case "academic-calendar":
        return (
          <div className="grid gap-3 md:grid-cols-2">
            <input className="input" placeholder="Semester (e.g. Fall 2026)" value={form.semester || ""} onChange={(e) => setForm({ ...form, semester: e.target.value })} />
            <input className="input" placeholder="Event Name" value={form.event || ""} onChange={(e) => setForm({ ...form, event: e.target.value })} />
            <input type="date" className="input" value={form.startDate || ""} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <input type="date" className="input" value={form.endDate || ""} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            <textarea className="input md:col-span-2" rows={3} placeholder="Notes/Details" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        );
      case "exam-schedule":
        return (
          <div className="grid gap-3 md:grid-cols-2">
            <input className="input" placeholder="Course Code" value={form.courseCode || ""} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} />
            <input className="input" placeholder="Course Title" value={form.courseTitle || ""} onChange={(e) => setForm({ ...form, courseTitle: e.target.value })} />
            <input type="date" className="input" value={form.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <input className="input" placeholder="Time (e.g. 09:00 - 12:00)" value={form.time || ""} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            <input className="input md:col-span-2" placeholder="Location/Hall" value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
        );
      case "scholarships":
        return (
          <div className="grid gap-3 md:grid-cols-2">
            <input className="input" placeholder="Scholarship Name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Provider/Source" value={form.provider || ""} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
            <input className="input" placeholder="Deadline (YYYY-MM-DD)" value={form.deadline || ""} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            <input className="input" placeholder="Eligibility" value={form.eligibility || ""} onChange={(e) => setForm({ ...form, eligibility: e.target.value })} />
            <textarea className="input md:col-span-2" rows={4} placeholder="Description & How to Apply (link if available)" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        );
      case "courses":
        return (
          <div className="grid gap-3 md:grid-cols-2">
            <input className="input" placeholder="Course Code" value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <input className="input" placeholder="Course Title" value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input className="input" placeholder="Department" value={form.department || ""} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            <input className="input" placeholder="Credits (e.g. 3)" value={form.credits || ""} onChange={(e) => setForm({ ...form, credits: e.target.value })} />
            <textarea className="input md:col-span-2" rows={3} placeholder="Syllabus/Notes" value={form.syllabus || ""} onChange={(e) => setForm({ ...form, syllabus: e.target.value })} />
          </div>
        );
      case "faculty":
        return (
          <div className="grid gap-3 md:grid-cols-2">
            <input className="input" placeholder="Full Name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Title/Position" value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input className="input" placeholder="Department/School" value={form.department || ""} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            <input className="input" placeholder="Email (if known)" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <textarea className="input md:col-span-2" rows={3} placeholder="Research/Office/Other Info" value={form.info || ""} onChange={(e) => setForm({ ...form, info: e.target.value })} />
          </div>
        );
      case "campus-locations":
        return (
          <div className="grid gap-3 md:grid-cols-2">
            <input className="input" placeholder="Location Name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Type (Building/Lab/Cafe/Office)" value={form.type || ""} onChange={(e) => setForm({ ...form, type: e.target.value })} />
            <input className="input" placeholder="Building/Number" value={form.building || ""} onChange={(e) => setForm({ ...form, building: e.target.value })} />
            <input className="input" placeholder="Floor/Room" value={form.room || ""} onChange={(e) => setForm({ ...form, room: e.target.value })} />
            <textarea className="input md:col-span-2" rows={3} placeholder="Description/How to find it" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        );
      case "announcements":
        return (
          <div className="grid gap-3">
            <input className="input" placeholder="Announcement Title" value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input className="input" placeholder="Source/Date (YYYY-MM-DD)" value={form.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <textarea className="input" rows={4} placeholder="Announcement Content" value={form.content || ""} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </div>
        );
      default:
        return (
          <textarea className="input" rows={4} placeholder="Any relevant details" value={form.details || ""} onChange={(e) => setForm({ ...form, details: e.target.value })} />
        );
    }
  };

  const statusIcon = (s: string) => {
    if (s === "approved") return <CheckCircle size={16} className="text-green-600" />;
    if (s === "rejected") return <XCircle size={16} className="text-red-600" />;
    return <Clock size={16} className="text-amber-500" />;
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-center gap-2">
        <PlusCircle className="h-6 w-6 text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">Contribute Data</h1>
      </div>
      <p className="mb-6 text-sm text-gray-600">
        Help improve the EJUST Student Hub by submitting accurate information. Your submissions will be reviewed and used to expand official data.
      </p>

      {status !== "authenticated" ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
          <p className="mb-3 text-sm text-gray-600">Sign in with Google to submit data.</p>
          <button onClick={() => signIn("google")} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Sign in with Google
          </button>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
                <select className="input" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Submission Title</label>
                <input className="input" required placeholder="e.g. Fall 2026 Exam Schedule" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
            </div>

            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Data</label>
                <button type="button" onClick={() => setUseRaw(!useRaw)} className="text-xs text-blue-600 hover:underline">
                  {useRaw ? "Use form fields" : "Use raw JSON"}
                </button>
              </div>
              {useRaw ? <textarea className="input" rows={8} placeholder='{"key": "value"}' value={rawJson} onChange={(e) => setRawJson(e.target.value)} /> : renderFields()}
            </div>

            <button disabled={submitting} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Submit
            </button>
            {msg && <p className="mt-2 text-sm text-gray-600">{msg}</p>}
          </form>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-gray-900">My Submissions</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {loading ? (
                <div className="flex items-center justify-center py-6 text-sm text-gray-500"><Loader2 size={16} className="mr-2 animate-spin" /> Loading...</div>
              ) : subs.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-500">No submissions yet.</div>
              ) : (
                subs.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{s.title}</p>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{s.category}</span>
                      </div>
                      <p className="text-xs text-gray-500">{new Date(s.createdAt).toLocaleString()}</p>
                      {s.notes && <p className="mt-1 text-xs text-gray-600">Note: {s.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs capitalize text-gray-600">
                      {statusIcon(s.status)}
                      {s.status}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      <style jsx global>{`
        .input {
          @apply w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500;
        }
      `}</style>
    </main>
  );
}
