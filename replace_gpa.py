path = r"src\app\gpa\page.tsx"
s = open(path).read()
old = '''import PrintButton from "@/components/PrintButton";
import {
  computeStats,
  formatGpa,
  semesterSeries,
  GRADE_OPTIONS,
  GRADE_POINTS,
  type Course,
  type CourseStatus,
  type LetterGrade,
} from "@/lib/gpa";

const STORAGE_KEY = "ejust-gpa-v1";'''
new = '''import PrintButton from "@/components/PrintButton";
import {
  computeStats,
  formatGpa,
  semesterSeries,
  GRADE_OPTIONS,
  GRADE_POINTS,
  type Course,
  type CourseStatus,
  type LetterGrade,
} from "@/lib/gpa";
import { useUserData } from "@/hooks/useUserData";'''
if old not in s:
    print('not found')
    raise SystemExit
s2 = s.replace(old, new)
open(path,'w').write(s2)
print('ok')
