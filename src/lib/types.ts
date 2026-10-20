export type Category =
  | "lecture-hall"
  | "admin"
  | "cafeteria"
  | "quiet-study"
  | "library"
  | "lab"
  | "sports"
  | "housing";

export interface Review {
  id: string;
  author: string;
  rating: number; // 1–5
  comment: string;
  tip?: string;
  createdAt: string; // ISO date
}

export interface CampusLocation {
  id: string;
  name: string;
  category: Category;
  description: string;
  position: [number, number]; // [lat, lng]
  hours: string;
  tags: string[];
  reviews: Review[];
}

export const CATEGORIES: { id: Category; label: string; color: string }[] = [
  { id: "lecture-hall", label: "Lecture Halls", color: "#2563eb" },
  { id: "admin", label: "Admin Offices", color: "#7c3aed" },
  { id: "cafeteria", label: "Cafeterias", color: "#ea580c" },
  { id: "quiet-study", label: "Quiet Study", color: "#059669" },
  { id: "library", label: "Libraries", color: "#0891b2" },
  { id: "lab", label: "Labs", color: "#dc2626" },
  { id: "sports", label: "Sports", color: "#db2777" },
  { id: "housing", label: "Dorms", color: "#4d7c0f" },
];

export function categoryMeta(id: Category) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}
