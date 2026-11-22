/**
 * Pure helpers for turning the room strings used by SIS, exams and the
 * assistant into stable campus deep links. No React or browser APIs here so
 * the same rules can be unit-tested and reused on the server.
 */

export interface ParsedRoom {
  buildingCode: string;
  roomCode: string;
  floorLabel: string;
}

export const FLOOR_LABEL = {
  ground: "Ground Floor",
  basement: "Basement",
  first: "First Floor",
  second: "Second Floor",
  third: "Third Floor",
  upper: "Upper Floor",
  unknown: "Floor not specified",
} as const;

const ORDINAL: Record<number, string> = {
  1: FLOOR_LABEL.first,
  2: FLOOR_LABEL.second,
  3: FLOOR_LABEL.third,
};

/** Decode the E-JUST room-code prefixes (G08, F1.20, B01, ...). */
export function decodeFloor(roomCode: string | null | undefined): string {
  const code = (roomCode ?? "").trim();
  if (/^G\s*\d*/i.test(code)) return FLOOR_LABEL.ground;
  if (/^B\s*\d{2,}/i.test(code)) return FLOOR_LABEL.basement;
  const floor = /^F\s*(\d+)/i.exec(code);
  if (floor) {
    const number = Number(floor[1]);
    return ORDINAL[number] ?? (number > 0 ? `${number}th Floor` : FLOOR_LABEL.unknown);
  }
  return FLOOR_LABEL.unknown;
}

const BUILDING_ALIASES: Record<string, string> = {
  coe: "CoE",
  collegeofengineering: "CoE",
  engineeringlabs: "CoE",
  lib: "LIB",
  library: "LIB",
  centrallibrary: "LIB",
  mainlibrary: "LIB",
  admin: "ADMIN",
  administration: "ADMIN",
  dorm: "DORM",
  dorms: "DORM",
  dormitories: "DORM",
  housing: "DORM",
  cafeteria: "FOOD",
  food: "FOOD",
  foodcourt: "FOOD",
  gate: "GATE",
};

const ROOM_PATTERN = /^(?:G\s*\d*|F\s*\d+[._-]?\d*[A-Z]?|B\s*\d{2,}[A-Z]?|\d{3,}[A-Z]?)(?:[._/-][A-Z0-9]+)*$/i;

function normalizedToken(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildingCodeFromToken(token: string): string | null {
  const key = normalizedToken(token);
  if (BUILDING_ALIASES[key]) return BUILDING_ALIASES[key];
  const numbered = /^b(\d{1,2})$/.exec(key);
  if (numbered) {
    const number = Number(numbered[1]);
    if (number >= 1 && number <= 30) return `B${number}`;
  }
  return null;
}

function normalizeLocation(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/[|,;·]+/g, " ")
    .replace(/\b(?:building|bldg\.?)\s*(\d{1,2})\b/gi, "B$1")
    .replace(/\bmain\s+gate\b/gi, "GATE")
    .replace(/\bmain\s+library\b/gi, "LIB")
    .replace(/\bfood\s+court\b/gi, "FOOD")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse a location string into the building, room and human-readable floor.
 * Returns null when the text has no recognizable building + room pair, so
 * callers can fall back to rendering the original text.
 */
export function parseRoomLocation(value: string | null | undefined): ParsedRoom | null {
  const tokens = normalizeLocation(value).split(" ").filter(Boolean);
  if (!tokens.length) return null;

  let buildingIndex = -1;
  let buildingCode: string | null = null;
  for (let index = 0; index < tokens.length; index += 1) {
    const code = buildingCodeFromToken(tokens[index]);
    if (code) {
      buildingCode = code;
      buildingIndex = index;
      break;
    }
  }
  if (!buildingCode) return null;

  let roomCode: string | null = null;
  for (let index = buildingIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (ROOM_PATTERN.test(token)) {
      roomCode = token.toUpperCase();
      break;
    }
  }
  if (!roomCode) return null;

  return { buildingCode, roomCode, floorLabel: decodeFloor(roomCode) };
}

/** The deep link consumed by /master-plan's room finder. */
export function roomMapHref(room: ParsedRoom): string {
  const params = new URLSearchParams({ building: room.buildingCode, room: room.roomCode });
  return `/master-plan?${params.toString()}`;
}

export function roomHrefFromLocation(value: string | null | undefined): string | null {
  const parsed = parseRoomLocation(value);
  return parsed ? roomMapHref(parsed) : null;
}
