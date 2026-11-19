path = r"src\app\gpa\page.tsx"
s = open(path).read()
old = '''  function setGrade(id: string, grade: LetterGrade) {
    setCourses((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: "completed", grade } : c
      )
    );
  }'''
new = '''  function setGrade(id: string, grade: LetterGrade) {
    setCourses((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: "completed", grade } : c
      )
    );
  }'''
# already fine
open(path,'w').write(s)
print('ok')
