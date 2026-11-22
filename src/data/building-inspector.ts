/**
 * Enrichment data for the schematic Master Plan.
 *
 * `campusData.json` remains the source of truth for pin positions. This file
 * adds localized names, departments, facilities, floors and room hints used by
 * the Building Inspector. Unknown buildings still get a generic fallback in
 * the inspector so every map pin remains actionable.
 */

export type LocalizedText = Record<"en" | "ar" | "ja", string>;
export type BuildingRoomKind = "lecture" | "tutorial" | "lab" | "facility";

export interface BuildingRoomSeed {
  code: string;
  kind: BuildingRoomKind;
  label: LocalizedText;
}

export interface BuildingDetail {
  code: string;
  aliases: string[];
  name: LocalizedText;
  description: LocalizedText;
  floors: string[];
  departments: LocalizedText[];
  amenities: LocalizedText[];
  rooms: BuildingRoomSeed[];
}

const text = (en: string, ar: string, ja: string): LocalizedText => ({ en, ar, ja });

const DEPARTMENTS = {
  cse: text("Computer Science & Engineering", "هندسة الحاسوب ونظم المعلومات", "情報工学"),
  csit: text("Computer Science & IT", "علوم الحاسوب وتكنولوجيا المعلومات", "情報科学・情報技術"),
  ece: text("Electronics & Communications Engineering", "هندسة الإلكترونيات والاتصالات", "電子・通信工学"),
  epe: text("Electrical Power Engineering", "هندسة القوى الكهربائية", "電力工学"),
  medical: text("Medical Engineering", "الهندسة الطبية", "医療工学"),
  basic: text("Basic & Applied Sciences", "العلوم الأساسية والتطبيقية", "基礎・応用科学"),
  energy: text("Energy Resources Engineering", "هندسة موارد الطاقة", "エネルギー資源工学"),
  environment: text("Environmental Engineering", "الهندسة البيئية", "環境工学"),
  chemical: text("Chemical & Petrochemical Engineering", "الهندسة الكيميائية والبتروكيماوية", "化学・石油化学工学"),
  manufacturing: text("Industrial & Manufacturing Engineering", "الهندسة الصناعية والتصنيع", "産業・製造工学"),
  mechatronics: text("Mechatronics Engineering", "هندسة الميكاترونيكا", "メカトロニクス工学"),
  aerospace: text("Aerospace Engineering", "هندسة الطيران والفضاء", "航空宇宙工学"),
  materials: text("Materials Science Engineering", "هندسة علوم المواد", "材料科学工学"),
  engineering: text("Engineering Workshops", "ورش الهندسة", "工学実習工場"),
  library: text("Library & Study Services", "خدمات المكتبة والدراسة", "図書館・学習サービス"),
  studentAffairs: text("Student Affairs", "شؤون الطلاب", "学生事務"),
  housing: text("Student Housing", "سكن الطلاب", "学生寮"),
  dining: text("Dining Services", "خدمات الطعام", "飲食サービス"),
  security: text("Campus Security", "أمن الحرم", "キャンパス警備"),
} as const;

const AMENITIES = {
  lecture: text("Lecture halls", "قاعات المحاضرات", "講義室"),
  tutorial: text("Tutorial rooms", "قاعات الدروس", "演習室"),
  labs: text("Research and teaching labs", "معامل البحث والتدريس", "研究・教育ラボ"),
  study: text("Quiet study areas", "مناطق مذاكرة هادئة", "静かな自習エリア"),
  library: text("Library and reference desk", "المكتبة ومكتب المراجع", "図書館・参考台"),
  prayer: text("Prayer room", "غرفة الصلاة", "礼拝室"),
  cafeteria: text("Cafeteria / vending", "كافتيريا / ماكينات مشروبات", "食堂・自動販売機"),
  accessible: text("Step-free access and lifts", "مدخل بدون درجات ومصاعد", "段差のない出入口・エレベーター"),
  maker: text("Maker and project spaces", "مساحات المشاريع والتصنيع", "ものづくりスペース"),
  Welcome: text("Reception and help desk", "مكتب الاستقبال والمساعدة", "受付・案内台"),
  parking: text("Short-stay drop-off", "منطقة إنزال قصيرة", "短時間乗降エリア"),
} as const;

function roomLabel(kind: BuildingRoomKind, code: string): LocalizedText {
  if (kind === "lecture") return text(`Lecture hall ${code}`, `قاعة المحاضرات ${code}`, `講義室 ${code}`);
  if (kind === "tutorial") return text(`Tutorial room ${code}`, `قاعة دروس ${code}`, `演習室 ${code}`);
  if (kind === "lab") return text(`Lab ${code}`, `معمل ${code}`, `ラボ ${code}`);
  return text(`Service room ${code}`, `غرفة خدمات ${code}`, `サービスルーム ${code}`);
}

function seedRooms(floors: string[]): BuildingRoomSeed[] {
  const rooms: BuildingRoomSeed[] = [];
  floors.forEach((floor, index) => {
    if (floor === "G") {
      rooms.push(
        { code: "G01", kind: "lecture", label: roomLabel("lecture", "G01") },
        { code: "G02", kind: "lab", label: roomLabel("lab", "G02") },
      );
    } else if (floor === "B01") {
      rooms.push({ code: "B01", kind: "facility", label: roomLabel("facility", "B01") });
    } else if (/^F\d+$/.test(floor)) {
      rooms.push(
        { code: `${floor}.01`, kind: index % 2 === 0 ? "lecture" : "tutorial", label: roomLabel(index % 2 === 0 ? "lecture" : "tutorial", `${floor}.01`) },
        { code: `${floor}.02`, kind: "lab", label: roomLabel("lab", `${floor}.02`) },
      );
    }
  });
  return rooms;
}

function detail(
  code: string,
  aliases: string[],
  name: LocalizedText,
  description: LocalizedText,
  floors: string[],
  departments: LocalizedText[],
  amenities: LocalizedText[],
  rooms: BuildingRoomSeed[] = seedRooms(floors),
): BuildingDetail {
  return { code, aliases, name, description, floors, departments, amenities, rooms };
}

const academicDescription = (specialty: LocalizedText): LocalizedText =>
  text(
    `Academic building housing ${specialty.en.toLowerCase()} teaching spaces, labs and academic offices.`,
    `مبنى أكاديمي يضم قاعات التدريس والمعامل ومكاتب ${specialty.ar} وتدريسها.`,
    `${specialty.ja}の講義室・ラボ・教員室を備えた学術棟。`,
  );

const genericDescription = (code: string): LocalizedText =>
  text(
    `Teaching and project building ${code} in the campus grid. Check the floor directory before you go.`,
    `مبنى تدريس ومشاريع ${code} داخل شبكة الحرم. راجع دليل الطوابق قبل الذهاب.`,
    `キャンパス内の教育・プロジェクト棟 ${code}。訪問前に階案内を確認してください。`,
  );

const standardAmenities = [AMENITIES.lecture, AMENITIES.tutorial, AMENITIES.prayer, AMENITIES.accessible];
const labAmenities = [AMENITIES.lecture, AMENITIES.labs, AMENITIES.prayer, AMENITIES.accessible];

function paddedCode(number: number): string {
  return `B${String(number).padStart(2, "0")}`;
}

const numberedBuilding = (number: number, nameSuffix?: LocalizedText): BuildingDetail => {
  const code = paddedCode(number);
  const name = nameSuffix ?? text(`Academic Building ${code}`, `المبنى الأكاديمي ${code}`, `学術棟 ${code}`);
  return detail(
    code,
    [`b${number}`],
    name,
    genericDescription(code),
    ["G", "F1", "F2"],
    [DEPARTMENTS.engineering],
    standardAmenities,
  );
};

export const BUILDING_DETAILS: BuildingDetail[] = [
  detail("B1", ["b1"], text("Lecture Hall B1", "قاعة المحاضرات ب1", "講義棟 B1"), genericDescription("B1"), ["G", "F1"], [DEPARTMENTS.engineering], standardAmenities),
  detail("B2", ["b2"], text("Lecture Hall B2", "قاعة المحاضرات ب2", "講義棟 B2"), genericDescription("B2"), ["G", "F1", "F2"], [DEPARTMENTS.engineering], standardAmenities),
  detail("B3", ["b3"], text("Lecture Hall B3", "قاعة المحاضرات ب3", "講義棟 B3"), genericDescription("B3"), ["G", "F1", "F2"], [DEPARTMENTS.engineering], standardAmenities),
  detail("B4", ["b4"], text("Lecture Hall B4", "قاعة المحاضرات ب4", "講義棟 B4"), genericDescription("B4"), ["G", "F1", "F2"], [DEPARTMENTS.engineering], standardAmenities),
  detail("B5", ["b5"], text("Tutorial Building B5", "مبنى الدروس ب5", "演習棟 B5"), genericDescription("B5"), ["G", "F1", "F2"], [DEPARTMENTS.engineering], standardAmenities),
  detail("B6", ["b6"], text("Tutorial Building B6", "مبنى الدروس ب6", "演習棟 B6"), genericDescription("B6"), ["G", "F1", "F2"], [DEPARTMENTS.engineering], standardAmenities),
  detail("B07", ["b7"], text("Computer Science Building", "مبنى علوم الحاسوب", "情報科学棟"), academicDescription(DEPARTMENTS.cse), ["G", "F1", "F2", "B01"], [DEPARTMENTS.cse, DEPARTMENTS.csit], [...labAmenities, AMENITIES.accessible]),
  detail("B08", ["b8"], text("Electronics & Communications Building", "مبنى الإلكترونيات والاتصالات", "電子・通信工学棟"), academicDescription(DEPARTMENTS.ece), ["G", "F1", "F2", "B01"], [DEPARTMENTS.ece], [...labAmenities, AMENITIES.maker]),
  detail("B09", ["b9"], text("Electrical Power Building", "مبنى القوى الكهربائية", "電力工学棟"), academicDescription(DEPARTMENTS.epe), ["G", "F1", "F2", "F3"], [DEPARTMENTS.epe, DEPARTMENTS.medical], [...labAmenities, AMENITIES.study]),
  detail("B10", ["b10"], text("Basic & Applied Sciences Building", "مبنى العلوم الأساسية والتطبيقية", "基礎・応用科学棟"), academicDescription(DEPARTMENTS.basic), ["G", "F1", "F2", "F3"], [DEPARTMENTS.basic], [...labAmenities, AMENITIES.study]),
  detail("B17", ["b17"], text("Energy Resources Building", "مبنى موارد الطاقة", "エネルギー資源棟"), academicDescription(DEPARTMENTS.energy), ["G", "F1", "F2", "F3"], [DEPARTMENTS.energy, DEPARTMENTS.environment], [...labAmenities, AMENITIES.study]),
  detail("B18", ["b18"], text("Chemical Engineering Building", "مبنى الهندسة الكيميائية", "化学工学棟"), academicDescription(DEPARTMENTS.chemical), ["G", "F1", "F2", "F3"], [DEPARTMENTS.chemical], [...labAmenities, AMENITIES.accessible]),
  detail("B19", ["b19"], text("Manufacturing Engineering Building", "مبنى هندسة التصنيع", "製造工学棟"), academicDescription(DEPARTMENTS.manufacturing), ["G", "F1", "F2"], [DEPARTMENTS.manufacturing], [...labAmenities, AMENITIES.maker]),
  detail("B20", ["b20"], text("Mechatronics & Materials Building", "مبنى الميكاترونيكا والمواد", "メカトロニクス・材料棟"), academicDescription(DEPARTMENTS.mechatronics), ["G", "F1", "F2", "F3"], [DEPARTMENTS.mechatronics, DEPARTMENTS.aerospace, DEPARTMENTS.materials], [...labAmenities, AMENITIES.maker]),
  ...Array.from({ length: 11 }, (_, index) => numberedBuilding(21 + index)),
  detail("COE", ["coe", "collegeofengineering", "engineeringlabs"], text("College of Engineering Labs", "معامل كلية الهندسة", "工学部ラボ"), text("Hands-on engineering teaching labs, project bays and technician support desks.", "معامل هندسية للتدريس العملي ومساحات مشاريع ومكاتب فنيين.", "実習用の工学ラボ、プロジェクトスペース、技術者窓口がある棟。"), ["G", "F1", "F2", "B01"], [DEPARTMENTS.engineering], [AMENITIES.labs, AMENITIES.maker, AMENITIES.accessible]),
  detail("LIB", ["lib", "library", "centrallibrary", "mainlibrary"], text("Central Library", "المكتبة الرئيسية", "中央図書館"), text("Quiet study floors, reference desk, group rooms and digital resource terminals.", "طوابق مذاكرة هادئة ومكتب مراجع وقاعات جماعية وأجهزة موارد رقمية.", "静かな自習フロア、参考台、グループ室、デジタル資料端末。"), ["G", "F1", "F2", "F3"], [DEPARTMENTS.library], [AMENITIES.library, AMENITIES.study, AMENITIES.prayer, AMENITIES.accessible]),
  detail("ADMIN", ["admin", "administration"], text("Admin Building", "المبنى الإداري", "管理棟"), text("Registration, student records and administrative help desks.", "مكاتب التسجيل والسجلات الأكاديمية والخدمات الإدارية.", "受付、学生記録、行政窓口がある建物。"), ["G", "F1", "F2"], [DEPARTMENTS.studentAffairs], [AMENITIES.Welcome, AMENITIES.accessible, AMENITIES.prayer]),
  detail("DORM", ["dorm", "dorms", "dormitories", "housing"], text("Student Housing", "سكن الطلاب", "学生寮"), text("Residential blocks with study rooms, laundry and shared amenities.", "وحدات سكنية تضم غرف مذاكرة ومغسلة ومرافق مشتركة.", "自習室・ランドリー・共用設備を備えた学生寮。"), ["G", "F1", "F2"], [DEPARTMENTS.housing], [AMENITIES.study, AMENITIES.cafeteria, AMENITIES.accessible]),
  detail("FOOD", ["food", "foodcourt", "cafeteria"], text("Cafeteria / Food Court", "الكافتيريا / منطقة الطعام", "食堂・フードコート"), text("Main dining area with vending machines and seating for students.", "منطقة الطعام الرئيسية مع ماكينات المشروبات ومقاعد للطلاب.", "学生向けの食堂、自動販売機、座席エリア。"), ["G"], [DEPARTMENTS.dining], [AMENITIES.cafeteria, AMENITIES.accessible]),
  detail("GATE", ["gate", "maingate"], text("Main Gate", "البوابة الرئيسية", "正門"), text("Primary entrance with security check-in and visitor reception.", "المدخل الرئيسي مع نقطة الأمن واستقبال الزوار.", "警備確認と来訪者受付がある正面玄関。"), ["G"], [DEPARTMENTS.security], [AMENITIES.Welcome, AMENITIES.parking, AMENITIES.accessible]),
];

const CODE_ALIASES: Record<string, string> = Object.fromEntries(
  BUILDING_DETAILS.flatMap((building) => [building.code, ...building.aliases].map((alias) => [normalize(alias), building.code])),
);

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/^(building|bldg)\s*/, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Map the short room-code form (B7) to the schematic pin ID (B07). */
export function canonicalBuildingCode(value: string | null | undefined): string | null {
  const key = normalize(value ?? "");
  if (!key) return null;
  if (CODE_ALIASES[key]) return CODE_ALIASES[key];

  const numbered = /^b(\d{1,2})$/.exec(key);
  if (numbered) {
    const number = Number(numbered[1]);
    if (number >= 1 && number <= 30) return paddedCode(number);
  }
  return key.toUpperCase();
}

const DETAIL_BY_CODE = new Map(BUILDING_DETAILS.map((building) => [building.code, building]));

export function findBuildingDetail(value: string | null | undefined): BuildingDetail | null {
  const code = canonicalBuildingCode(value);
  return code ? DETAIL_BY_CODE.get(code) ?? null : null;
}

/** Search codes, aliases and localized names from the inspector dataset. */
export function searchBuildingDetails(query: string): BuildingDetail[] {
  const raw = query.trim().toLocaleLowerCase();
  const key = normalize(query);
  if (!raw && !key) return [];
  return BUILDING_DETAILS.filter((building) => {
    const haystack = [building.code, ...building.aliases, ...Object.values(building.name)];
    return (
      haystack.some((value) => value.toLocaleLowerCase().includes(raw)) ||
      haystack.some((value) => normalize(value) === key)
    );
  });
}

/** Fallback detail for a valid map code without enriched metadata. */
export function detailForCode(code: string): BuildingDetail {
  return findBuildingDetail(code) ?? {
    code,
    aliases: [],
    name: text(`Building ${code}`, `المبنى ${code}`, `${code}棟`),
    description: genericDescription(code),
    floors: ["G", "F1", "F2"],
    departments: [DEPARTMENTS.engineering],
    amenities: standardAmenities,
    rooms: seedRooms(["G", "F1", "F2"]),
  };
}
