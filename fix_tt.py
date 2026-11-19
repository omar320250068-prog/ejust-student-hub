path = r"src\app\timetable\page.tsx"
s = open(path).read()
old = '''import PrintButton from "@/components/PrintButton";

const STORAGE_KEY = "ejust-timetable-v1";'''
new = '''import PrintButton from "@/components/PrintButton";
import { useUserData } from "@/hooks/useUserData";'''
s = s.replace(old, new)
open(path,'w').write(s)
print('ok')
