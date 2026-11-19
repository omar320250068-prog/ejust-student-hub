import type { Locale } from "@/lib/i18n";

/**
 * E-JUST New Borg El Arab campus pins.
 *
 * Campus anchor: 30.8650°N, 29.5750°E (user-verified center). Individual
 * building coordinates are approximate placements laid out around that anchor
 * from the published campus plan; each pin links to Google Maps so students
 * can open the exact navigation target rather than trusting schematic data.
 */
export type CampusCategory = "academic" | "services" | "dining" | "housing";

export interface CampusBuilding {
  code: string;
  name: Record<Locale, string>;
  category: CampusCategory;
  lat: number;
  lng: number;
  /** Room-code prefixes shown in the floor directory (G, F1, B01, ...). */
  floors: string[];
  googleMapsUrl: string;
}

export const CAMPUS_CENTER: [number, number] = [30.865, 29.575];

function mapsUrl(lat: number, lng: number, name: string): string {
  const query = encodeURIComponent(`${name}, E-JUST, New Borg El Arab, Egypt (${lat}, ${lng})`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function building(
  code: string,
  category: CampusCategory,
  lat: number,
  lng: number,
  [en, ar, ja]: [string, string, string],
  floors: string[]
): CampusBuilding {
  return { code, category, lat, lng, floors, name: { en, ar, ja }, googleMapsUrl: mapsUrl(lat, lng, en) };
}

export const CAMPUS_BUILDINGS: CampusBuilding[] = [
  building("B1", "academic", 30.8658, 29.5752, ["Building B1", "المبنى ب1", "B1棟"], ["G", "F1", "F2"]),
  building("B2", "academic", 30.8658, 29.5757, ["Building B2", "المبنى ب2", "B2棟"], ["G", "F1", "F2"]),
  building("B3", "academic", 30.8659, 29.5762, ["Building B3", "المبنى ب3", "B3棟"], ["G", "F1", "F2"]),
  building("B4", "academic", 30.8663, 29.5752, ["Building B4", "المبنى ب4", "B4棟"], ["G", "F1", "F2"]),
  building("B5", "academic", 30.8663, 29.5757, ["Building B5", "المبنى ب5", "B5棟"], ["G", "F1", "F2"]),
  building("B6", "academic", 30.8664, 29.5762, ["Building B6", "المبنى ب6", "B6棟"], ["G", "F1", "F2"]),
  building("B7", "academic", 30.8668, 29.5748, ["Building B7", "المبنى ب7", "B7棟"], ["G", "F1", "F2", "B01"]),
  building("B8", "academic", 30.8668, 29.5754, ["Building B8", "المبنى ب8", "B8棟"], ["G", "F1", "F2", "B01"]),
  building("B9", "academic", 30.8669, 29.576, ["Building B9", "المبنى ب9", "B9棟"], ["G", "F1", "F2"]),
  building("B10", "academic", 30.8672, 29.5754, ["Building B10", "المبنى ب10", "B10棟"], ["G", "F1", "F2"]),
  building("B17", "academic", 30.8642, 29.5764, ["Building B17", "المبنى ب17", "B17棟"], ["G", "F1", "F2", "F3"]),
  building("B18", "academic", 30.8643, 29.577, ["Building B18", "المبنى ب18", "B18棟"], ["G", "F1", "F2", "F3"]),
  building("CoE", "academic", 30.866, 29.574, ["CoE Engineering Labs", "معامل كلية الهندسة", "工学部ラボ"], ["G", "F1", "F2", "B01"]),
  building("LIB", "academic", 30.8652, 29.5745, ["Main Library", "المكتبة الرئيسية", "中央図書館"], ["G", "F1", "F2", "F3"]),
  building("ADMIN", "services", 30.8648, 29.5732, ["Admin Building", "المبنى الإداري", "管理棟"], ["G", "F1", "F2"]),
  building("DORM", "housing", 30.8636, 29.5776, ["Student Dorms", "سكن الطلاب", "学生寮"], ["G", "F1", "F2"]),
  building("FOOD", "dining", 30.864, 29.575, ["Cafeteria / Food Court", "الكافتيريا / منطقة الطعام", "食堂・フードコート"], ["G"]),
  building("GATE", "services", 30.863, 29.5718, ["Main Gate", "البوابة الرئيسية", "正門"], ["G"]),
];

const BY_CODE = new Map(CAMPUS_BUILDINGS.map((item) => [item.code.toUpperCase(), item]));

export function findCampusBuilding(code: string | null | undefined): CampusBuilding | undefined {
  return code ? BY_CODE.get(code.trim().toUpperCase()) : undefined;
}

/** Project a campus pin into the 0–100 SVG viewport used by the map panel. */
export function projectBuilding(item: CampusBuilding): { x: number; y: number } {
  const latitudes = CAMPUS_BUILDINGS.map((entry) => entry.lat);
  const longitudes = CAMPUS_BUILDINGS.map((entry) => entry.lng);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const x = 10 + ((item.lng - minLng) / (maxLng - minLng)) * 80;
  const y = 90 - ((item.lat - minLat) / (maxLat - minLat)) * 80;
  return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
}
