"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, MapPin, GraduationCap, CalendarDays, Award, AlarmClock, UtensilsCrossed, LayoutDashboard, Bot, LogIn, LogOut, User, FileText, MessageCircleQuestion, ShieldCheck, Presentation } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";
import LanguageSelector from "./LanguageSelector";
import { useLanguage } from "@/lib/i18n";

const LINKS = [
  { href: "/today", key: "today" as const, icon: LayoutDashboard },
  { href: "/", key: "plan" as const, icon: Map },
  { href: "/map", key: "map" as const, icon: MapPin },
  { href: "/gpa", key: "gpa" as const, icon: GraduationCap },
  { href: "/timetable", key: "timetable" as const, icon: CalendarDays },
  { href: "/exams", key: "exams" as const, icon: AlarmClock },
  { href: "/cafeteria", key: "cafeteria" as const, icon: UtensilsCrossed },
  { href: "/scholarships", key: "scholarships" as const, icon: Award },
  { href: "/qa", key: "qa" as const, icon: MessageCircleQuestion, requiresAuth: true },
  { href: "/assistant", key: "assistant" as const, icon: Bot },
  { href: "/contribute", key: "contribute" as const, icon: FileText },
];

const TA_LINK = { href: "/ta", key: "ta" as const, icon: Presentation };
const ADMIN_LINK = { href: "/admin", key: "admin" as const, icon: ShieldCheck };

export default function TopNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { t } = useLanguage();

  const isStaff =
    session?.user?.role === "ADMIN" || session?.user?.taStatus === "APPROVED";
  const isAdmin = session?.user?.role === "ADMIN";
  const isAuthenticated = status === "authenticated";
  const links = [
    ...LINKS.filter((link) => !("requiresAuth" in link) || isAuthenticated),
    ...(isStaff ? [TA_LINK] : []),
    ...(isAdmin ? [ADMIN_LINK] : []),
  ];

  return (
    <header className="relative z-20 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur-md print:hidden dark:border-slate-800 dark:bg-slate-950/85">
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-bold text-gray-900 dark:text-white">EJUST Student Hub</span>
        <span className="hidden text-xs text-gray-400 dark:text-slate-500 lg:inline">
          Egypt-Japan University of Science &amp; Technology
        </span>
      </div>
      <nav className="flex gap-1 overflow-x-auto">
        {links.map(({ href, key, icon: Icon }) => {
          const label = t(`nav.${key}`);
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-blue-50 text-blue-700 dark:bg-cyan-400/10 dark:text-cyan-300"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="flex shrink-0 items-center gap-2">
        <LanguageSelector />
        <ThemeToggle />
        {status === "loading" && (
          <div className="h-7 w-7 animate-pulse rounded-full bg-gray-200" />
        )}
        {status === "unauthenticated" && (
          <Link
            href="/login"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <LogIn size={15} />
            {t("nav.signIn")}
          </Link>
        )}
        {status === "authenticated" && session?.user && (
          <div className="flex items-center gap-2">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || "User"}
                className="h-7 w-7 rounded-full"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100">
                <User size={16} className="text-gray-600" />
              </div>
            )}
            <span className="hidden max-w-[120px] truncate text-sm text-gray-700 dark:text-slate-200 md:inline">
              {session.user.name}
            </span>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <LogOut size={15} />
              {t("nav.signOut")}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
