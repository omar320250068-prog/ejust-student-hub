"use client";

import Link from "next/link";
import { ArrowRight, Compass, GraduationCap, ShieldCheck, Users } from "lucide-react";
import CampusBackground from "@/components/CampusBackground";
import { useLanguage } from "@/lib/i18n";

const FEATURES = [
  { icon: Compass, title: "landing.featurePlan", body: "landing.featurePlanDesc" },
  { icon: GraduationCap, title: "landing.featureStudy", body: "landing.featureStudyDesc" },
  { icon: Users, title: "landing.featureCommunity", body: "landing.featureCommunityDesc" },
] as const;

/** Guest-facing showcase. Signed-in visitors get the full Master Plan instead. */
export default function PublicLanding() {
  const { t } = useLanguage();

  return (
    <main className="relative flex min-h-[calc(100vh-3rem)] items-center overflow-hidden bg-slate-950 text-white">
      <CampusBackground image="/images/campus/main-gate.jpg.png" />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-950/70 to-cyan-950/70" />
      <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 lg:py-20">
        <section className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-100">
            <ShieldCheck size={14} className="text-cyan-300" />
            {t("landing.eyebrow")}
          </span>
          <h1 className="mt-6 text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            {t("landing.title")}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-200 sm:text-lg">
            {t("landing.subtitle")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/40 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-100"
            >
              {t("landing.signIn")}
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/signup"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-200"
            >
              {t("landing.createAccount")}
            </Link>
          </div>
          <p className="mt-5 flex items-start gap-2 text-sm text-slate-300">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-cyan-300" />
            <span>{t("landing.accountHint")}</span>
          </p>
        </section>

        <section className="grid min-w-0 gap-3" aria-label={t("landing.trusted")}>
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="flex min-w-0 items-start gap-4 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-300 text-slate-950">
                <Icon size={20} />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold text-white">{t(title)}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-300">{t(body)}</p>
              </div>
            </article>
          ))}
          <p className="mt-1 text-xs uppercase tracking-wider text-cyan-200/80">
            {t("landing.trusted")}
          </p>
        </section>
      </div>
    </main>
  );
}
