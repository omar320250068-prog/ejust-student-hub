path = r"C:\Users\OMAR HINDAWY\campus-navigator\src\app\gpa\page.tsx"
s = open(path).read()
old = '''export default function GpaPage() {
  const [courses, setCourses] = useState<Course[]>(SEED_COURSES);
  const [targetGpa, setTargetGpa] = useState(3.5);
  const [degreeCredits, setDegreeCredits] = useState(160);
  const [statusFilter, setStatusFilter] = useState<CourseStatus | "all">("all");

  const [form, setForm] = useState({
    code: "",
    title: "",
    credits: 3,
    semester: "Y2S2",
    status: "planned" as CourseStatus,
    grade: "" as LetterGrade | "",
    expectedGrade: "" as LetterGrade | "",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as {
          courses?: Course[];
          targetGpa?: number;
          degreeCredits?: number;
        };
        if (saved.courses?.length) setCourses(saved.courses);
        if (typeof saved.targetGpa === "number") setTargetGpa(saved.targetGpa);
        if (typeof saved.degreeCredits === "number")
          setDegreeCredits(saved.degreeCredits);
      } catch {
        // fall back to seed data
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ courses, targetGpa, degreeCredits })
        );
      } catch {
        // storage unavailable — data lives in session state
      }
    }, 100);
    return () => window.clearTimeout(timer);
  }, [courses, targetGpa, degreeCredits]);'''
new = '''export default function GpaPage() {
  const { data: saved, setData: saveData } = useUserData<{
    courses: Course[];
    targetGpa: number;
    degreeCredits: number;
  }>("gpa", {
    courses: SEED_COURSES,
    targetGpa: 3.5,
    degreeCredits: 160,
  });
  const courses = saved.courses;
  const targetGpa = saved.targetGpa;
  const degreeCredits = saved.degreeCredits;
  const setCourses = (updater: Course[] | ((prev: Course[]) => Course[])) => {
    const next = typeof updater === "function" ? updater(courses) : updater;
    saveData({ ...saved, courses: next });
  };
  const setTargetGpa = (v: number | ((p: number) => number)) => {
    const next = typeof v === "function" ? v(targetGpa) : v;
    saveData({ ...saved, targetGpa: next });
  };
  const setDegreeCredits = (v: number | ((p: number) => number)) => {
    const next = typeof v === "function" ? v(degreeCredits) : v;
    saveData({ ...saved, degreeCredits: next });
  };
  const [statusFilter, setStatusFilter] = useState<CourseStatus | "all">("all");

  const [form, setForm] = useState({
    code: "",
    title: "",
    credits: 3,
    semester: "Y2S2",
    status: "planned" as CourseStatus,
    grade: "" as LetterGrade | "",
    expectedGrade: "" as LetterGrade | "",
  });'''
if old not in s:
    print('not found')
    raise SystemExit
s2 = s.replace(old, new)
open(path,'w').write(s2)
print('ok')
