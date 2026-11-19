"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { decodeFloor, parseRoomLocation, roomMapHref } from "@/lib/room-parser";

export function floorTranslationKey(label: string): TranslationKey {
  if (label === "Ground Floor") return "map.floorGround";
  if (label === "Basement") return "map.floorBasement";
  if (label === "First Floor") return "map.floorFirst";
  if (label === "Second Floor") return "map.floorSecond";
  if (label === "Third Floor") return "map.floorThird";
  if (label.endsWith("Floor")) return "map.floorUpper";
  return "map.floorUnknown";
}

export interface RoomBadgeProps {
  /** Combined location string, e.g. "B7 F1.20" or "Building 7, F1.07". */
  location?: string | null;
  /** Explicit building/room pair (used by the map detail card). */
  buildingCode?: string;
  roomCode?: string;
  tone?: "light" | "solid";
  className?: string;
}

export default function RoomBadge({
  location,
  buildingCode,
  roomCode,
  tone = "light",
  className = "",
}: RoomBadgeProps) {
  const { t } = useLanguage();
  const hasPair = Boolean(buildingCode && roomCode);
  const parsed = hasPair
    ? { buildingCode: buildingCode!, roomCode: roomCode!, floorLabel: decodeFloor(roomCode) }
    : parseRoomLocation(location);
  const text = hasPair ? `${buildingCode} ${roomCode}` : location;

  if (!parsed) {
    return text?.trim() ? <span className={`truncate ${className}`}>{text}</span> : null;
  }

  const floorKey = floorTranslationKey(parsed.floorLabel);
  const shell = tone === "solid"
    ? "border-white/35 bg-black/25 text-white hover:bg-black/40"
    : "border-cyan-300/50 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 dark:border-cyan-700/60 dark:bg-cyan-950/40 dark:text-cyan-200 dark:hover:bg-cyan-900/50";

  return (
    <Link
      href={roomMapHref(parsed)}
      title={t("map.viewRoom")}
      aria-label={`${parsed.buildingCode} ${parsed.roomCode} — ${t(floorKey)}`}
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${shell} ${className}`}
    >
      <MapPin size={11} className="shrink-0" />
      <span>{parsed.buildingCode}</span>
      <span className="opacity-60">·</span>
      <span className="truncate">{parsed.roomCode}</span>
      <span className="shrink-0 rounded-full bg-white/25 px-1.5 py-0.5 text-[9px] font-medium">{t(floorKey)}</span>
    </Link>
  );
}
