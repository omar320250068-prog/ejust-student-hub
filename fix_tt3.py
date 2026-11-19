path = r"src\app\timetable\page.tsx"
s = open(path).read()
old = '''export default function TimetablePage() {
  const [blocks, setBlocks] = useState<ClassBlock[]>(SEED);
  const [form, setForm] = useState({
    courseCode: "",
    title: "",
    day: "Sun" as Day,
    start: "08:30",
    end: "10:10",
    location: "",
    color: PALETTE[4].hex,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as ClassBlock[];
        if (Array.isArray(saved) && saved.length) setBlocks(saved);
      } catch {
        // fall back to seed
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
      } catch {
        // storage unavailable
      }
    }, 100);
    return () => window.clearTimeout(timer);
  }, [blocks]);'''
new = '''export default function TimetablePage() {
  const { data: blocks, setData: setBlocksData } = useUserData<ClassBlock[]>("timetable", SEED);
  const setBlocks = (updater: ClassBlock[] | ((prev: ClassBlock[]) => ClassBlock[])) => {
    const next = typeof updater === "function" ? updater(blocks) : updater;
    setBlocksData(next);
  };
  const [form, setForm] = useState({
    courseCode: "",
    title: "",
    day: "Sun" as Day,
    start: "08:30",
    end: "10:10",
    location: "",
    color: PALETTE[4].hex,
  });
  const [error, setError] = useState("");'''
s = s.replace(old, new)
open(path,'w').write(s)
print('ok')
