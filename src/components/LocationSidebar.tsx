"use client";

import { Search, MapPin } from "lucide-react";
import type { CampusLocation, Category } from "@/lib/types";
import { CATEGORIES, categoryMeta } from "@/lib/types";
import { RatingStars, averageRating } from "./RatingStars";

export default function LocationSidebar({
  locations,
  allCount,
  query,
  onQueryChange,
  activeCategories,
  onToggleCategory,
  selectedId,
  onSelect,
}: {
  locations: CampusLocation[];
  allCount: number;
  query: string;
  onQueryChange: (q: string) => void;
  activeCategories: Set<Category>;
  onToggleCategory: (c: Category) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-100 p-4">
        <h1 className="text-lg font-bold text-gray-900">EJUST Campus Navigator</h1>
        <p className="text-xs text-gray-500">
          Egypt-Japan University of Science &amp; Technology — New Borg El-Arab
        </p>

        <div className="relative mt-3">
          <Search
            size={15}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search locations, tips…"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-8 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => {
            const active = activeCategories.has(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => onToggleCategory(cat.id)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  active
                    ? "text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                style={active ? { backgroundColor: cat.color } : undefined}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <p className="px-2 py-1.5 text-xs text-gray-400">
          {locations.length} of {allCount} locations
        </p>
        {locations.length === 0 && (
          <p className="px-2 py-8 text-center text-sm text-gray-400">
            No locations match your filters.
          </p>
        )}
        <ul className="space-y-1">
          {locations.map((loc) => {
            const meta = categoryMeta(loc.category);
            const avg = averageRating(loc.reviews);
            const selected = loc.id === selectedId;
            return (
              <li key={loc.id}>
                <button
                  onClick={() => onSelect(loc.id)}
                  className={`w-full rounded-lg p-2.5 text-left transition ${
                    selected
                      ? "bg-blue-50 ring-1 ring-blue-200"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {loc.name}
                      </p>
                      <p className="text-xs text-gray-500">{meta.label}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        {avg > 0 ? (
                          <>
                            <RatingStars value={avg} size={11} />
                            <span className="text-xs text-gray-400">
                              ({loc.reviews.length})
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">No reviews yet</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-gray-100 p-3 text-xs text-gray-400">
        <MapPin size={12} className="mr-1 inline" />
        Tap a pin or a list item for reviews & senior tips
      </div>
    </aside>
  );
}
