"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import CampusBackground from "@/components/CampusBackground";
import { useLanguage } from "@/lib/i18n";

export function CampusLifeShell({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <main className="relative min-h-[calc(100vh-3rem)] overflow-hidden bg-slate-950/70 text-white">
      <CampusBackground image="/images/campus/night-campus.jpg.png" />
      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-7 max-w-2xl">
          <p className="text-sm font-medium text-cyan-200">E-JUST campus life</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-3 text-base leading-7 text-slate-200">{description}</p>
        </motion.div>
        {children}
      </div>
    </main>
  );
}

export function StudyShell({
  children,
  title,
  description,
  icon,
  action,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <main className="min-h-[calc(100vh-3rem)] bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link href="/today" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-300"><ArrowLeft size={14} />{t("services.back")}</Link>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-start gap-3">
            {icon && <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300">{icon}</span>}
            <div><p className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">Focus mode</p><h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p></div>
          </div>
          {action}
        </div>
        {children}
      </div>
    </main>
  );
}

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="relative block min-w-0 flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pl-9 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-cyan-950" /></label>;
}
