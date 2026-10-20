"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CampusLocation } from "@/lib/types";
import { categoryMeta } from "@/lib/types";
import { CAMPUS_CENTER } from "@/data/locations";

function createIcon(color: string, selected: boolean) {
  const size = selected ? 22 : 16;
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;
      background:${color};transform:rotate(-45deg);
      border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);
      ${selected ? "outline:3px solid rgba(0,0,0,.25);" : ""}
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

function FitBounds({ locations }: { locations: CampusLocation[] }) {
  const map = useMap();
  useEffect(() => {
    if (locations.length === 0) return;
    const bounds = L.latLngBounds(locations.map((l) => l.position));
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [locations, map]);
  return null;
}

export default function CampusMap({
  locations,
  selectedId,
  onSelect,
}: {
  locations: CampusLocation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <MapContainer
      center={CAMPUS_CENTER}
      zoom={17}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds locations={locations} />
      {locations.map((loc) => (
        <Marker
          key={loc.id}
          position={loc.position}
          icon={createIcon(categoryMeta(loc.category).color, loc.id === selectedId)}
          eventHandlers={{ click: () => onSelect(loc.id) }}
        >
          <Popup>
            <div className="min-w-40">
              <p className="font-semibold text-sm">{loc.name}</p>
              <button
                className="mt-1 text-xs text-blue-600 underline cursor-pointer"
                onClick={() => onSelect(loc.id)}
              >
                View details &amp; reviews
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
