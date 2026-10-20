import { CAMPUS, allEntities } from "@/lib/campusTypes";
import { SCHOLARSHIPS } from "@/data/scholarships";
import { menuFor, DAYS, PERIODS, formatEgp } from "@/data/cafeteria";
import { GRADE_POINTS } from "@/lib/gpa";
import { tokenize } from "./retriever";

/**
 * A retrievable passage. `id` is the stable join key when this corpus is later
 * mirrored into Supabase (table `campus_documents`, column `doc_id`).
 */
export interface KnowledgeDoc {
  id: string;
  title: string;
  category: "campus" | "scholarship" | "cafeteria" | "academics" | "about";
  text: string;
  /** Extra searchable terms that don't appear naturally in `text` (synonyms, codes). */
  keywords: string[];
}

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
  "gpa", "grade", "credit", "semester", "course", "transcript", "degree",
  "graduate", "graduation", "target", "forecast", "scale", "timetable",
  "schedule", "class", "conflict", "calendar", "export", "exam", "quiz",
  "midterm", "final", "study", "planner", "revision", "countdown", "study",
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
    cachedDomainStems = new Set(DOMAIN_VOCABULARY.flatMap((word) => tokenize(word)));
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

