path = r"C:\Users\OMAR HINDAWY\campus-navigator\src\app\timetable\page.tsx"
s = open(path).read()
old = '''import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Download, Upload, Printer } from "lucide-react";
import PrintButton from "@/components/PrintButton";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
type Day = (typeof DAYS)[number];

const STORAGE_KEY = "ejust-timetable-v1";'''
new = '''import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Download, Upload, Printer } from "lucide-react";
import PrintButton from "@/components/PrintButton";
import { useUserData } from "@/hooks/useUserData";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
type Day = (typeof DAYS)[number];'''
if old not in s:
    print('not found')
    raise SystemExit
s = s.replace(old, new)
open(path,'w').write(s)
print('ok')
