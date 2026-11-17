import { CAMPUS, allEntities } from "@/lib/campusTypes";
import { SCHOLARSHIPS } from "@/data/scholarships";
import { menuFor, DAYS, PERIODS, formatEgp } from "@/data/cafeteria";
import { GRADE_POINTS } from "@/lib/gpa";
import faqsData from "@/data/faqs.json";
import { retrieve, tokenize, type RetrievedDoc } from "./retriever";
import {
  dbHitsToRetrievedDocs,
  retrieveFromDb,
  type DbHit,
} from "./db-retriever";

/**
 * A retrievable passage. `id` is the stable join key when this corpus is later
 * mirrored into Supabase (table `campus_documents`, column `doc_id`).
 */
export interface KnowledgeDoc {
  id: string;
  title: string;
  category: string;
  text: string;
  /** Extra searchable terms that don't appear naturally in `text` (synonyms, codes). */
  keywords: string[];
}

interface FaqRecord {
  id: string;
  category: string;
  question_ar: string;
  question_en: string;
  answer_ar: string;
  answer_en: string;
  keywords: string[];
}

const faqDocs: KnowledgeDoc[] = (faqsData as FaqRecord[]).map((faq) => ({
  id: faq.id,
  category: faq.category,
  title: `${faq.question_ar} | ${faq.question_en}`,
  text: [
    `السؤال: ${faq.question_ar}`,
    `Question: ${faq.question_en}`,
    `الإجابة: ${faq.answer_ar}`,
    `Answer: ${faq.answer_en}`,
  ].join("\n"),
  keywords: faq.keywords,
}));

function campusDocs(): KnowledgeDoc[] {
  const entityDocs: KnowledgeDoc[] = allEntities(CAMPUS).map((entity) => {
    const parts = [
      `${entity.name} is a ${entity.kind} at EJUST`,
      entity.zone ? `in the ${entity.zone} zone` : "",
      entity.location ? `located in the ${entity.location}` : "",
      `at master-plan coordinates x=${entity.coordinates.x}, y=${entity.coordinates.y}`,
    ].filter(Boolean);
    const body = [
      `${parts.join(", ")}.`,
      entity.description ? entity.description : "",
      entity.tips?.length ? `Student tips: ${entity.tips.join(" ")}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      id: `campus:${entity.id}`,
      title: entity.name,
      category: "campus" as const,
      text: body,
      keywords: [
        entity.id,
        entity.kind,
        entity.category ?? "",
        entity.zone ?? "",
        entity.location ?? "",
      ].filter(Boolean),
    };
  });

  const overview: KnowledgeDoc = {
    id: "campus:overview",
    title: "Campus layout overview",
    category: "campus",
    text: [
      "The EJUST campus follows a Nikken Sekkei master plan around a central Japanese Garden.",
      "The Central Library faces the garden.",
      "Buildings are grouped into the North Academic Grid, Central Academic zone, South Academic Grid, West Academic Grid and a West Extension.",
      "Gates: Main Gate 01 is on the east side and South Gate 02 is on the south side.",
      "Parking hubs sit north, south and west.",
      "The main north-south road runs along x=53 in master-plan coordinates and an east-west spine crosses it at y=50.",
    ].join(" "),
    keywords: [
      "master plan",
      "layout",
      "overview",
      "map",
      "japanese garden",
      "zones",
      "grids",
      "roads",
      "orientation",
    ],
  };

  return [overview, ...entityDocs];
}

function scholarshipDocs(): KnowledgeDoc[] {
  return SCHOLARSHIPS.map((s) => ({
    id: `scholarship:${s.id}`,
    title: s.name,
    category: "scholarship" as const,
    text: [
      `${s.name} is offered by ${s.provider} and is open to ${s.levels.join(", ")} students in ${s.country}.`,
      `Fields: ${s.fields}.`,
      `Funding: ${s.fundingDetails}.`,
      `Deadline: ${s.deadline}${s.deadlineNote ? ` (${s.deadlineNote})` : ""}.`,
      `Eligibility: ${s.eligibility.join("; ")}.`,
      `Tip: ${s.tips}`,
      `Official page: ${s.link}`,
    ].join(" "),
    keywords: [
      s.id,
      s.country,
      s.funding,
      ...s.levels,
      ...s.provider.split(/\s+/).filter((w) => w.length > 3),
      "scholarship",
      "funding",
      "deadline",
    ],
  }));
}

function cafeteriaDocs(): KnowledgeDoc[] {
  const docs: KnowledgeDoc[] = [
    {
      id: "cafeteria:overview",
      title: "Cafeteria and meal budget",
      category: "cafeteria",
      text: [
        "The campus cafeteria serves breakfast, lunch and dinner.",
        "The Meal Budget planner lets you pick a tray for each day and tracks spend against a daily and weekly budget.",
        "The menu and prices in the planner are samples, not the official cafeteria list.",
      ].join(" "),
      keywords: ["cafeteria", "food", "menu", "meal", "budget", "lunch", "dinner", "breakfast"],
    },
  ];

  const breakfastPrices = PERIODS.map((period) => {
    const items = menuFor("Sunday")[period];
    return `${period}: ${items
      .map((i) => `${i.name} (${formatEgp(i.price)})`)
      .join(", ")}.`;
  });
  docs.push({
    id: "cafeteria:menu",
    title: "Sample menu and prices",
    category: "cafeteria",
    text: [
      `Sample ${breakfastPrices.join(" ")}`,
      `Lunch rotates by day — for example ${DAYS[0]}: ${menuFor(DAYS[0])
        .Lunch.map((i) => `${i.name} (${formatEgp(i.price)})`)
        .join(", ")}.`,
  ].join(" "),
    keywords: ["menu", "price", "egp", "koshary", "shawarma", "cost", "cheap", "vegetarian"],
  });

  return docs;
}

function academicsDocs(): KnowledgeDoc[] {
  return [
    {
      id: "academics:csit-regulations",
      title: "CSIT academic regulations",
      category: "academics",
      text: [
        "The official Faculty of Computer Science and Information Technology (CSIT) graduation requirement is 134 successfully completed credit hours with a cumulative GPA (CGPA) of at least 2.00.",
        "Promotion from level one to level two requires 32 successfully completed credit hours; from level two to level three requires 64; and from level three to level four requires 96.",
        "The four approved CSIT programs are Computer Science (CSC), Artificial Intelligence and Data Science (AID), Computer Networks and Cyber Security (CNC), and Bioinformatics (BIF).",
        "The curriculum includes 24 mathematics and basic science credits: 18 compulsory credits (MTH 111, MTH 121, PHY 113, PHY 123, MTH 212, and CSE 312) and 6 elective credits from chemistry, life sciences, ACM 215 differential equations, numerical analysis, operations research, or signals and systems analysis.",
        "Core computing requirements total 39 credits and cover programming, data structures, algorithm analysis, and software engineering. University and humanities requirements include Japanese language LRA 401 and LRA 403, English, Japanese culture LRA 101, sustainability LRA 306, philosophy LRA 102, and music or drama.",
      ].join(" "),
      keywords: [
        "csit", "computer science", "information technology", "graduation", "graduate",
        "134", "2.00", "cgpa", "promotion", "32", "64", "96", "credits", "program",
        "csc", "aid", "cnc", "bif", "curriculum", "math", "science", "humanities",
        "متطلبات", "التخرج", "ساعات", "اعتماد", "معدل", "ترقية", "برنامج",
        "اللوائح", "الساعة", "الساعات", "المعتمدة", "النجاح", "المستوى",
      ],
    },
    {
      id: "academics:csit-course-catalog",
      title: "CSIT course catalog",
      category: "academics",
      text: [
        "The official CSIT course catalog includes LRA 403 Japanese Language (3 credits), a university language requirement; LRA 306 Natural Resources and Sustainability, a university humanities requirement; MTH 212 Probability and Statistics; ACM 215 Ordinary Differential Equations; CSC 114 Algorithms Analysis and Design; CSE 214 Computer Organization; CNC 111 Networks and Web Programming; and CSC 211 Software Engineering 1.",
      ].join(" "),
      keywords: [
        "course", "catalog", "code", "lra 403", "lra403", "lra 306", "lra306",
        "mth 212", "mth212", "acm 215", "acm215", "csc 114", "csc114",
        "cse 214", "cse214", "cnc 111", "cnc111", "csc 211", "csc211",
        "japanese", "sustainability", "probability", "statistics", "differential",
        "equations", "algorithms", "organization", "networks", "software engineering",
        "مادة", "مقرر", "كود",
      ],
    },
    {
      id: "academics:csit-calendar-and-rooms",
      title: "CSIT academic calendar and campus rooms",
      category: "academics",
      text: [
        "The official academic calendar starts the Fall semester on September 29, schedules midterm examinations from November 17 to November 21, schedules final examinations from January 11 to January 23, and starts the Spring semester on February 9.",
        "Building 7 is the Engineering and Computer building. Its classrooms are F1.20, F1.21, F1.22, F1.23, F1.24, and G01. Its computer laboratories are COE F2.16 and COE F2.17.",
        "Building 10 is the central building and theatre complex. Its classrooms are F1.06, F1.08, F1.10, F1.11, and F1.18. Its large theatres and colored halls are Theater B10, Green Hall, Blue Hall, Yellow Hall, and Red Hall.",
        "Lectures are organized by Group 1 and Group 2 to avoid timetable and room conflicts. Exam seat numbers for midterms and finals are assigned based on the student ID. Colored halls in Building 10 are used for larger groups, while Building 7 rooms are used for smaller groups.",
      ].join(" "),
      keywords: [
        "academic calendar", "fall", "spring", "september 29", "november 17", "november 21",
        "january 11", "january 23", "february 9", "midterms", "finals", "rooms",
        "building 7", "building 10", "f1.20", "f1.21", "f1.22", "f1.23", "f1.24",
        "g01", "coe f2.16", "coe f2.17", "theater b10", "green hall", "blue hall",
        "yellow hall", "red hall", "group 1", "group 2", "student id", "seat",
        "تقويم", "فصل", "خريف", "ربيع", "امتحان", "امتحانات", "منتصف", "الفصل",
        "بداية", "تبدأ", "قاعة", "مبنى", "رقم جلوس", "الجلوس", "جامعي",
      ],
    },
    {
      id: "academics:gpa",
      title: "GPA scale and degree tracking",
      category: "academics",
      text: [
        "The GPA Tracker uses this 4.0 scale:",
        Object.entries(GRADE_POINTS)
          .map(([grade, points]) => `${grade}=${points.toFixed(1)}`)
          .join(", "),
        "You can log completed, in-progress and planned courses, then see your current GPA, a forecast GPA and the average grade you need across remaining credits to reach a target.",
      ].join(" "),
      keywords: ["gpa", "grade", "grades", "credits", "target", "forecast", "scale", "transcript"],
    },
    {
      id: "academics:timetable",
      title: "Timetable builder",
      category: "academics",
      text: [
        "The Timetable Builder lays out a Sunday-to-Saturday weekly grid.",
        "It flags overlapping classes as conflicts and can export the schedule as an .ics file for Google Calendar, Outlook or Apple Calendar.",
      ].join(" "),
      keywords: ["timetable", "schedule", "classes", "conflict", "ics", "calendar", "export"],
    },
    {
      id: "academics:exams",
      title: "Exam countdown and study planner",
      category: "academics",
      text: [
        "The Exam Countdown tracks quizzes, midterms, finals and projects with a countdown badge.",
        "The study planner splits your chosen daily study hours across upcoming exams, weighting them by difficulty, grade weight and time remaining.",
      ].join(" "),
      keywords: ["exam", "quiz", "midterm", "final", "study", "planner", "revision", "countdown"],
    },
  ];
}

function aboutDocs(): KnowledgeDoc[] {
  return [
    {
      id: "about:hub",
      title: "About the EJUST Student Hub",
      category: "about",
      text: [
        "The EJUST Student Hub is a free student toolkit for the Egypt-Japan University of Science and Technology in New Borg El-Arab City, Alexandria.",
        "It has a master plan map, a GPS map, a GPA tracker, a timetable builder, an exam planner, a cafeteria meal budget and a scholarship finder, plus a Today dashboard that summarises everything.",
        "All data is stored locally in your browser; there is no account and nothing is uploaded.",
      ].join(" "),
      keywords: [
        "hub",
        "app",
        "tools",
        "features",
        "privacy",
        "localstorage",
        "about",
        "help",
        "what can you do",
      ],
    },
    {
      id: "about:vehicle",
      title: "Getting around campus",
      category: "campus",
      text: [
        "Walking is the main way to get around campus; walking time is estimated at 14 metres per master-plan unit at 1.3 metres per second.",
        "Each place page shows the nearest gate, the walking time and distance, the compass direction to travel and the nearest parking hub.",
        "Shuttle buses run from the parking hubs during peak hours.",
      ].join(" "),
      keywords: ["walk", "walking", "shuttle", "bus", "directions", "route", "gate", "time", "distance"],
    },
  ];
}

let cached: KnowledgeDoc[] | null = null;

export function knowledgeBase(): KnowledgeDoc[] {
  if (!cached) {
    cached = [
      ...aboutDocs(),
      ...campusDocs(),
      ...academicsDocs(),
      ...cafeteriaDocs(),
      ...scholarshipDocs(),
      ...faqDocs,
    ];
  }
  return cached;
}

/**
 * The topics this assistant can actually help with.
 *
 * Why this exists: pure lexical retrieval cannot tell an in-scope question from
 * an out-of-scope one that happens to share a rare word. Measured on this
 * corpus, "what is the capital of France" scored 6.00 on the Eiffel scholarship
 * while the genuine "library" query scored 5.75 — a rare term on an irrelevant
 * document is statistically indistinguishable from a rare term on a relevant
 * one. No score, count, or specificity threshold separates them, because the
 * corpus genuinely contains the word "france" (scholarships list host
 * countries) without containing any knowledge about France.
 *
 * So the in-scope check is explicit rather than inferred. A query must overlap
 * this vocabulary to be answered; everything else is honestly declined. It is
 * deliberately tiny and hand-checked: it names the subject areas the corpus
 * covers, not every word in it.
 */
export const DOMAIN_VOCABULARY: readonly string[] = [
  // Places, navigation and getting around
  "campus", "building", "library", "gate", "parking", "zone", "grid", "road",
  "map", "plan", "walk", "walking", "route", "direction", "direction", "shuttle",
  "bus", "distance", "entrance", "dorm", "housing", "facility", "landmark",
  "garden", "track", "sports", "administration", "affairs", "office", "coe",
  "faculty", "laboratory", "lab", "hall", "auditorium", "classroom", "college",
  "center", "centre", "excellence",
  // Academics
  "gpa", "grade", "credit", "credits", "semester", "course", "catalog", "code", "transcript", "degree",
  "graduate", "graduation", "target", "forecast", "scale", "timetable",
  "schedule", "class", "conflict", "calendar", "export", "exam", "quiz",
  "midterm", "final", "study", "planner", "revision", "countdown", "study",
  "csit", "computer science", "information technology", "graduation", "cgpa",
  "promotion", "curriculum", "program", "math", "physics", "japanese",
  "sustainability", "algorithms", "networks", "software engineering",
  "building 7", "building 10", "theater", "hall", "classroom", "student id",
  "seat", "rooms", "fall", "spring", "september", "november", "january", "february",
  "csc", "aid", "cnc", "bif", "mth", "phy", "cse", "acm", "lra",
  "f1.20", "f1.21", "f1.22", "f1.23", "f1.24", "g01", "f1.06", "f1.08",
  "f1.10", "f1.11", "f1.18", "coe", "f2.16", "f2.17",
  "مادة", "مقرر", "كود", "تخرج", "ساعات", "اعتماد", "معدل", "قاعة", "مبنى",
  "متطلبات", "اللوائح", "امتحانات", "منتصف", "الفصل", "تبدأ", "تقويم",
  "half load", "add/drop", "academic probation", "summer course", "medical excuse",
  "semester freeze", "course retake", "moodle", "student email", "wifi", "wi-fi",
  "dormitory", "dorm", "curfew", "visitor", "maintenance", "laundry", "gym",
  "sports center", "shuttle", "transport", "tuition", "installment", "financial aid",
  "student id", "transcript", "enrollment certificate", "military status", "tutoring",
  "health clinic", "student housing", "حذف", "إضافة", "إنذار", "فصل صيفي", "عذر",
  "تجميد", "إعادة مادة", "مودل", "البريد الجامعي", "واي فاي", "السكن", "حظر التجول",
  "الزوار", "الصيانة", "الغسيل", "الجيم", "المواصلات", "المصروفات", "تقسيط",
  "مساعدة مالية", "بطاقة الطالب", "كشف الدرجات", "شهادة قيد", "تأجيل التجنيد",
  "دروس", "عيادة",
  // Cafeteria
  "cafeteria", "food", "meal", "menu", "breakfast", "lunch", "dinner", "price",
  "prices", "cost", "cheap", "budget", "vegetarian", "egp", "eat",
  // Scholarships
  "scholarship", "scholarships", "funding", "deadline", "stipend",
  "eligibility", "eligible", "master", "masters", "phd",
  "doctoral", "mext", "erasmus", "daad", "chevening", "fulbright", "eiffel",
  "amideast", "schlumberger",
  // This app
  "hub", "app", "tool", "tools", "feature", "features", "privacy", "account",
  "data", "help", "about",
];

/**
 * Vocabulary reduced to the same stems the retriever uses, so "scholarships"
 * and "scholarship" are one entry rather than two.
 */
let cachedDomainStems: Set<string> | null = null;

function domainStems(): Set<string> {
  if (!cachedDomainStems) {
    cachedDomainStems = new Set([
      ...DOMAIN_VOCABULARY.flatMap((word) => tokenize(word)),
    ]);
  }
  return cachedDomainStems;
}

/**
 * Multi-word phrases whose individual words are all stopwords, so tokenizing
 * them leaves nothing to match. "what can you do" is the natural way to ask what
 * the assistant offers, and it has to reach the `about:hub` document.
 */
const DOMAIN_PHRASES = ["what can you do", "what can this do", "what do you do"];

/** True when the query shares any meaningful term with the supported topics. */
export function isInDomain(query: string): boolean {
  const normalized = query.toLowerCase();
  if (DOMAIN_PHRASES.some((phrase) => normalized.includes(phrase))) return true;

  const stems = domainStems();
  return tokenize(query).some((token) => stems.has(token));
}

/** Convert a live DB hit into the same passage shape the static corpus uses. */
export function dbHitToKnowledgeDoc(hit: DbHit): KnowledgeDoc {
  return {
    id: hit.id,
    title: hit.title,
    category: `db:${hit.sourceType}`,
    text: [hit.text, hit.textAr].filter(Boolean).join("\n"),
    keywords: Object.values(hit.metadata)
      .filter((value): value is string => typeof value === "string")
      .slice(0, 6),
  };
}

/**
 * Live passages for a query, straight from Postgres.
 *
 * Deliberately tolerant: the assistant must keep answering from the static
 * corpus when the database is unreachable or empty, so a failed lookup yields
 * `[]` instead of an error. `retrieveFromDb` itself is wrapped in
 * `await connection()`, which keeps the caller out of the prerender path.
 */
export async function dbKnowledgeDocs(
  query: string,
  limit = 6
): Promise<KnowledgeDoc[]> {
  try {
    const hits = await retrieveFromDb(query, { limit });
    return hits.map(dbHitToKnowledgeDoc);
  } catch {
    return [];
  }
}

/** Static corpus + live DB passages, de-duplicated by id. */
export async function hybridKnowledge(
  query: string,
  limit = 6
): Promise<KnowledgeDoc[]> {
  const base = knowledgeBase();
  const live = await dbKnowledgeDocs(query, limit);
  const seen = new Set(base.map((doc) => doc.id));
  return [...base, ...live.filter((doc) => !seen.has(doc.id))];
}

/**
 * Fused ranking for the assistant: lexical BM25 over the static corpus plus
 * reciprocal-rank fusion with the database retrievers.
 *
 * Scores are rank-derived and therefore only comparable inside a single call —
 * they order results, they do not express confidence. `answer()` keeps its own
 * calibrated lexical threshold for the decision to cite.
 */
export async function hybridRetrieve(
  query: string,
  k = 4
): Promise<RetrievedDoc[]> {
  const lexical = retrieve(query, k * 2);
  let live: RetrievedDoc[] = [];

  try {
    live = dbHitsToRetrievedDocs(await retrieveFromDb(query, { limit: k }));
  } catch {
    live = [];
  }

  const RRF_K = 60;
  const fused = new Map<string, RetrievedDoc>();

  lexical.forEach((result, index) => {
    fused.set(result.doc.id, { ...result, score: 1 / (RRF_K + index + 1) });
  });

  live.forEach((result, index) => {
    const existing = fused.get(result.doc.id);
    const increment = 1 / (RRF_K + index + 1);
    if (existing) {
      existing.score += increment;
      existing.matched = Array.from(new Set([...existing.matched, ...result.matched]));
      return;
    }
    fused.set(result.doc.id, { ...result, score: increment });
  });

  const max = Math.max(...[...fused.values()].map((entry) => entry.score), 1e-9);

  return [...fused.values()]
    .map((entry) => ({ ...entry, score: Math.round((entry.score / max) * 400) / 100 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
