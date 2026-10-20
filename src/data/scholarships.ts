export type Level = "Bachelor" | "Master" | "PhD";

export interface Scholarship {
  id: string;
  name: string;
  provider: string;
  country: string;
  levels: Level[];
  fields: string;
  funding: "Full" | "Stipend";
  fundingDetails: string;
  deadline: string;
  deadlineNote?: string;
  eligibility: string[];
  link: string;
  tips: string;
}

export const SCHOLARSHIPS: Scholarship[] = [
  {
    id: "mext",
    name: "MEXT Scholarship",
    provider: "Japanese Ministry of Education (MEXT)",
    country: "Japan",
    levels: ["Master", "PhD"],
    fields: "All fields — strong fit for engineering, CS, and sciences",
    funding: "Full",
    fundingDetails: "Tuition + ¥143,000/month stipend + flights",
    deadline: "2027-05-31",
    deadlineNote: "Embassy recommendation round usually opens in April",
    eligibility: [
      "Egyptian national under 35 (Master) / under 40 (PhD)",
      "Bachelor's degree with GPA 2.5+/4.0 or equivalent",
      "Pass the written exams and interview at the embassy",
    ],
    link: "https://www.studyinjapan.go.jp/en/planning/scholarship/",
    tips: "EJUST's Japanese partner universities are a real advantage — mention your Japan-linked coursework and any JLPT level in the research plan.",
  },
  {
    id: "erasmus-mundus",
    name: "Erasmus Mundus Joint Masters",
    provider: "European Commission",
    country: "EU (multiple countries)",
    levels: ["Master"],
    fields: "Engineering, sustainability, data science, design",
    funding: "Full",
    fundingDetails: "Tuition + €1,400/month + travel + insurance",
    deadline: "2027-01-15",
    deadlineNote: "Each consortium sets its own date — check the specific programme",
    eligibility: [
      "Bachelor's degree completed before the programme starts",
      "English proficiency (IELTS/TOEFL, varies by consortium)",
      "Apply to up to 3 programmes per intake",
    ],
    link: "https://erasmus-plus.ec.europa.eu/opportunities/opportunities-for-individuals/students/erasmus-mundus-joint-masters",
    tips: "You study in 2–3 countries in one degree. Pick consortia matching your EJUST specialisation and tailor the motivation letter per programme.",
  },
  {
    id: "daad-epos",
    name: "DAAD EPOS Development-Related Postgraduate Courses",
    provider: "German Academic Exchange Service (DAAD)",
    country: "Germany",
    levels: ["Master", "PhD"],
    fields: "Engineering, environmental sciences, urban development",
    funding: "Full",
    fundingDetails: "Tuition + €992/month + insurance + travel",
    deadline: "2026-10-31",
    deadlineNote: "Deadlines vary by course — most fall between August and October",
    eligibility: [
      "Bachelor's degree (usually 2 years of work experience preferred)",
      "English or German proficiency depending on the course",
      "Development-related motivation is weighted heavily",
    ],
    link: "https://www.daad.de/en/studying-in-germany/scholarships/daad-scholarships/",
    tips: "Frame your goals around contributing to Egypt's development — that is the core selection criterion for EPOS.",
  },
  {
    id: "chevening",
    name: "Chevening Scholarship",
    provider: "UK Government (FCDO)",
    country: "United Kingdom",
    levels: ["Master"],
    fields: "All fields",
    funding: "Full",
    fundingDetails: "Tuition + monthly stipend + flights + visa",
    deadline: "2026-11-03",
    deadlineNote: "Applications open in August each year",
    eligibility: [
      "Egyptian national, 2+ years of work experience",
      "Bachelor's degree",
      "Return to Egypt for at least 2 years after the scholarship",
    ],
    link: "https://www.chevening.org/scholarships/",
    tips: "The four essays (leadership, networking, study plan, career plan) decide everything. Start drafting 6–8 weeks before the deadline.",
  },
  {
    id: "fulbright",
    name: "Fulbright Egyptian Student Program",
    provider: "US Embassy Cairo / AMIDEAST",
    country: "United States",
    levels: ["Master", "PhD"],
    fields: "All fields",
    funding: "Full",
    fundingDetails: "Tuition + living stipend + flights + insurance",
    deadline: "2027-05-15",
    deadlineNote: "Master's and PhD tracks have separate cycles",
    eligibility: [
      "Egyptian citizenship and residency",
      "Bachelor's degree with strong academic record",
      "TOEFL/IELTS and GRE (program-dependent)",
    ],
    link: "https://eg.usembassy.gov/education-culture/educational-exchanges/fulbright/",
    tips: "You apply before choosing a university — the placement team matches you. Strong research statements beat generic essays.",
  },
  {
    id: "eiffel",
    name: "Eiffel Excellence Scholarship",
    provider: "Campus France",
    country: "France",
    levels: ["Master", "PhD"],
    fields: "Engineering, science, economics, law",
    funding: "Stipend",
    fundingDetails: "€1,181/month + travel + insurance (tuition not covered)",
    deadline: "2027-01-08",
    deadlineNote: "You do not apply directly — a French university nominates you",
    eligibility: [
      "Under 25 (Master) / under 35 (PhD) in the application year",
      "Admission to a French master's or doctoral programme",
      "Nominated by the host institution",
    ],
    link: "https://www.campusfrance.org/en/eiffel-scholarship-program-of-excellence",
    tips: "Secure admission first, then ask the programme coordinator to nominate you for Eiffel — the deadline is internal and earlier than you think.",
  },
  {
    id: "faculty-for-the-future",
    name: "Schlumberger Faculty for the Future",
    provider: "Schlumberger Foundation",
    country: "Any (host university abroad)",
    levels: ["PhD"],
    fields: "STEM — women only",
    funding: "Full",
    fundingDetails: "Up to $50,000/year for up to 5 years",
    deadline: "2026-11-15",
    eligibility: [
      "Women from developing countries",
      "Enrolled or applying to a PhD in STEM",
      "Strong academic record and research potential",
    ],
    link: "https://www.facultyforthefuture.net/",
    tips: "Open to women in STEM regardless of host country — a strong option if you plan a PhD after EJUST.",
  },
  {
    id: "auc-tlp",
    name: "Tomorrow's Leaders Scholarship",
    provider: "American University in Cairo (AUC)",
    country: "Egypt",
    levels: ["Bachelor"],
    fields: "All undergraduate majors",
    funding: "Full",
    fundingDetails: "Full tuition + housing + books + monthly allowance",
    deadline: "2026-12-15",
    eligibility: [
      "Egyptian or regional high-school graduate",
      "Strong academics and demonstrated leadership",
      "Financial need considered",
    ],
    link: "https://www.aucegypt.edu/admissions/tomorrows-leaders-scholarship",
    tips: "Best fit for siblings/friends applying to undergrad — leadership and community service are weighted as heavily as grades.",
  },
  {
    id: "ejust-ra",
    name: "EJUST Research Assistantship",
    provider: "Egypt-Japan University of Science and Technology",
    country: "Egypt",
    levels: ["Master", "PhD"],
    fields: "Engineering, science, and IT — aligned with EJUST labs",
    funding: "Stipend",
    fundingDetails: "Monthly stipend + tuition waiver (lab-dependent)",
    deadline: "2027-06-30",
    deadlineNote: "Rolling — positions open when labs secure funding",
    eligibility: [
      "Strong bachelor's GPA in a relevant field",
      "Research topic matching an active EJUST lab",
      "Interview with the supervising professor",
    ],
    link: "https://www.ejust.edu.eg/",
    tips: "Talk to professors whose labs you like before the formal call — most assistantships are filled through direct contact.",
  },
];

export function daysUntil(iso: string, now = new Date()): number {
  const target = new Date(`${iso}T23:59:59`);
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

export function formatDeadline(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
