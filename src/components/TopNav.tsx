"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, MapPin, GraduationCap, CalendarDays, Award, AlarmClock, UtensilsCrossed, LayoutDashboard, Bot, LogIn, LogOut, User } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";

const LINKS = [
  { href: "/today", label: "Today", icon: LayoutDashboard },
  { href: "/", label: "Master Plan", icon: Map },
  { href: "/map", label: "GPS Map", icon: MapPin },
  { href: "/gpa", label: "GPA Tracker", icon: GraduationCap },
  { href: "/timetable", label: "Timetable", icon: CalendarDays },
  { href: "/exams", label: "Exams", icon: AlarmClock },
  { href: "/cafeteria", label: "Cafeteria", icon: UtensilsCrossed },
  { href: "/scholarships", label: "Scholarships", icon: Award },
  { href: "/assistant", label: "Assistant", icon: Bot },
];

export default function TopNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 print:hidden">
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-bold text-gray-900">EJUST Student Hub</span>
        <span className="hidden text-xs text-gray-400 lg:inline">
          Egypt-Japan University of Science &amp; Technology
        </span>
      </div>
      <nav className="flex gap-1 overflow-x-auto">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="flex shrink-0 items-center gap-2">
        {status === "loading" && (
          <div className="h-7 w-7 animate-pulse rounded-full bg-gray-200" />
        )}
        {status === "unauthenticated" && (
          <button
            onClick={() => signIn("google")}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <LogIn size={15} />
            Sign in
          </button>
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
            <span className="hidden max-w-[120px] truncate text-sm text-gray-700 md:inline">
              {session.user.name}
            </span>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
