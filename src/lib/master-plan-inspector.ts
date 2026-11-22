/**
 * Pure Building Inspector helpers: deterministic office assignments from the
 * existing faculty directory, unified search and URL deep links.
 *
 * No browser or network APIs are used here so the mapping and search rules can
 * be unit-tested and reused by both the map and the faculty directory.
 */

import {
  BUILDING_DETAILS,
  canonicalBuildingCode,
  findBuildingDetail,
  searchBuildingDetails,
  type BuildingDetail,
} from "../data/building-inspector.ts";
import { buildRoomSchedule } from "./free-rooms.ts";
import { decodeFloor } from "./room-parser.ts";

export type InspectorTab = "overview" | "rooms" | "offices";

const INSPECTOR_TABS: readonly InspectorTab[] = ["overview", "rooms", "offices"];

export interface FacultyRecord {
  id: number | string;
  full_name: string;
  academic_rank?: string | null;
  faculty_school?: string | null;
  department?: string | null;
  email?: string | null;
  research_interests?: string | null;
  profile_url?: string | null;
}

export interface FacultyOffice {
  id: string;
  facultyId: string;
  name: string;
  title: string;
  department: string;
  school: string;
  email: string;
  building: string;
  floor: number;
  officeNumber: string;
  officeHours: { day: string; start: string; end: string }[];
  officeHoursNote: string;
}

export interface MasterPlanLocation {
  building: string;
  tab: InspectorTab;
  room: string;
  office: string;
  q: string;
}

export interface InspectorHrefInput {
  building: string;
  tab?: InspectorTab;
  room?: string;
  office?: string;
  q?: string;
  hash?: string;
}

export interface MasterPlanSearchResult {
  kind: "building" | "room" | "office";
  id: string;
  label: string;
  detail: string;
  buildingCode: string;
  tab: InspectorTab;
  highlight: string;
}

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Group the 76 directory departments into the academic buildings that host them. */
function departmentBuilding(member: FacultyRecord): string {
  const haystack = normalize(`${member.department ?? ""} ${member.faculty_school ?? ""}`);
  if (/electricalpower|epe/.test(haystack)) return "B09";
  if (/medicalengineering/.test(haystack)) return "B09";
  if (/electronics|communications|ece/.test(haystack)) return "B08";
  if (/computerscience|informationtechnology|cse|csit/.test(haystack)) return "B07";
  if (/biotechnolog/.test(haystack)) return "B10";
  if (/nanoscience|nan/.test(haystack)) return "B10";
  if (/appliedandcomputationalmathematics|mathematics|acm/.test(haystack)) return "B10";
  if (/energymaterials|space|ema/.test(haystack)) return "B10";
  if (/energyresources|ere/.test(haystack)) return "B17";
  if (/environmentalengineering/.test(haystack)) return "B17";
  if (/chemical|petrochemical|cpe/.test(haystack)) return "B18";
  if (/manufacturing|industrial|ime/.test(haystack)) return "B19";
  if (/mechatronics|mte/.test(haystack)) return "B20";
  if (/aerospace|ase/.test(haystack)) return "B20";
  if (/materialsscience|mse/.test(haystack)) return "B20";

  const school = normalize(member.faculty_school);
  if (/ecce/.test(school)) return "B08";
  if (/ebce/.test(school)) return "B17";
  if (/ide/.test(school)) return "B19";
  if (/bas/.test(school)) return "B10";
  if (/csit/.test(school)) return "B07";
  return "B10";
}

function institutionalEmail(email: string | null | undefined): string {
  const value = (email ?? "").trim();
  return value.toLocaleLowerCase().endsWith("@ejust.edu.eg") ? value : "info@ejust.edu.eg";
}

function floorCount(building: string): number {
  const floors = findBuildingDetail(building)?.floors.filter((floor) => /^F\d+$/.test(floor)) ?? [];
  return floors.length || 3;
}

/**
 * Enrich existing `/api/faculty` rows with stable building, floor and office
 * assignments. Offices are deterministic per building so a faculty page link
 * and the map inspector always resolve to the same card.
 */
export function mapFacultyToOffices(members: FacultyRecord[]): FacultyOffice[] {
  const counters = new Map<string, number>();
  return members
    .slice()
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((member) => {
      const building = departmentBuilding(member);
      const index = counters.get(building) ?? 0;
      counters.set(building, index + 1);
      const floor = (index % floorCount(building)) + 1;
      const officeNumber = `${floor}${String(10 + index * 2).padStart(2, "0")}`;
      return {
        id: `faculty-${member.id}`,
        facultyId: String(member.id),
        name: member.full_name,
        title: member.academic_rank ?? "Faculty",
        department: member.department ?? "",
        school: member.faculty_school ?? "",
        email: institutionalEmail(member.email),
        building,
        floor,
        officeNumber,
        officeHours: [],
        officeHoursNote: "",
      };
    });
}

export function buildingOffices(offices: FacultyOffice[], building: string): FacultyOffice[] {
  const code = canonicalBuildingCode(building);
  return offices
    .filter((office) => canonicalBuildingCode(office.building) === code)
    .toSorted(
      (a, b) =>
        a.floor - b.floor ||
        a.officeNumber.localeCompare(b.officeNumber) ||
        a.name.localeCompare(b.name),
    );
}

export interface OfficeSearchOptions {
  building?: string;
  floor?: string | number;
}

/** Search the enriched directory by name, title, department, email or office. */
export function searchFacultyOffices(
  offices: FacultyOffice[],
  query: string,
  options: OfficeSearchOptions = {},
): FacultyOffice[] {
  const key = normalize(query);
  const building = options.building ? canonicalBuildingCode(options.building) : null;
  const floor = options.floor === undefined || options.floor === "all" ? null : String(options.floor);

  return offices
    .filter((office) => {
      if (building && canonicalBuildingCode(office.building) !== building) return false;
      if (floor && String(office.floor) !== floor) return false;
      if (!key) return true;
      return [
        office.name,
        office.title,
        office.department,
        office.school,
        office.email,
        office.officeNumber,
        `Floor ${office.floor}`,
      ].some((value) => normalize(value).includes(key));
    })
    .toSorted(
      (a, b) =>
        a.building.localeCompare(b.building) ||
        a.floor - b.floor ||
        a.officeNumber.localeCompare(b.officeNumber) ||
        a.name.localeCompare(b.name),
    );
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Parse server-supplied or native-history search params into inspector state. */
export function parseMasterPlanLocation(
  params: Record<string, string | string[] | undefined>,
): MasterPlanLocation {
  const building = canonicalBuildingCode(firstParam(params.building)) ?? "";
  const room = firstParam(params.room).trim();
  const office = firstParam(params.office).trim();
  const q = firstParam(params.q).trim();
  const requestedTab = firstParam(params.tab).trim();
  const tab: InspectorTab = INSPECTOR_TABS.includes(requestedTab as InspectorTab)
    ? (requestedTab as InspectorTab)
    : room
      ? "rooms"
      : office
        ? "offices"
        : "overview";
  return { building, tab, room, office, q };
}

/** Build a shareable deep link; omitted values are left out of the query. */
export function inspectorHref(link: InspectorHrefInput): string {
  const params = new URLSearchParams();
  if (link.building) params.set("building", link.building);
  if (link.tab) params.set("tab", link.tab);
  if (link.room) params.set("room", link.room);
  if (link.office) params.set("office", link.office);
  if (link.q) params.set("q", link.q);
  const query = params.toString();
  const hash = link.hash ? `#${link.hash.replace(/^#/, "")}` : "";
  return `/master-plan${query ? `?${query}` : ""}${hash}`;
}

export function facultyOfficeHref(office: FacultyOffice): string {
  return inspectorHref({ building: office.building, tab: "offices", office: office.id });
}

interface RoomCandidate {
  key: string;
  building: string;
  room: string;
  label: string;
  floor: string;
  kinds?: string[];
}

function allRoomCandidates(): RoomCandidate[] {
  const candidates = new Map<string, RoomCandidate>();
  for (const schedule of buildRoomSchedule().values()) {
    const building = canonicalBuildingCode(schedule.building) ?? schedule.building;
    const key = `${building}|${schedule.room.toUpperCase()}`;
    candidates.set(key, {
      key,
      building,
      room: schedule.room,
      label: `${schedule.building} · ${schedule.room}`,
      floor: decodeFloor(schedule.room),
      kinds: [decodeFloor(schedule.room), ...schedule.slots.map((slot) => slot.title)],
    });
  }
  for (const building of BUILDING_DETAILS) {
    for (const room of building.rooms) {
      const key = `${building.code}|${room.code.toUpperCase()}`;
      const existing = candidates.get(key);
      if (existing) {
        (existing.kinds ??= []).push(...Object.values(room.label));
        continue;
      }
      candidates.set(key, {
        key,
        building: building.code,
        room: room.code,
        label: `${building.code} · ${room.code}`,
        floor: decodeFloor(room.code),
        kinds: Object.values(room.label),
      });
    }
  }
  return [...candidates.values()];
}

const RESULT_ORDER: Record<MasterPlanSearchResult["kind"], number> = {
  building: 0,
  room: 1,
  office: 2,
};

/** One search box for building names/codes, rooms/labs and faculty offices. */
export function searchMasterPlan(
  query: string,
  offices: FacultyOffice[],
  rooms: RoomCandidate[] = allRoomCandidates(),
): MasterPlanSearchResult[] {
  if (!query.trim()) return [];

  const results: MasterPlanSearchResult[] = [];
  for (const building of searchBuildingDetails(query)) {
    results.push({
      kind: "building",
      id: building.code,
      label: building.name.en,
      detail: `${building.code} · ${building.floors.length} floors`,
      buildingCode: building.code,
      tab: "overview",
      highlight: building.code,
    });
  }

  for (const room of rooms) {
    const detail: BuildingDetail | null = findBuildingDetail(room.building);
    const haystack = [
      room.building,
      room.room,
      room.label,
      room.floor,
      ...(detail ? Object.values(detail.name) : []),
      ...(room.kinds ?? []),
    ];
    if (!haystack.some((value) => value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))) continue;
    results.push({
      kind: "room",
      id: room.key,
      label: room.label,
      detail: `${room.floor} · ${canonicalBuildingCode(room.building) ?? room.building}`,
      buildingCode: room.building,
      tab: "rooms",
      highlight: room.room,
    });
  }

  for (const office of searchFacultyOffices(offices, query)) {
    results.push({
      kind: "office",
      id: office.id,
      label: office.name,
      detail: `${office.building} · Floor ${office.floor} · Office ${office.officeNumber}`,
      buildingCode: office.building,
      tab: "offices",
      highlight: office.id,
    });
  }

  return results
    .toSorted(
      (a, b) =>
        RESULT_ORDER[a.kind] - RESULT_ORDER[b.kind] ||
        a.buildingCode.localeCompare(b.buildingCode) ||
        a.label.localeCompare(b.label),
    )
    .slice(0, 15);
}
