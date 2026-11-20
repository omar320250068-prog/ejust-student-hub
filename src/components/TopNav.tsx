"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, MapPin, GraduationCap, CalendarDays, Award, AlarmClock, UtensilsCrossed, LayoutDashboard, Bot, LogIn, LogOut, User, FileText, MessageCircleQuestion, ShieldCheck, Presentation, MoreHorizontal } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";
import LanguageSelector from "./LanguageSelector";
import { useLanguage } from "@/lib/i18n";

const PRIMARY_LINKS = [
  { href: "/today", key: "today" as const, icon: LayoutDashboard },
  { href: "/", key: "plan" as const, icon: Map },
  { href: "/map", key: "map" as const, icon: MapPin },
  { href: "/gpa", key: "gpa" as const, icon: GraduationCap },
  { href: "/timetable", key: "timetable" as const, icon: CalendarDays },
  { href: "/exams", key: "exams" as const, icon: AlarmClock },
  { href: "/assistant", key: "assistant" as const, icon: Bot },
];

const SECONDARY_LINKS = [
  { href: "/cafeteria", key: "cafeteria" as const, icon: UtensilsCrossed },
  { href: "/scholarships", key: "scholarships" as const, icon: Award },
  { href: "/qa", key: "qa" as const, icon: MessageCircleQuestion, requiresAuth: true },
  { href: "/contribute", key: "contribute" as const, icon: FileText },
];

const TA_LINK = { href: "/ta", key: "ta" as const, icon: Presentation };
const ADMIN_LINK = { href: "/admin", key: "admin" as const, icon: ShieldCheck };

function navLinkClass(active: boolean) {
  return `flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-[13px] font-medium transition lg:px-2.5 lg:text-sm ${
    active
      ? "bg-blue-50 text-blue-700 dark:bg-cyan-400/10 dark:text-cyan-300"
      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
  }`;
}

export default function TopNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { t } = useLanguage();
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null);
  const moreOpen = openMenuPath === pathname;
  const moreRef = useRef<HTMLDivElement>(null);

  const isStaff =
    session?.user?.role === "ADMIN" || session?.user?.taStatus === "APPROVED";
  const isAdmin = session?.user?.role === "ADMIN";
  const isAuthenticated = status === "authenticated";
  const secondaryLinks = [
    ...SECONDARY_LINKS.filter(
      (link) => !("requiresAuth" in link) || isAuthenticated,
    ),
    ...(isStaff ? [TA_LINK] : []),
    ...(isAdmin ? [ADMIN_LINK] : []),
  ];
  const moreActive = secondaryLinks.some((link) => pathname === link.href);

  useEffect(() => {
    if (!moreOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (!moreRef.current?.contains(event.target as Node)) setOpenMenuPath(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenMenuPath(null);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  return (
    <header className="relative z-20 flex shrink-0 flex-wrap items-center border-b border-gray-200 bg-white/90 px-4 backdrop-blur-md print:hidden dark:border-slate-800 dark:bg-slate-950/85 sm:h-12 sm:flex-nowrap sm:gap-3">
      <div className="order-1 flex h-12 shrink-0 items-center gap-2 sm:order-none sm:h-auto">
        <span className="text-sm font-bold text-gray-900 dark:text-white">
          <span className="sm:hidden">EJUST</span>
          <span className="hidden sm:inline">EJUST Student Hub</span>
        </span>
        <span className="hidden text-xs text-gray-400 dark:text-slate-500 xl:inline">
          Egypt-Japan University of Science &amp; Technology
        </span>
      </div>

      <div className="order-3 flex w-full min-w-0 items-center border-t border-gray-200 dark:border-slate-800 sm:order-none sm:w-auto sm:flex-1 sm:border-0">
        <nav
          aria-label={t("nav.menu")}
          className="scrollbar-none flex min-w-0 flex-1 gap-1 overflow-x-auto py-1.5 sm:py-0"
        >
          {PRIMARY_LINKS.map(({ href, key, icon: Icon }) => {
            const label = t(`nav.${key}`);
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className={navLinkClass(active)}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div ref={moreRef} className="relative shrink-0 py-1.5 sm:py-0">
          <button
            type="button"
            aria-label={t("nav.more")}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            aria-controls={moreOpen ? "top-nav-more" : undefined}
            onClick={() => setOpenMenuPath((current) => (current === pathname ? null : pathname))}
            className={navLinkClass(moreActive)}
          >
            <MoreHorizontal size={15} />
            {t("nav.more")}
          </button>
          {moreOpen && (
            <div
              id="top-nav-more"
              role="menu"
              className="absolute end-0 top-full z-40 mt-1 w-52 rounded-xl border border-gray-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            >
              {secondaryLinks.map(({ href, key, icon: Icon }) => {
                const label = t(`nav.${key}`);
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    role="menuitem"
                    aria-label={label}
                    onClick={() => setOpenMenuPath(null)}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-blue-50 text-blue-700 dark:bg-cyan-400/10 dark:text-cyan-300"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                    }`}
                  >
                    <Icon size={15} />
                    {label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="order-2 ml-auto flex h-12 shrink-0 items-center gap-2 sm:order-none sm:ml-0 sm:h-auto">
        <LanguageSelector />
        <ThemeToggle />
        {status === "loading" && (
          <div className="h-7 w-7 animate-pulse rounded-full bg-gray-200" />
        )}
        {status === "unauthenticated" && (
          <Link
            href="/login"
            aria-label={t("nav.signIn")}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <LogIn size={15} />
            <span className="hidden sm:inline">{t("nav.signIn")}</span>
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
              aria-label={t("nav.signOut")}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">{t("nav.signOut")}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
