path = r"C:\Users\OMAR HINDAWY\campus-navigator\src\components\TopNav.tsx"
s = open(path).read()
s = s.replace('import { Map, MapPin, GraduationCap, CalendarDays, Award, AlarmClock, UtensilsCrossed, LayoutDashboard, Bot, LogIn, LogOut, User } from "lucide-react";',
              'import { Map, MapPin, GraduationCap, CalendarDays, Award, AlarmClock, UtensilsCrossed, LayoutDashboard, Bot, LogIn, LogOut, User, FileText } from "lucide-react";')
old = '''const LINKS = [
  { href: "/today", label: "Today", icon: LayoutDashboard },
  { href: "/", label: "Master Plan", icon: Map },
  { href: "/map", label: "GPS Map", icon: MapPin },
  { href: "/gpa", label: "GPA Tracker", icon: GraduationCap },
  { href: "/timetable", label: "Timetable", icon: CalendarDays },
  { href: "/exams", label: "Exams", icon: AlarmClock },
  { href: "/cafeteria", label: "Cafeteria", icon: UtensilsCrossed },
  { href: "/scholarships", label: "Scholarships", icon: Award },
  { href: "/assistant", label: "Assistant", icon: Bot },
];'''
new = '''const LINKS = [
  { href: "/today", label: "Today", icon: LayoutDashboard },
  { href: "/", label: "Master Plan", icon: Map },
  { href: "/map", label: "GPS Map", icon: MapPin },
  { href: "/gpa", label: "GPA Tracker", icon: GraduationCap },
  { href: "/timetable", label: "Timetable", icon: CalendarDays },
  { href: "/exams", label: "Exams", icon: AlarmClock },
  { href: "/cafeteria", label: "Cafeteria", icon: UtensilsCrossed },
  { href: "/scholarships", label: "Scholarships", icon: Award },
  { href: "/assistant", label: "Assistant", icon: Bot },
  { href: "/contribute", label: "Contribute", icon: FileText },
];'''
s = s.replace(old, new)
open(path,'w').write(s)
print('ok')
