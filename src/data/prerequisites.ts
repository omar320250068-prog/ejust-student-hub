/**
 * Planning-only prerequisite graphs for the main E-JUST engineering programmes.
 *
 * These datasets are an aid for "what-if" registration planning. They are not
 * the official bylaw and must always be checked with an academic advisor.
 * Every edge points to an earlier semester so the graphs are acyclic by
 * construction; `validateCurriculum` enforces that invariant in tests.
 */

export type Semester = `Sem ${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;

export const SEMESTERS: readonly Semester[] = [
  "Sem 1", "Sem 2", "Sem 3", "Sem 4",
  "Sem 5", "Sem 6", "Sem 7", "Sem 8",
];

export type LocalizedText = Record<"en" | "ar" | "ja", string>;

export interface CourseNode {
  code: string;
  title: string;
  credits: number;
  semester: Semester;
  prerequisites: string[];
  corequisites?: string[];
}

export interface CurriculumProgram {
  id: DepartmentId;
  name: LocalizedText;
  advisory: LocalizedText;
  courses: CourseNode[];
}

export const DEPARTMENT_IDS = ["CSE", "ECE", "MTR", "IEM", "BME"] as const;
export type DepartmentId = (typeof DEPARTMENT_IDS)[number];

/** Shared advisory copied into every programme so the UI can show it verbatim. */
export const PREREQUISITE_ADVISORY: LocalizedText = {
  en: "Advisory: this graph is a planning aid, not the official bylaw. Confirm every prerequisite and corequisite with your academic advisor before registering.",
  ar: "تنبيه: هذا الرسم أداة تخطيط وليس اللائحة الرسمية. تأكد من كل المتطلبات السابقة والمتزامنة مع المرشد الأكاديمي قبل التسجيل.",
  ja: "注意: このグラフは履修計画の補助ツールであり、公式の規則ではありません。履修登録前に必修・同時履修条件を学術アドバイザーに必ず確認してください。",
};

function course(
  code: string,
  title: string,
  credits: number,
  semester: Semester,
  prerequisites: string[] = [],
  corequisites: string[] = [],
): CourseNode {
  return { code, title, credits, semester, prerequisites, corequisites };
}

const cseCurriculum: CourseNode[] = [
  course("CSE101", "Introduction to Computer Science", 3, "Sem 1"),
  course("MATH101", "Calculus I", 3, "Sem 1"),
  course("PHYS101", "Physics I", 3, "Sem 1"),
  course("ENG101", "Technical Writing", 2, "Sem 1"),
  course("CHEM101", "General Chemistry", 2, "Sem 1"),

  course("CSE102", "Data Structures", 3, "Sem 2", ["CSE101"]),
  course("MATH102", "Calculus II", 3, "Sem 2", ["MATH101"]),
  course("PHYS102", "Physics II", 3, "Sem 2", ["PHYS101"]),
  course("CSE103", "Digital Logic", 3, "Sem 2", ["CSE101", "MATH101"]),
  course("ENG102", "Academic Communication", 2, "Sem 2", ["ENG101"]),

  course("CSE211", "Algorithms", 3, "Sem 3", ["CSE102", "MATH102"]),
  course("CSE213", "Computer Architecture", 3, "Sem 3", ["CSE103"]),
  course("MATH211", "Linear Algebra", 3, "Sem 3", ["MATH102"]),
  course("CSE215", "Discrete Mathematics", 3, "Sem 3", ["MATH101"]),
  course("PHYS211", "Electronics", 3, "Sem 3", ["PHYS102"]),
  course("CSE217", "Programming Lab", 1, "Sem 3", ["CSE102"], ["CSE211"]),

  course("CSE221", "Database Systems", 3, "Sem 4", ["CSE211", "CSE215"]),
  course("CSE223", "Operating Systems", 3, "Sem 4", ["CSE213", "CSE211"]),
  course("CSE225", "Software Engineering", 3, "Sem 4", ["CSE211"]),
  course("STAT221", "Probability & Statistics", 3, "Sem 4", ["MATH211"]),
  course("CSE227", "Network Fundamentals", 3, "Sem 4", ["CSE213", "PHYS211"]),
  course("CSE229", "Database Lab", 1, "Sem 4", ["CSE217"], ["CSE221"]),

  course("CSE331", "Advanced Algorithms", 3, "Sem 5", ["CSE221", "CSE223"]),
  course("CSE333", "Computer Networks", 3, "Sem 5", ["CSE227"]),
  course("CSE335", "Database Systems II", 3, "Sem 5", ["CSE221"]),
  course("CSE337", "Software Architecture", 3, "Sem 5", ["CSE225", "CSE223"]),
  course("CSE339", "Computer Security", 3, "Sem 5", ["CSE223", "CSE227"]),
  course("CSE341", "Artificial Intelligence", 3, "Sem 5", ["CSE211", "STAT221"]),

  course("CSE411", "Machine Learning", 3, "Sem 6", ["CSE341", "STAT221", "MATH211"]),
  course("CSE413", "Distributed Systems", 3, "Sem 6", ["CSE333", "CSE331"]),
  course("CSE415", "Cloud Computing", 3, "Sem 6", ["CSE333", "CSE223"]),
  course("CSE417", "Human-Computer Interaction", 3, "Sem 6", ["CSE225"]),
  course("CSE419", "Compiler Design", 3, "Sem 6", ["CSE331", "CSE213"]),
  course("CSE421", "Embedded Systems", 3, "Sem 6", ["CSE213", "PHYS211"]),

  course("CSE511", "Advanced Machine Learning", 3, "Sem 7", ["CSE411"]),
  course("CSE513", "Cybersecurity", 3, "Sem 7", ["CSE339", "CSE333"]),
  course("CSE515", "Big Data Systems", 3, "Sem 7", ["CSE415", "CSE335"]),
  course("CSE517", "Software Project I", 3, "Sem 7", ["CSE337", "CSE331"]),
  course("CSE519", "Computer Graphics", 3, "Sem 7", ["CSE331", "MATH211"]),
  course("CSE521", "Internet of Things", 3, "Sem 7", ["CSE421", "CSE333"]),

  course("CSE611", "Graduation Project", 4, "Sem 8", ["CSE517", "CSE415"]),
  course("CSE613", "Advanced Topics in AI", 3, "Sem 8", ["CSE511"]),
  course("CSE615", "Blockchain Systems", 3, "Sem 8", ["CSE513", "CSE415"]),
  course("CSE617", "Thesis Seminar", 1, "Sem 8", ["CSE517"]),
  course("CSE619", "Digital Forensics", 3, "Sem 8", ["CSE513"]),
  course("CSE621", "Technology Entrepreneurship", 2, "Sem 8", ["CSE225", "CSE337"]),
];

const eceCurriculum: CourseNode[] = [
  course("ECE101", "Introduction to ECE", 3, "Sem 1"),
  course("MATH101", "Calculus I", 3, "Sem 1"),
  course("PHYS101", "Physics I", 3, "Sem 1"),
  course("ENG101", "Technical Writing", 2, "Sem 1"),
  course("CHEM101", "General Chemistry", 2, "Sem 1"),

  course("ECE102", "Circuit Analysis I", 3, "Sem 2", ["ECE101", "MATH101"]),
  course("MATH102", "Calculus II", 3, "Sem 2", ["MATH101"]),
  course("PHYS102", "Physics II", 3, "Sem 2", ["PHYS101"]),
  course("ECE103", "Programming for Engineers", 3, "Sem 2", ["ECE101"]),
  course("ENG102", "Academic Communication", 2, "Sem 2", ["ENG101"]),

  course("ECE211", "Electronics I", 3, "Sem 3", ["ECE102", "PHYS102"]),
  course("ECE213", "Signals & Systems", 3, "Sem 3", ["MATH102", "ECE102"]),
  course("ECE215", "Digital Logic Design", 3, "Sem 3", ["ECE103"]),
  course("MATH211", "Linear Algebra", 3, "Sem 3", ["MATH102"]),
  course("ECE217", "Circuits Lab", 1, "Sem 3", ["ECE102"], ["ECE211"]),

  course("ECE221", "Microelectronics", 3, "Sem 4", ["ECE211"]),
  course("ECE223", "Digital Signal Processing", 3, "Sem 4", ["ECE213", "MATH211"]),
  course("ECE225", "Electromagnetic Fields", 3, "Sem 4", ["PHYS102", "MATH102"]),
  course("ECE227", "Computer Architecture", 3, "Sem 4", ["ECE215"]),
  course("STAT221", "Probability & Statistics", 3, "Sem 4", ["MATH211"]),
  course("ECE229", "Electronics Lab", 1, "Sem 4", ["ECE211"], ["ECE221"]),

  course("ECE331", "Communication Systems", 3, "Sem 5", ["ECE223", "ECE225"]),
  course("ECE333", "Control Systems", 3, "Sem 5", ["ECE213"]),
  course("ECE335", "Embedded Systems", 3, "Sem 5", ["ECE227", "ECE211"]),
  course("ECE337", "VLSI Design", 3, "Sem 5", ["ECE221"]),
  course("ECE339", "Wireless Networks", 3, "Sem 5", ["ECE223", "ECE225"]),
  course("ECE341", "Image Processing", 3, "Sem 5", ["ECE223"]),

  course("ECE411", "Digital Communications", 3, "Sem 6", ["ECE331"]),
  course("ECE413", "Advanced Control", 3, "Sem 6", ["ECE333"]),
  course("ECE415", "Microcontrollers", 3, "Sem 6", ["ECE335"]),
  course("ECE417", "RF Engineering", 3, "Sem 6", ["ECE225", "ECE331"]),
  course("ECE419", "Semiconductor Devices", 3, "Sem 6", ["ECE221"]),
  course("ECE421", "Pattern Recognition", 3, "Sem 6", ["ECE341", "STAT221"]),

  course("ECE511", "Mobile Communications", 3, "Sem 7", ["ECE339", "ECE411"]),
  course("ECE513", "Robotics Control", 3, "Sem 7", ["ECE413", "ECE415"]),
  course("ECE515", "System-on-Chip Design", 3, "Sem 7", ["ECE337", "ECE419"]),
  course("ECE517", "Optical Communications", 3, "Sem 7", ["ECE411", "ECE417"]),
  course("ECE519", "Machine Vision", 3, "Sem 7", ["ECE421"]),
  course("ECE521", "IoT Systems", 3, "Sem 7", ["ECE415", "ECE339"]),

  course("ECE611", "Graduation Project", 4, "Sem 8", ["ECE511", "ECE515"]),
  course("ECE613", "Advanced Wireless Networks", 3, "Sem 8", ["ECE511"]),
  course("ECE615", "Robotics Project", 3, "Sem 8", ["ECE513"]),
  course("ECE617", "Integrated Circuits", 3, "Sem 8", ["ECE515"]),
  course("ECE619", "Signal Processing Project", 3, "Sem 8", ["ECE519"]),
  course("ECE621", "Engineering Entrepreneurship", 2, "Sem 8", ["ECE225"]),
];

const mtrCurriculum: CourseNode[] = [
  course("MTR101", "Introduction to Mechatronics", 3, "Sem 1"),
  course("MATH101", "Calculus I", 3, "Sem 1"),
  course("PHYS101", "Physics I", 3, "Sem 1"),
  course("ENG101", "Technical Writing", 2, "Sem 1"),
  course("CHEM101", "General Chemistry", 2, "Sem 1"),
  course("DRAW101", "Engineering Drawing", 2, "Sem 1"),

  course("MTR102", "Statics & Dynamics", 3, "Sem 2", ["PHYS101", "MATH101"]),
  course("MATH102", "Calculus II", 3, "Sem 2", ["MATH101"]),
  course("PHYS102", "Physics II", 3, "Sem 2", ["PHYS101"]),
  course("MTR103", "Programming for Mechatronics", 3, "Sem 2", ["MTR101"]),
  course("ENG102", "Academic Communication", 2, "Sem 2", ["ENG101"]),
  course("MTR104", "Workshop Practice", 1, "Sem 2", ["DRAW101"]),

  course("MTR211", "Mechanics of Materials", 3, "Sem 3", ["MTR102"]),
  course("MTR213", "Thermodynamics", 3, "Sem 3", ["PHYS102", "MATH102"]),
  course("MTR215", "Digital Logic & Microcontrollers", 3, "Sem 3", ["MTR103"]),
  course("MTR217", "Fluid Mechanics", 3, "Sem 3", ["PHYS102"]),
  course("MATH211", "Linear Algebra", 3, "Sem 3", ["MATH102"]),
  course("MTR219", "Computer-Aided Design", 3, "Sem 3", ["DRAW101"]),

  course("MTR221", "Machine Design", 3, "Sem 4", ["MTR211", "MTR219"]),
  course("MTR223", "Control Systems I", 3, "Sem 4", ["MTR213", "MTR215"]),
  course("MTR225", "Electrical Machines", 3, "Sem 4", ["MTR215"]),
  course("MTR227", "Sensors & Instrumentation", 3, "Sem 4", ["MTR215", "MTR217"]),
  course("STAT221", "Probability & Statistics", 3, "Sem 4", ["MATH211"]),
  course("MTR229", "Manufacturing Processes", 3, "Sem 4", ["MTR211"]),

  course("MTR331", "Robotics Kinematics", 3, "Sem 5", ["MTR221", "MTR223"]),
  course("MTR333", "Dynamic Systems", 3, "Sem 5", ["MTR223"]),
  course("MTR335", "PLC & Automation", 3, "Sem 5", ["MTR225", "MTR227"]),
  course("MTR337", "Finite Element Methods", 3, "Sem 5", ["MTR211", "MATH211"]),
  course("MTR339", "Mechatronic System Design", 3, "Sem 5", ["MTR221", "MTR223"]),
  course("MTR341", "Hydraulics & Pneumatics", 3, "Sem 5", ["MTR217"]),

  course("MTR411", "Advanced Robotics", 3, "Sem 6", ["MTR331"]),
  course("MTR413", "Control Systems II", 3, "Sem 6", ["MTR333"]),
  course("MTR415", "Industrial Automation", 3, "Sem 6", ["MTR335"]),
  course("MTR417", "Smart Manufacturing", 3, "Sem 6", ["MTR229", "MTR335"]),
  course("MTR419", "Computer-Aided Engineering", 3, "Sem 6", ["MTR337", "MTR219"]),
  course("MTR421", "AI for Robots", 3, "Sem 6", ["MTR331", "STAT221"]),

  course("MTR511", "Robot Perception", 3, "Sem 7", ["MTR421", "MTR411"]),
  course("MTR513", "Autonomous Systems", 3, "Sem 7", ["MTR411", "MTR413"]),
  course("MTR515", "Advanced Automation", 3, "Sem 7", ["MTR415"]),
  course("MTR517", "Digital Twin", 3, "Sem 7", ["MTR419", "MTR417"]),
  course("MTR519", "Vibration & Condition Monitoring", 3, "Sem 7", ["MTR333"]),
  course("MTR521", "Entrepreneurship in Robotics", 2, "Sem 7", ["MTR339"]),

  course("MTR611", "Graduation Project", 4, "Sem 8", ["MTR511", "MTR515"]),
  course("MTR613", "Advanced Robot Control", 3, "Sem 8", ["MTR513"]),
  course("MTR615", "Factory Design", 3, "Sem 8", ["MTR417", "MTR515"]),
  course("MTR617", "Research Thesis", 1, "Sem 8", ["MTR517"]),
  course("MTR619", "Predictive Maintenance", 3, "Sem 8", ["MTR519"]),
  course("MTR621", "Technology Innovation", 2, "Sem 8", ["MTR521"]),
];

const iemCurriculum: CourseNode[] = [
  course("IEM101", "Introduction to Industrial Engineering", 3, "Sem 1"),
  course("MATH101", "Calculus I", 3, "Sem 1"),
  course("PHYS101", "Physics I", 3, "Sem 1"),
  course("ENG101", "Technical Writing", 2, "Sem 1"),
  course("CHEM101", "General Chemistry", 2, "Sem 1"),
  course("ECON101", "Microeconomics", 2, "Sem 1"),

  course("IEM102", "Engineering Statistics", 3, "Sem 2", ["MATH101"]),
  course("MATH102", "Calculus II", 3, "Sem 2", ["MATH101"]),
  course("PHYS102", "Physics II", 3, "Sem 2", ["PHYS101"]),
  course("IEM103", "Programming for Engineers", 3, "Sem 2", ["IEM101"]),
  course("ENG102", "Academic Communication", 2, "Sem 2", ["ENG101"]),
  course("ACCT101", "Accounting Principles", 2, "Sem 2", ["ECON101"]),

  course("IEM211", "Probability & Statistics", 3, "Sem 3", ["IEM102", "MATH102"]),
  course("IEM213", "Engineering Economics", 3, "Sem 3", ["ECON101", "ACCT101"]),
  course("IEM215", "Operations Research I", 3, "Sem 3", ["MATH102", "IEM102"]),
  course("IEM217", "Work Study & Methods", 3, "Sem 3", ["IEM101"]),
  course("MATH211", "Linear Algebra", 3, "Sem 3", ["MATH102"]),
  course("IEM219", "Databases for Industry", 3, "Sem 3", ["IEM103"]),

  course("IEM221", "Operations Research II", 3, "Sem 4", ["IEM215", "IEM211"]),
  course("IEM223", "Quality Control", 3, "Sem 4", ["IEM211"]),
  course("IEM225", "Production Planning", 3, "Sem 4", ["IEM217", "IEM215"]),
  course("IEM227", "Supply Chain Fundamentals", 3, "Sem 4", ["IEM213", "IEM215"]),
  course("IEM229", "Human Factors", 3, "Sem 4", ["IEM217"]),
  course("IEM231", "Simulation Basics", 3, "Sem 4", ["IEM211", "IEM103"]),

  course("IEM331", "Lean Manufacturing", 3, "Sem 5", ["IEM225", "IEM223"]),
  course("IEM333", "Supply Chain Design", 3, "Sem 5", ["IEM227", "IEM221"]),
  course("IEM335", "Advanced Quality Engineering", 3, "Sem 5", ["IEM223"]),
  course("IEM337", "Management Information Systems", 3, "Sem 5", ["IEM219", "IEM225"]),
  course("IEM339", "Ergonomics & Safety", 3, "Sem 5", ["IEM229"]),
  course("IEM341", "Forecasting & Demand Planning", 3, "Sem 5", ["IEM211", "IEM231"]),

  course("IEM411", "Six Sigma & Process Improvement", 3, "Sem 6", ["IEM331", "IEM335"]),
  course("IEM413", "Operations Strategy", 3, "Sem 6", ["IEM333", "IEM221"]),
  course("IEM415", "Data Analytics for Operations", 3, "Sem 6", ["IEM231", "IEM337"]),
  course("IEM417", "Enterprise Resource Planning", 3, "Sem 6", ["IEM337", "IEM333"]),
  course("IEM419", "Project Management", 3, "Sem 6", ["IEM213", "IEM225"]),
  course("IEM421", "Advanced Simulation", 3, "Sem 6", ["IEM231", "IEM221"]),

  course("IEM511", "Smart Manufacturing Systems", 3, "Sem 7", ["IEM411", "IEM417"]),
  course("IEM513", "Logistics Optimization", 3, "Sem 7", ["IEM413", "IEM421"]),
  course("IEM515", "Business Intelligence", 3, "Sem 7", ["IEM415"]),
  course("IEM517", "Quality Management Systems", 3, "Sem 7", ["IEM335", "IEM411"]),
  course("IEM519", "Change Management", 3, "Sem 7", ["IEM419"]),
  course("IEM521", "Industrial IoT", 3, "Sem 7", ["IEM417", "IEM331"]),

  course("IEM611", "Graduation Project", 4, "Sem 8", ["IEM511", "IEM513"]),
  course("IEM613", "Advanced Operations Research", 3, "Sem 8", ["IEM421", "IEM413"]),
  course("IEM615", "Supply Chain Analytics", 3, "Sem 8", ["IEM515", "IEM513"]),
  course("IEM617", "Research Seminar", 1, "Sem 8", ["IEM511"]),
  course("IEM619", "Sustainability & Circular Economy", 3, "Sem 8", ["IEM413", "IEM517"]),
  course("IEM621", "Entrepreneurship", 2, "Sem 8", ["IEM419", "IEM213"]),
];

const bmeCurriculum: CourseNode[] = [
  course("BME101", "Introduction to Biomedical Engineering", 3, "Sem 1"),
  course("MATH101", "Calculus I", 3, "Sem 1"),
  course("PHYS101", "Physics I", 3, "Sem 1"),
  course("ENG101", "Technical Writing", 2, "Sem 1"),
  course("CHEM101", "General Chemistry", 2, "Sem 1"),
  course("BIO101", "Biology", 3, "Sem 1"),

  course("BME102", "Biomedical Circuits", 3, "Sem 2", ["BME101", "PHYS101"]),
  course("MATH102", "Calculus II", 3, "Sem 2", ["MATH101"]),
  course("PHYS102", "Physics II", 3, "Sem 2", ["PHYS101"]),
  course("BME103", "Programming for Biomedical Engineers", 3, "Sem 2", ["BME101"]),
  course("CHEM102", "Organic Chemistry", 2, "Sem 2", ["CHEM101"]),
  course("ENG102", "Academic Communication", 2, "Sem 2", ["ENG101"]),

  course("BME211", "Anatomy & Physiology", 3, "Sem 3", ["BIO101"]),
  course("BME213", "Signals & Systems for BME", 3, "Sem 3", ["BME102", "MATH102"]),
  course("BME215", "Biomedical Electronics", 3, "Sem 3", ["BME102", "PHYS102"]),
  course("BME217", "Biomaterials", 3, "Sem 3", ["CHEM102", "BIO101"]),
  course("MATH211", "Linear Algebra", 3, "Sem 3", ["MATH102"]),
  course("BME219", "Medical Imaging Basics", 3, "Sem 3", ["PHYS102", "MATH102"]),

  course("BME221", "Sensors & Measurement", 3, "Sem 4", ["BME215", "BME213"]),
  course("BME223", "Medical Imaging Systems", 3, "Sem 4", ["BME219", "BME213"]),
  course("BME225", "Biomechanics", 3, "Sem 4", ["BME211", "PHYS101"]),
  course("BME227", "Biomedical Signal Processing", 3, "Sem 4", ["BME213", "MATH211"]),
  course("STAT221", "Probability & Statistics", 3, "Sem 4", ["MATH211"]),
  course("BME229", "Biomedical Laboratory", 1, "Sem 4", ["BME215"], ["BME221"]),

  course("BME331", "Digital Signal Processing for BME", 3, "Sem 5", ["BME227"]),
  course("BME333", "Advanced Medical Imaging", 3, "Sem 5", ["BME223"]),
  course("BME335", "Biomedical Instrumentation", 3, "Sem 5", ["BME221", "BME229"]),
  course("BME337", "Biomechanics Modeling", 3, "Sem 5", ["BME225", "MATH211"]),
  course("BME339", "Tissue Engineering", 3, "Sem 5", ["BME217", "BIO101"]),
  course("BME341", "Bioinformatics", 3, "Sem 5", ["BME103", "STAT221"]),

  course("BME411", "Machine Learning for Healthcare", 3, "Sem 6", ["BME331", "BME341"]),
  course("BME413", "Image-Guided Interventions", 3, "Sem 6", ["BME333"]),
  course("BME415", "Wearable Devices", 3, "Sem 6", ["BME335", "BME331"]),
  course("BME417", "Biomolecular Engineering", 3, "Sem 6", ["BME339"]),
  course("BME419", "Clinical Engineering", 3, "Sem 6", ["BME335", "BME221"]),
  course("BME421", "Regulatory Affairs", 2, "Sem 6", ["BME211"]),

  course("BME511", "Computer-Aided Diagnosis", 3, "Sem 7", ["BME411", "BME413"]),
  course("BME513", "Advanced Biomedical Imaging", 3, "Sem 7", ["BME413", "BME333"]),
  course("BME515", "Neuroengineering", 3, "Sem 7", ["BME337", "BME331"]),
  course("BME517", "Rehabilitation Engineering", 3, "Sem 7", ["BME337", "BME415"]),
  course("BME519", "Medical Device Design", 3, "Sem 7", ["BME419", "BME415"]),
  course("BME521", "Healthcare Data Analytics", 3, "Sem 7", ["BME411"]),

  course("BME611", "Graduation Project", 4, "Sem 8", ["BME511", "BME519"]),
  course("BME613", "Radiomics & Imaging AI", 3, "Sem 8", ["BME513", "BME511"]),
  course("BME615", "Neural Interfaces", 3, "Sem 8", ["BME515"]),
  course("BME617", "Biomaterials Project", 3, "Sem 8", ["BME417"]),
  course("BME619", "Clinical Research Methods", 2, "Sem 8", ["BME421", "STAT221"]),
  course("BME621", "Biomedical Innovation", 2, "Sem 8", ["BME519"]),
];

export const DEPARTMENTS: readonly CurriculumProgram[] = [
  {
    id: "CSE",
    name: {
      en: "Computer Science & Engineering",
      ar: "هندسة الحاسوب وهندسة البرمجيات",
      ja: "コンピュータサイエンス・工学",
    },
    advisory: PREREQUISITE_ADVISORY,
    courses: cseCurriculum,
  },
  {
    id: "ECE",
    name: {
      en: "Electronics & Communications",
      ar: "الإلكترونيات والاتصالات",
      ja: "電子・通信工学",
    },
    advisory: PREREQUISITE_ADVISORY,
    courses: eceCurriculum,
  },
  {
    id: "MTR",
    name: {
      en: "Mechatronics & Robotics",
      ar: "الميكاترونكس والروبوتات",
      ja: "メカトロニクス・ロボティクス",
    },
    advisory: PREREQUISITE_ADVISORY,
    courses: mtrCurriculum,
  },
  {
    id: "IEM",
    name: {
      en: "Industrial & Manufacturing",
      ar: "الهندسة الصناعية والتصنيع",
      ja: "産業・生産工学",
    },
    advisory: PREREQUISITE_ADVISORY,
    courses: iemCurriculum,
  },
  {
    id: "BME",
    name: {
      en: "Biomedical Engineering",
      ar: "الهندسة الطبية الحيوية",
      ja: "生体医工学",
    },
    advisory: PREREQUISITE_ADVISORY,
    courses: bmeCurriculum,
  },
];

export function getCurriculum(id: DepartmentId): CurriculumProgram {
  return DEPARTMENTS.find((program) => program.id === id) ?? DEPARTMENTS[0];
}

export function isDepartmentId(value: unknown): value is DepartmentId {
  return typeof value === "string" && (DEPARTMENT_IDS as readonly string[]).includes(value);
}
