import campusDataJson from "@/data/campusData.json";

export interface Coordinates {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface Gate {
  id: string;
  name: string;
  type: "main_entrance" | "secondary_entrance";
  location: string;
  coordinates: Coordinates;
  description?: string;
  tips?: string[];
}

export interface ParkingHub {
  id: string;
  name: string;
  coordinates: Coordinates;
  description?: string;
  tips?: string[];
}

export interface Landmark {
  id: string;
  name: string;
  category: string;
  markerColor?: string;
  location?: string;
  coordinates: Coordinates;
  description?: string;
  tips?: string[];
}

export interface Building {
  id: string;
  name: string;
  zone: string;
  markerColor?: string;
  coordinates: Coordinates;
  size?: Size;
  description?: string;
  tips?: string[];
}

export interface Campus {
  name: string;
  gates: Gate[];
  parkingHubs: ParkingHub[];
  landmarks: Landmark[];
  buildings: Building[];
}

export type CampusData = { campus: Campus };

export const CAMPUS: Campus = (campusDataJson as { campus: Campus }).campus;

export type EntityKind = "building" | "landmark" | "gate" | "parking";

export interface PlanEntity {
  id: string;
  name: string;
  kind: EntityKind;
  category?: string;
  zone?: string;
  location?: string;
  description?: string;
  tips?: string[];
  markerColor?: string;
  coordinates: Coordinates;
  size?: Size;
}

export function allEntities(campus: Campus): PlanEntity[] {
  const buildings: PlanEntity[] = campus.buildings.map((b) => ({
    id: b.id,
    name: b.name,
    kind: "building",
    zone: b.zone,
    description: b.description,
    tips: b.tips,
    markerColor: b.markerColor,
    coordinates: b.coordinates,
    size: b.size,
  }));
  const landmarks: PlanEntity[] = campus.landmarks.map((l) => ({
    id: l.id,
    name: l.name,
    kind: "landmark",
    category: l.category,
    location: l.location,
    description: l.description,
    tips: l.tips,
    markerColor: l.markerColor,
    coordinates: l.coordinates,
  }));
  const gates: PlanEntity[] = campus.gates.map((g) => ({
    id: g.id,
    name: g.name,
    kind: "gate",
    category: g.type === "main_entrance" ? "Main Entrance" : "Secondary Entrance",
    location: g.location,
    description: g.description,
    tips: g.tips,
    coordinates: g.coordinates,
  }));
  const parking: PlanEntity[] = campus.parkingHubs.map((p) => ({
    id: p.id,
    name: p.name,
    kind: "parking",
    category: "Parking",
    description: p.description,
    tips: p.tips,
    coordinates: p.coordinates,
  }));
  return [...landmarks, ...buildings, ...gates, ...parking];
}
