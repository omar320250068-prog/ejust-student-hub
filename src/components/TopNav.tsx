"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, MapPin, GraduationCap, CalendarDays, Award, AlarmClock, UtensilsCrossed, LayoutDashboard } from "lucide-react";

const LINKS = [
  { href: "/today", label: "Today", icon: LayoutDashboard },
  { href: "/", label: "Master Plan", icon: Map },
  { href: "/map", label: "GPS Map", icon: MapPin },
  { href: "/gpa", label: "GPA Tracker", icon: GraduationCap },
  { href: "/timetable", label: "Timetable", icon: CalendarDays },
  { href: "/exams", label: "Exams", icon: AlarmClock },
  { href: "/cafeteria", label: "Cafeteria", icon: UtensilsCrossed },
  { href: "/scholarships", label: "Scholarships", icon: Award },
];

export default function TopNav() {
  const pathname = usePathname();
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
    </header>
  );
}
