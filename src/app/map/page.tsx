"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { CampusLocation, Category, Review } from "@/lib/types";
import { LOCATIONS } from "@/data/locations";
import LocationSidebar from "@/components/LocationSidebar";
import LocationDetail from "@/components/LocationDetail";

const CampusMap = dynamic(() => import("@/components/CampusMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100 text-sm text-gray-500">
      Loading map…
    </div>
  ),
});

const REVIEWS_STORAGE_KEY = "ejust-navigator-reviews-v1";

export default function Home() {
  const [reviewsByLocation, setReviewsByLocation] = useState<
    Record<string, Review[]>
  >(() => Object.fromEntries(LOCATIONS.map((l) => [l.id, l.reviews])));
  const [query, setQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(
    new Set()
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Merge locally saved reviews (persists across refreshes, no backend needed).
  // Deferred to a timeout so hydration stays consistent with the server snapshot.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(REVIEWS_STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as Record<string, Review[]>;
        setReviewsByLocation((prev) => {
          const next = { ...prev };
          for (const [locationId, reviews] of Object.entries(saved)) {
            const seed = next[locationId] ?? [];
            const existingIds = new Set(seed.map((r) => r.id));
            next[locationId] = [
              ...reviews.filter((r) => !existingIds.has(r.id)),
              ...seed,
            ];
          }
          return next;
        });
      } catch {
        // corrupted storage — fall back to seed data
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const locations: CampusLocation[] = useMemo(
    () =>
      LOCATIONS.map((l) => ({ ...l, reviews: reviewsByLocation[l.id] ?? [] })),
    [reviewsByLocation]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return locations.filter((loc) => {
      if (activeCategories.size > 0 && !activeCategories.has(loc.category))
        return false;
      if (!q) return true;
      const haystack = [
        loc.name,
        loc.description,
        ...loc.tags,
        ...loc.reviews.flatMap((r) => [r.comment, r.tip ?? "", r.author]),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [locations, query, activeCategories]);

  const selected = locations.find((l) => l.id === selectedId) ?? null;

  function toggleCategory(c: Category) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  function addReview(locationId: string, review: Omit<Review, "id">) {
    const newReview: Review = { ...review, id: `local-${Date.now()}` };
    setReviewsByLocation((prev) => {
      const next = {
        ...prev,
        [locationId]: [newReview, ...(prev[locationId] ?? [])],
      };
      try {
        const raw = window.localStorage.getItem(REVIEWS_STORAGE_KEY);
        const saved: Record<string, Review[]> = raw ? JSON.parse(raw) : {};
        saved[locationId] = [newReview, ...(saved[locationId] ?? [])];
        window.localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(saved));
      } catch {
        // storage full or unavailable — review still lives in session state
      }
      return next;
    });
  }

  return (
    <main className="flex h-[calc(100vh-3rem)] w-full overflow-hidden bg-gray-50">
      <LocationSidebar
        locations={filtered}
        allCount={LOCATIONS.length}
        query={query}
        onQueryChange={setQuery}
        activeCategories={activeCategories}
        onToggleCategory={toggleCategory}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <div className="relative flex-1">
        <CampusMap
          locations={filtered}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        {selected && (
          <LocationDetail
            location={selected}
            onClose={() => setSelectedId(null)}
            onAddReview={addReview}
          />
        )}
      </div>
    </main>
  );
}
