import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import XLSX from "xlsx";
import { PDFParse } from "pdf-parse";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

const ROOT = process.cwd();
const RAW = path.join(ROOT, "data", "raw");
dotenv.config({ path: path.join(ROOT, ".env.local") });
dotenv.config();
const sql = neon(process.env.DATABASE_URL);

function stableId(prefix, value) {
  return `${prefix}-${crypto.createHash("sha256").update(value).digest("hex").slice(0, 32)}`;
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeOffice(value) {
  const raw = clean(value);
  if (!raw || /^not specified$/i.test(raw)) {
    return { building: "Unspecified", officeNumber: "Not specified", note: raw || null };
  }

  const normalized = raw
    .replace(/[–—]/g, "-")
    .replace(/\bBuilding\s*(\d+)\b/gi, "B$1")
    .replace(/\bBlock\s*(\d+)\b/gi, "B$1");
  const match = normalized.match(/\bB\s*(\d+)\s+(F|G)\s*([0-9]+(?:[.-][0-9]+)?)/i);

  if (match) {
    return {
      building: `Building ${match[1]}`,
      officeNumber: `${match[2].toUpperCase()}${match[3].replace("-", ".")}`,
      note: /uncertain|generic/i.test(raw) ? raw : null,
    };
  }

  return { building: "Unspecified", officeNumber: raw, note: "Original office address could not be normalized." };
}

// Curated transliterations of the CSIT faculty roster. Names absent from this
// map keep a null nameAr rather than receiving a machine-guessed spelling.
const FACULTY_AR = {
  "Adel Bedair": "عادل بدير",
  "Adel Fathy": "عادل فتحي",
  "Ahmed Abd El-Moneim": "أحمد عبد المنعم",
  "Ahmed Abdel-Mawgood": "أحمد عبد الموجود",
  "Ahmed Abdelmalek": "أحمد عبد المالك",
  "Ahmed Allam": "أحمد علام",
  "Ahmed Arafa": "أحمد عرفة",
  "Ahmed Askar": "أحمد عسكر",
  "Ahmed Awad": "أحمد عوض",
  "Ahmed Bayoumi Zaky": "أحمد بيومي زكي",
  "Ahmed El-Saeed": "أحمد السعيد",
  "Ahmed Elsaid": "أحمد السعيد",
  "Ahmed Elshazly": "أحمد الشاذلي",
  "Ahmed Fares": "أحمد فارس",
  "Ahmed Gomaa": "أحمد جمعة",
  "Ahmed Hamed": "أحمد حامد",
  "Ahmed Lotfy": "أحمد لطفي",
  "Ahmed M.R. Fath El-Bab": "أحمد فتح الباب",
  "Ahmed Osman": "أحمد عثمان",
  "Ahmed Rady": "أحمد راضي",
  "Ahmed Romouzy": "أحمد رموزي",
  "Ali Kandil": "علي قنديل",
  "Amal Elsonbaty": "أمل السنباطي",
  "Amal Gomaa": "أمل جمعة",
  "Amal Refaat": "أمل رفعت",
  "Amr Eltawil": "عمرو الطويل",
  "Amr Nassrallah": "عمرو نصر الله",
  "Aya Essa": "آية عيسى",
  "Ayman Arafa": "أيمن عرفة",
  "Ayman Mahrous": "أيمن محروس",
  "Ayman Nada": "أيمن ندى",
  "Dalia Kaies": "داليا كايس",
  "Diaa Mansour": "ضياء منصور",
  "Ehab Elshazly": "إيهاب الشاذلي",
  "Ehab Elwageeh": "إيهاب الوجيه",
  "Eslam Reda": "إسلام رضا",
  "Gehad Genidy Mohamed": "جهاد جنيدي محمد",
  "Haitham El-Hussieny": "هيثم الحسيني",
  "Haitham El-Sayed": "هيثم السيد",
  "Hamdy Hassan": "حمدي حسن",
  "Hanan Amin": "حنان أمين",
  "Hassan Shokry": "حسن شكري",
  "Hatem Mahmoud": "حاتم محمود",
  "Hebatallah Badawy": "هبة الله بدوي",
  "Hesham Elsherif": "هشام الشريف",
  "Hosam Moubarak": "حسام مبارك",
  "Hossam Kasem": "حسام قاسم",
  "Ibrahem Maher": "إبراهيم ماهر",
  "Islam Ali": "إسلام علي",
  "Maali Fouad": "معالي فؤاد",
  "Maha Elsabrouty": "مها الصبروتي",
  "Mahmoud Elsamanty": "محمود السمانتي",
  "Mahmoud Fawzy": "محمود فوزي",
  "Mahmoud Hasan": "محمود حسن",
  "Mahmoud Nasr": "محمود نصر",
  "Mahmoud Otaify": "محمود عطيفي",
  "Mahmoud Sharaan": "محمود شعران",
  "Mamdouh Mansour": "ممدوح منصور",
  "Marwa Elkady": "مروة القاضي",
  "Marwa Galal": "مروة جلال",
  "Moataz Abdelwahab": "معتز عبد الوهاب",
  "Mohab Hossam": "مهاب حسام",
  "Mohamad Ayad": "محمد عياد",
  "Mohamed El-Khouly": "محمد الخولي",
  "Mohamed Gepreel": "محمد جبريل",
  "Mohamed Ghazy": "محمد غازي",
  "Mohamed Gheith": "محمد غيث",
  "Mohamed Gouda": "محمد جودة",
  "Mohamed Nassef": "محمد ناصف",
  "Mohammed Abo-Zahhad": "محمد أبو زهاد",
  "Mohammed Khalil": "محمد خليل",
  "Mohammed Sayed": "محمد سيد",
  "Mohsen Ghali": "محسن غالي",
  "Mohsen Khozami": "محسن خزامي",
  "Mona Gamal": "منى جمال",
  "Mostafa E. Shahen": "مصطفى شاهين",
  "Mostafa Elshafie": "مصطفى الشافعي",
  "Mostafa Soliman": "مصطفى سليمان",
  "Nada Hossameldin Kamel": "ندى حسام الدين كامل",
  "Ola Eldardery": "علا الدرديري",
  "Ola Elgeuoshy": "علا الجيوشي",
  "Pakinam Hassan": "باكينام حسن",
  "Rami Zewail": "رامي زويل",
  "Riham Mohamed Hilal": "ريهام محمد هلال",
  "Safaa Hussein": "صفاء حسين",
  "Sameh Nada": "سامح ندى",
  "Sameh Sherif": "سامح شريف",
  "Samir Ahmed Elsagheer Mohamed": "سمير أحمد الصغير محمد",
  "Sara Sabry": "سارة صبري",
  "Sayed Soliman": "سيد سليمان",
  "Sobhy Abdelkader": "صبحي عبد القادر",
  "Takao Kikuchi": "تاكاو كيكوتشي",
  "Tamer Megahed": "تامر مجاهد",
  "Usama Nour": "أسامة نور",
  "Wael Khaireldin": "وائل خير الدين",
  "Waheed K. Zahra": "وحيد زهرة",
  "Walid Gomaa": "وليد جمعة",
  "Yara Magdy": "يارا مجدي",
  "Yomna Yakout": "يمنى ياقوت",
  "Zakaria Yahia": "زكريا يحيى",
};

async function ingestFaculty() {
  const workbook = XLSX.readFile(path.join(RAW, "Doctor's Office.xlsx"));
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
    defval: "",
  });
  let count = 0;

  for (const row of rows) {
    const name = clean(row.Name);
    if (!name) continue;
    const office = normalizeOffice(row["Office Location"]);
    await sql`
      insert into "faculty_office"
        (id, name, "nameAr", department, email, building, "officeNumber", "officeHours", "officeHoursNote", "updatedAt")
      values
        (${stableId("faculty", `${name}|CSIT`)}, ${name}, ${FACULTY_AR[name] || null}, 'CSIT', ${clean(row.Email) || null},
         ${office.building}, ${office.officeNumber}, '[]'::json, ${office.note}, now())
      on conflict (name, department) do update set
        "nameAr" = excluded."nameAr",
        email = excluded.email,
        building = excluded.building,
        "officeNumber" = excluded."officeNumber",
        "officeHoursNote" = excluded."officeHoursNote",
        "updatedAt" = now()
    `;
    count += 1;
  }
  return count;
}

function parseCourseRows(text) {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const rows = [];
  const codePattern = /^(CSC|AID|CNC|BIF|LRA|FR)\s*(\d{3})\b\s*(.*)$/i;

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(codePattern);
    if (!match) continue;
    const code = `${match[1].toUpperCase()} ${match[2]}`;
    const parts = [clean(match[3])];
    let end = i;
    for (let j = i + 1; j <= Math.min(lines.length - 1, i + 6); j += 1) {
      if (codePattern.test(lines[j])) break;
      parts.push(lines[j]);
      end = j;
      if (/\b(?:\d+\s+){2,}\d+\b/.test(lines[j]) || /\(\w+ credits?\)/i.test(lines[j])) break;
    }

    const joined = clean(parts.join(" "));
    const creditMatch = joined.match(/\((one|two|three|four|five|six)\s+credits?\)/i)
      ?? joined.match(/\b([1-6])\s+[0-9]\s+[0-9]\s+[0-9]\s+[0-9]\b/);
    const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    const credits = creditMatch
      ? Number(words[String(creditMatch[1]).toLowerCase()] ?? creditMatch[1])
      : Number(joined.match(/\b([1-6])\s+[0-9]\s+[0-9]\s+[0-9]\b/)?.[1] ?? 3);

    let title = joined
      .replace(/\((one|two|three|four|five|six)\s+credits?\)/i, "")
      .replace(/\b[1-6]\s+[0-9]\s+[0-9]\s+[0-9](?:\s+[0-9])?(?:\s+(?:[A-Z]{2,4}\s+\d{3}(?:\s*\+\s*)?)*)?.*$/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!title || title.length < 3 || /^(course|code|credits?)$/i.test(title)) {
      i = end;
      continue;
    }

    const prerequisites = joined.match(/\b(?:[A-Z]{2,4}\s*\d{3})(?:\s*\+\s*[A-Z]{2,4}\s*\d{3})*/)?.[0] ?? null;
    const program = ["CSC", "AID", "CNC", "BIF"].includes(match[1].toUpperCase())
      ? match[1].toUpperCase()
      : "GENERAL";
    rows.push({
      code,
      title,
      credits: Math.max(1, Math.min(6, credits)),
      program,
      sourceGroup: match[1].toUpperCase(),
      prerequisites,
      description: [
        `Curriculum group: ${match[1].toUpperCase()}.`,
        prerequisites ? `Prerequisites: ${prerequisites}.` : "Prerequisites: None stated in the curriculum table.",
        "Standard grading weights: Class 15%, Midterm 30%, Lab/Oral 15%, Final 40%.",
      ].join(" "),
    });
    i = end;
  }

  return [...new Map(rows.map((row) => [`${row.code}|${row.program}`, row])).values()];
}

async function ingestCourses(texts) {
  const courses = parseCourseRows(texts.join("\n"));
  for (const course of courses) {
    await sql`
      insert into course
        (id, code, name, program, "creditHours", description)
      values
        (${stableId("course", `${course.code}|${course.program}`)}, ${course.code}, ${course.title},
         ${course.program}, ${course.credits}, ${course.description})
      on conflict (code, program) do update set
        name = excluded.name,
        "creditHours" = excluded."creditHours",
        description = excluded.description
    `;
  }
  return courses;
}

function excerpt(text, terms) {
  const lower = text.toLowerCase();
  const index = terms.reduce((found, term) => {
    const next = lower.indexOf(term.toLowerCase());
    return found >= 0 ? found : next;
  }, -1);
  if (index < 0) return text.slice(0, 900);
  return text.slice(Math.max(0, index - 180), Math.min(text.length, index + 1250)).trim();
}

const POLICY_CHUNKS = [
  {
    section: "Academic calendar and registration dates",
    terms: ["Academic Calendar", "Add and Drop", "Withdrawal"],
    keywords: ["academic calendar", "fall", "spring", "registration", "add drop", "withdrawal", "التقويم الأكاديمي", "التسجيل", "الحذف والإضافة"],
    ar: "التقويم الأكاديمي للفصلين الخريفي والربيعي ومواعيد التسجيل والحذف والإضافة والانسحاب.",
  },
  {
    section: "Graduation and level credit thresholds",
    terms: ["134 credit hours", "32 credit"],
    keywords: ["graduation", "134 credits", "CGPA 2.00", "level 1", "level 2", "level 3", "level 4", "التخرج", "134 ساعة", "المعدل التراكمي"],
    ar: "يشترط للتخرج إتمام 134 ساعة معتمدة ومعدل تراكمي لا يقل عن 2.00. ينتقل الطالب عند 32 و64 و96 ثم 134 ساعة.",
  },
  {
    section: "Registration limits, add/drop and withdrawal",
    terms: ["register up to", "withdrawal"],
    keywords: ["registration limit", "18 credit hours", "12 credit hours", "add drop", "W", "WF", "الحد الأقصى للتسجيل", "الانسحاب"],
    ar: "حدود التسجيل تختلف حسب المعدل التراكمي، وتوضح الجداول مواعيد الحذف والإضافة والانسحاب بدرجتي W وWF.",
  },
  {
    section: "Attendance and FW rule",
    terms: ["75%", "Treatment of Class Absences"],
    keywords: ["attendance", "75%", "FW", "absence", "الحضور", "الغياب", "الحرمان"],
    ar: "يلتزم الطالب بنسبة حضور 75٪ على الأقل؛ وقد تؤدي كثرة الغياب إلى FW وفق لائحة معالجة الغياب.",
  },
  {
    section: "Probation and dismissal",
    terms: ["probation", "dismissal"],
    keywords: ["probation", "dismissal", "CGPA below 2.00", "academic warning", "الإنذار الأكاديمي", "الفصل"],
    ar: "يوضع الطالب تحت الملاحظة الأكاديمية عند انخفاض المعدل التراكمي عن 2.00، وتطبق قواعد الإنذار والفصل الواردة في اللائحة.",
  },
  {
    section: "CSIT and Liberal Arts grading and GPA",
    terms: ["Grading System", "grade point"],
    keywords: ["CSIT grading", "Liberal Arts", "GPA", "grade point", "Class", "Midterm", "Final", "نظام التقديرات", "المعدل"],
    ar: "يوضح الدليل نظام تقديرات مقررات CSIT ومقررات الآداب الحرة وطريقة حساب نقاط التقدير والمعدل الفصلي والتراكمي.",
  },
  {
    section: "Scholarship retention and tuition discounts",
    terms: ["Scholarship", "3.7", "3.85"],
    keywords: ["scholarship", "CGPA retention", "3.7", "3.85", "tuition discount", "المنح", "خصم المصروفات"],
    ar: "تحدد المنح شروط الاحتفاظ بها حسب المعدل التراكمي، وتتضمن خصومات للمعدل 3.70 و3.85 وفق سياسة المصروفات.",
  },
  {
    section: "Certificate fees and martyr stamp",
    terms: ["Certificate", "martyr"],
    keywords: ["certificate fee", "martyr stamp", "graduation certificate", "رسوم الشهادة", "طابع الشهيد"],
    ar: "توضح السياسة رسوم استخراج الشهادات ومتطلبات طابع الشهيد وإجراءات طلب شهادة التخرج.",
  },
  {
    section: "Dress code and code of ethics",
    terms: ["Dress Code", "Code of Ethics"],
    keywords: ["dress code", "code of ethics", "student conduct", "الزي", "أخلاقيات", "سلوك الطالب"],
    ar: "يلتزم طلاب الجامعة بالزي اللائق ومدونة أخلاقيات وسلوك الطالب داخل الحرم الجامعي.",
  },
];

async function readPdf(file) {
  const parser = new PDFParse({ data: await fs.readFile(file) });
  const result = await parser.getText();
  await parser.destroy();
  return { text: result.text, pages: result.total };
}

async function ingestHandbook(academicYear, file) {
  const source = await readPdf(file);
  const handbookId = stableId("handbook", academicYear);
  await sql`
    insert into handbook
      (id, "academicYear", program, title, version, checksum, "pageCount")
    values
      (${handbookId}, ${academicYear}, 'GENERAL', ${`CSIT Student Academic Handbook ${academicYear}`},
       'source-pdf', ${crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex")}, ${source.pages})
    on conflict ("academicYear", program, version) do update set
      title = excluded.title,
      checksum = excluded.checksum,
      "pageCount" = excluded."pageCount",
      "uploadedAt" = now()
  `;
  await sql`delete from handbook_chunk where "handbookId" = ${handbookId}`;

  for (const [index, policy] of POLICY_CHUNKS.entries()) {
    const content = `${policy.section}\n\n${excerpt(source.text, policy.terms)}`;
    await sql`
      insert into handbook_chunk
        (id, "handbookId", "chunkIndex", section, "pageFrom", "pageTo", content, "contentAr",
         language, "contentHash", "tokenCount", keywords, "sourceType", "sourceId")
      values
        (${stableId("chunk", `${academicYear}|${index}`)}, ${handbookId}, ${index}, ${policy.section},
         null, null, ${content}, ${policy.ar}, 'MIXED',
         ${crypto.createHash("sha256").update(`${content}|${policy.ar}`).digest("hex")},
         ${content.split(/\s+/).length + policy.ar.split(/\s+/).length},
         ${JSON.stringify(policy.keywords)}::json, 'HANDBOOK', ${`${academicYear}-${index}`})
      on conflict (id) do update set
        section = excluded.section,
        content = excluded.content,
        "contentAr" = excluded."contentAr",
        "contentHash" = excluded."contentHash",
        "tokenCount" = excluded."tokenCount",
        keywords = excluded.keywords
    `;
  }
  return { pages: source.pages, chunks: POLICY_CHUNKS.length };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const [handbook2024, handbook2025] = await Promise.all([
    readPdf(path.join(RAW, "CSIT_Handbook_updated 2024.pdf")),
    readPdf(path.join(RAW, "CSIT_Handbook_updated 2025.pdf")),
  ]);
  const faculty = await ingestFaculty();
  const courses = await ingestCourses([handbook2024.text, handbook2025.text]);
  const handbooks = await Promise.all([
    ingestHandbook("2024-2025", path.join(RAW, "CSIT_Handbook_updated 2024.pdf")),
    ingestHandbook("2025-2026", path.join(RAW, "CSIT_Handbook_updated 2025.pdf")),
  ]);
  const [counts] = await sql`
    select
      (select count(*)::int from faculty_office) as offices,
      (select count(*)::int from course) as courses,
      (select count(*)::int from handbook) as handbooks,
      (select count(*)::int from handbook_chunk) as chunks
  `;
  console.log(JSON.stringify({ faculty, courses: courses.length, handbooks, counts }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
