"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  X,
  Car,
  DoorOpen,
  Building2,
  Landmark,
} from "lucide-react";
import {
  CAMPUS,
  allEntities,
  type Coordinates,
  type EntityKind,
  type PlanEntity,
} from "@/lib/campusTypes";

const DEFAULT_VIEW = { x: 0, y: 0, w: 108, h: 104 };
const MIN_W = 28;
const MAX_W = DEFAULT_VIEW.w;

const METERS_PER_UNIT = 14;
const WALK_SPEED_MPS = 1.3;

const SPINE_X = 53;

function planDistance(a: Coordinates, b: Coordinates): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function walkEstimate(from: Coordinates, to: Coordinates) {
  const meters = Math.max(10, Math.round((planDistance(from, to) * METERS_PER_UNIT) / 10) * 10);
  return { meters, min: Math.max(1, Math.round(meters / (WALK_SPEED_MPS * 60))) };
}

function compass(dx: number, dy: number): string {
  const ns = dy < -1 ? "north" : dy > 1 ? "south" : "";
  const ew = dx > 1 ? "east" : dx < -1 ? "west" : "";
  if (ns && ew) return `${ns}-${ew}`;
  return ns || ew || "ahead";
}

function nearestOf<T extends { coordinates: Coordinates }>(items: T[], p: Coordinates): T {
  return items.reduce((best, item) =>
    planDistance(item.coordinates, p) < planDistance(best.coordinates, p) ? item : best
  );
}

function routePoints(from: Coordinates, to: Coordinates): Coordinates[] {
  const pts: Coordinates[] = [{ ...from }];
  if (Math.abs(from.x - SPINE_X) > 0.5) pts.push({ x: SPINE_X, y: from.y });
  if (Math.abs(from.y - to.y) > 0.5) pts.push({ x: SPINE_X, y: to.y });
  pts.push({ ...to });
  return pts.filter(
    (p, i) => i === 0 || Math.abs(p.x - pts[i - 1].x) > 0.01 || Math.abs(p.y - pts[i - 1].y) > 0.01
  );
}

const ZONE_TIPS: Record<string, string[]> = {
  "Central Academic": [
    "Room numbers encode the floor (e.g., 204 = floor 2, room 04).",
    "Check the entrance notice board for last-minute room changes.",
  ],
  "North Academic Grid": [
    "Enter from the north spine next to North Parking Hub.",
    "Most first- and second-year lectures are scheduled here.",
  ],
  "West Academic Grid": [
    "Park at West Upper Hub — the buildings are a 2-minute walk away.",
    "Studios and workshops are on the ground floors.",
  ],
  "South Academic Grid": [
    "Closest parking is South Hub; South Gate 02 is 3 minutes away.",
    "Labs occupy the ground floor; lecture rooms are above.",
  ],
  "West Extension": [
    "Park at West Lower Hub and follow the west access road.",
    "Some facilities here are still being commissioned — check access first.",
  ],
};

const DEFAULT_TIPS = [
  "Check opening hours before you go.",
  "Ask at the main desk if you can't find the room.",
];

const KIND_META: Record<
  EntityKind,
  { label: string; icon: typeof Building2; filterLabel: string }
> = {
  landmark: { label: "Landmark", icon: Landmark, filterLabel: "Landmarks" },
  building: { label: "Building", icon: Building2, filterLabel: "Buildings" },
  gate: { label: "Gate", icon: DoorOpen, filterLabel: "Gates" },
  parking: { label: "Parking", icon: Car, filterLabel: "Parking" },
};

const COLOR_HEX: Record<string, string> = {
  blue: "#2563eb",
  red: "#dc2626",
  yellow: "#d97706",
  green: "#059669",
};

const CATEGORY_FALLBACK: Record<string, string> = {
  Administration: "#2563eb",
  Faculty: "#dc2626",
  Facility: "#0891b2",
  Sports: "#059669",
  Housing: "#7c3aed",
};

function markerFill(e: PlanEntity): string {
  if (e.markerColor && COLOR_HEX[e.markerColor]) return COLOR_HEX[e.markerColor];
  if (e.kind === "landmark" && e.category && CATEGORY_FALLBACK[e.category])
    return CATEGORY_FALLBACK[e.category];
  if (e.kind === "gate") return "#111827";
  if (e.kind === "parking") return "#4b5563";
  return "#e5e7eb";
}

function markerText(e: PlanEntity): string {
  return markerFill(e) === "#e5e7eb" ? "#374151" : "#ffffff";
}

const ROADS: [number, number][][] = [
  [
    [53, 12],
    [53, 90],
  ],
  [
    [96, 50],
    [53, 50],
  ],
  [
    [53, 90],
    [58, 92],
  ],
  [
    [14, 41],
    [40, 41],
    [53, 41],
  ],
  [
    [14, 56],
    [40, 56],
    [53, 56],
  ],
  [
    [23, 18],
    [53, 18],
  ],
  [
    [22, 72],
    [22, 74],
    [40, 74],
    [53, 74],
  ],
  [
    [90, 50],
    [67, 50],
  ],
];

const ZONE_LABELS: { text: string; x: number; y: number }[] = [
  { text: "NORTH ACADEMIC GRID", x: 50.5, y: 20 },
  { text: "CENTRAL ACADEMIC", x: 58.8, y: 63.8 },
  { text: "WEST ACADEMIC GRID", x: 26, y: 39.5 },
  { text: "SOUTH ACADEMIC GRID", x: 50.5, y: 65.5 },
  { text: "WEST EXTENSION", x: 8.5, y: 33.5 },
  { text: "RESIDENTIAL", x: 23, y: 18.5 },
  { text: "SPORTS ZONE", x: 22, y: 78 },
];

export default function MasterPlan() {
  const entities = useMemo(() => allEntities(CAMPUS), []);
  const [query, setQuery] = useState("");
  const [activeKinds, setActiveKinds] = useState<Set<EntityKind>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [view, setView] = useState(DEFAULT_VIEW);
  const svgRef = useRef<SVGSVGElement>(null);
  const panRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = svg!.getBoundingClientRect();
      setView((v) => {
        const scale = Math.min(rect.width / v.w, rect.height / v.h);
        const offX = (rect.width - v.w * scale) / 2;
        const offY = (rect.height - v.h * scale) / 2;
        const px = v.x + (e.clientX - rect.left - offX) / scale;
        const py = v.y + (e.clientY - rect.top - offY) / scale;
        const factor = e.deltaY > 0 ? 1.12 : 0.89;
        const newW = Math.min(MAX_W, Math.max(MIN_W, v.w * factor));
        const ratio = newW / v.w;
        return {
          x: px - (px - v.x) * ratio,
          y: py - (py - v.y) * ratio,
          w: newW,
          h: v.h * ratio,
        };
      });
    }
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, []);

  const selected = entities.find((e) => e.id === selectedId) ?? null;
  const hovered = entities.find((e) => e.id === hoveredId) ?? null;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entities.filter((e) => {
      if (activeKinds.size > 0 && !activeKinds.has(e.kind)) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        (e.zone ?? "").toLowerCase().includes(q) ||
        (e.category ?? "").toLowerCase().includes(q)
      );
    });
  }, [entities, query, activeKinds]);

  const visibleIds = useMemo(() => new Set(visible.map((e) => e.id)), [visible]);

  function toggleKind(kind: EntityKind) {
    setActiveKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  function selectEntity(e: PlanEntity) {
    setSelectedId(e.id);
    setShowRoute(false);
    setView({
      x: e.coordinates.x - DEFAULT_VIEW.w / 4,
      y: e.coordinates.y - DEFAULT_VIEW.h / 4,
      w: DEFAULT_VIEW.w / 2,
      h: DEFAULT_VIEW.h / 2,
    });
  }

  const directions = useMemo(() => {
    if (!selected) return null;
    const gate = nearestOf(CAMPUS.gates, selected.coordinates);
    const parking = nearestOf(CAMPUS.parkingHubs, selected.coordinates);
    const walk = walkEstimate(gate.coordinates, selected.coordinates);
    const dx = selected.coordinates.x - gate.coordinates.x;
    const dy = selected.coordinates.y - gate.coordinates.y;
    return {
      gate,
      parking,
      walk,
      direction: compass(dx, dy),
      parkingWalk: walkEstimate(parking.coordinates, selected.coordinates),
      points: routePoints(gate.coordinates, selected.coordinates),
    };
  }, [selected]);

  const tips = useMemo(() => {
    if (!selected) return [];
    if (selected.tips?.length) return selected.tips;
    if (selected.zone && ZONE_TIPS[selected.zone]) return ZONE_TIPS[selected.zone];
    return DEFAULT_TIPS;
  }, [selected]);

  const routeActive =
    showRoute && selected !== null && (selected.kind === "building" || selected.kind === "landmark");

  const zoom = useCallback((factor: number, cx?: number, cy?: number) => {
    setView((v) => {
      const newW = Math.min(MAX_W, Math.max(MIN_W, v.w * factor));
      const ratio = newW / v.w;
      const center = cx !== undefined && cy !== undefined ? { x: cx, y: cy } : { x: v.x + v.w / 2, y: v.y + v.h / 2 };
      const newH = v.h * ratio;
      return {
        x: center.x - (center.x - v.x) * ratio,
        y: center.y - (center.y - v.y) * ratio,
        w: newW,
        h: newH,
      };
    });
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    panRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    setIsPanning(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    const pan = panRef.current;
    if (!pan || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scale = Math.min(rect.width / view.w, rect.height / view.h);
    setView((v) => ({
      ...v,
      x: pan.vx - (e.clientX - pan.x) / scale,
      y: pan.vy - (e.clientY - pan.y) / scale,
    }));
  }

  function onPointerUp(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    panRef.current = null;
    setIsPanning(false);
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] w-full flex-col overflow-hidden bg-gray-50 md:flex-row">
      <aside className="flex max-h-[35vh] w-full shrink-0 flex-col border-b border-gray-200 bg-white md:max-h-none md:w-72 md:border-b-0 md:border-r">
        <div className="border-b border-gray-100 p-3">
          <h1 className="text-sm font-bold text-gray-900">{CAMPUS.name}</h1>
          <div className="relative mt-2">
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search buildings, zones, gates…"
              className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-2 text-sm outline-none focus:border-blue-400"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {(["landmark", "building", "gate", "parking"] as EntityKind[]).map((kind) => {
              const active = activeKinds.has(kind);
              return (
                <button
                  key={kind}
                  onClick={() => toggleKind(kind)}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium transition ${
                    active
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {KIND_META[kind].filterLabel}
                </button>
              );
            })}
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto p-2">
          {visible.map((e) => {
            const KindIcon = KIND_META[e.kind].icon;
            return (
              <li key={e.id}>
                <button
                  onClick={() => selectEntity(e)}
                  className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                    selectedId === e.id
                      ? "bg-blue-50 text-blue-800"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: markerFill(e) }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{e.name}</span>
                    <span className="block truncate text-[11px] text-gray-400">
                      {e.zone ?? e.category ?? e.location ?? KIND_META[e.kind].label}
                    </span>
                  </span>
                  <KindIcon size={13} className="shrink-0 text-gray-300" />
                </button>
              </li>
            );
          })}
          {visible.length === 0 && (
            <li className="px-2 py-6 text-center text-sm text-gray-400">No matches.</li>
          )}
        </ul>
        <div className="border-t border-gray-100 px-3 py-2 text-[11px] text-gray-400">
          {visible.length} of {entities.length} places · scroll to zoom, drag to pan
        </div>
      </aside>

      <div
        className="relative min-h-0 min-w-0 flex-1"
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
      >
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full select-none touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <rect
            x={view.x}
            y={view.y}
            width={view.w}
            height={view.h}
            fill="#f8fafc"
          />
          {/* campus boundary */}
          <rect
            x={3}
            y={10}
            width={94}
            height={84}
            rx={4}
            fill="#ffffff"
            stroke="#cbd5e1"
            strokeWidth={0.5}
          />
          {/* roads */}
          {ROADS.map((road, i) => (
            <polyline
              key={i}
              points={road.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {/* walking route from nearest gate */}
          {routeActive && directions && (
            <>
              <polyline
                points={directions.points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#2563eb"
                strokeWidth={0.9}
                strokeDasharray="2 1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.9}
              />
              <circle
                cx={selected.coordinates.x}
                cy={selected.coordinates.y}
                r={4}
                fill="none"
                stroke="#2563eb"
                strokeWidth={0.5}
                opacity={0.8}
              />
            </>
          )}

          {/* garden hint at campus heart */}
          <circle cx={44} cy={48} r={5.5} fill="#ecfdf5" stroke="#a7f3d0" strokeWidth={0.4} />
          <text x={44} y={48.6} textAnchor="middle" fontSize={2} fill="#6ee7b7">
            GARDEN
          </text>

          {ZONE_LABELS.map((z) => (
            <text
              key={z.text}
              x={z.x}
              y={z.y}
              textAnchor="middle"
              fontSize={1.7}
              fontWeight={600}
              fill="#94a3b8"
              letterSpacing={0.15}
            >
              {z.text}
            </text>
          ))}

          {entities.map((e) => {
            const isVisible = visibleIds.has(e.id);
            const isSelected = selectedId === e.id;
            const isHovered = hoveredId === e.id;
            const dimmed = routeActive && !isSelected;
            const opacity = !isVisible ? 0.18 : dimmed ? 0.25 : 1;
            const fill = markerFill(e);
            const textColor = markerText(e);

            if (e.kind === "building") {
              const w = e.size?.w ?? 6;
              const h = e.size?.h ?? 4.5;
              const x = e.coordinates.x - w / 2;
              const y = e.coordinates.y - h / 2;
              return (
                <g
                  key={e.id}
                  opacity={opacity}
                  onPointerEnter={() => setHoveredId(e.id)}
                  onPointerLeave={() => setHoveredId(null)}
                  onClick={() => {
                    if (isVisible) {
                      setSelectedId(e.id);
                      setShowRoute(false);
                    }
                  }}
                  style={{ cursor: isVisible ? "pointer" : "default" }}
                >
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    rx={0.7}
                    fill={isSelected ? "#bfdbfe" : isHovered ? "#dbeafe" : fill === "#e5e7eb" ? "#e5e7eb" : fill}
                    stroke={isSelected ? "#2563eb" : isHovered ? "#60a5fa" : "#9ca3af"}
                    strokeWidth={isSelected ? 0.7 : 0.35}
                  />
                  <text
                    x={e.coordinates.x}
                    y={e.coordinates.y + 0.7}
                    textAnchor="middle"
                    fontSize={1.8}
                    fontWeight={700}
                    fill={fill === "#e5e7eb" ? "#374151" : "#ffffff"}
                    pointerEvents="none"
                  >
                    {e.id}
                  </text>
                </g>
              );
            }

            const r = e.kind === "parking" ? 2.4 : 2.8;
            const letter =
              e.kind === "parking"
                ? "P"
                : e.kind === "gate"
                  ? "G"
                  : e.name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("");
            return (
              <g
                key={e.id}
                opacity={opacity}
                onPointerEnter={() => setHoveredId(e.id)}
                onPointerLeave={() => setHoveredId(null)}
                onClick={() => {
                  if (isVisible) {
                    setSelectedId(e.id);
                    setShowRoute(false);
                  }
                }}
                style={{ cursor: isVisible ? "pointer" : "default" }}
              >
                {isSelected && (
                  <circle
                    cx={e.coordinates.x}
                    cy={e.coordinates.y}
                    r={r + 1.2}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth={0.5}
                  />
                )}
                <circle
                  cx={e.coordinates.x}
                  cy={e.coordinates.y}
                  r={r}
                  fill={fill}
                  stroke={isHovered ? "#111827" : "#ffffff"}
                  strokeWidth={0.45}
                />
                <text
                  x={e.coordinates.x}
                  y={e.coordinates.y + 0.75}
                  textAnchor="middle"
                  fontSize={e.kind === "gate" ? 1.8 : 1.9}
                  fontWeight={700}
                  fill={textColor}
                  pointerEvents="none"
                >
                  {letter}
                </text>
                <text
                  x={e.coordinates.x}
                  y={e.coordinates.y + r + 2.2}
                  textAnchor="middle"
                  fontSize={1.6}
                  fontWeight={600}
                  fill="#334155"
                  pointerEvents="none"
                >
                  {e.name.length > 24 ? e.id : e.name}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="absolute right-3 top-3 flex flex-col gap-1.5">
          <button
            onClick={() => zoom(0.8)}
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 shadow-sm hover:bg-gray-50"
            aria-label="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => zoom(1.25)}
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 shadow-sm hover:bg-gray-50"
            aria-label="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={() => {
              setView(DEFAULT_VIEW);
              setSelectedId(null);
              setShowRoute(false);
            }}
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 shadow-sm hover:bg-gray-50"
            aria-label="Reset view"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-white/95 px-2.5 py-1.5 text-[11px] text-gray-600 shadow-sm">
          <LegendItem color="#2563eb" label="Admin" />
          <LegendItem color="#dc2626" label="Faculty" />
          <LegendItem color="#0891b2" label="Facility" />
          <LegendItem color="#059669" label="Sports" />
          <LegendItem color="#7c3aed" label="Housing" />
          <LegendItem color="#111827" label="Gate" />
          <LegendItem color="#4b5563" label="Parking" />
          <LegendItem color="#e5e7eb" label="Building" border />
        </div>

        {hovered && selectedId !== hovered.id && (
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-lg bg-gray-900 px-2.5 py-1 text-xs font-medium text-white shadow">
            {hovered.name}
          </div>
        )}

        {!selected && (
          <div className="absolute bottom-3 right-3 w-72 max-w-[calc(100%-1.5rem)] rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <p className="text-sm font-semibold text-gray-900">Plan your trip</p>
            <ol className="mt-1.5 list-inside list-decimal space-y-1 text-xs text-gray-600">
              <li>Pick a building, landmark, or gate on the plan.</li>
              <li>See the nearest gate, walking time, and driving option.</li>
              <li>Tap “Show walking route” for step-by-step directions.</li>
            </ol>
          </div>
        )}

        {selected && (
          <div className="absolute bottom-3 right-3 flex max-h-[calc(100%-1.5rem)] w-80 max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
            <div className="flex items-start justify-between gap-2 border-b border-gray-100 p-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {selected.id} · {KIND_META[selected.kind].label}
                </p>
                <h2 className="mt-0.5 text-sm font-bold text-gray-900">{selected.name}</h2>
                {(selected.zone || selected.category || selected.location) && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    {[selected.zone, selected.category, selected.location]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedId(null);
                  setShowRoute(false);
                }}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close details"
              >
                <X size={14} />
              </button>
            </div>

            <div className="overflow-y-auto p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                What you can do here
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-600">
                {selected.description ?? "No description yet."}
              </p>

              {directions && (selected.kind === "building" || selected.kind === "landmark") && (
                <div className="mt-3 rounded-lg bg-blue-50 p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                    Getting there
                  </p>
                  <ul className="mt-1.5 space-y-1 text-xs text-blue-900">
                    <li className="flex items-start gap-1.5">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                      <span>
                        Enter via <strong>{directions.gate.name}</strong> ({directions.gate.location}) —{" "}
                        {directions.walk.min} min walk ({directions.walk.meters} m)
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                      <span>
                        Follow the main campus road <strong>{directions.direction}</strong>, then look
                        for <strong>{selected.zone ?? selected.category ?? selected.id}</strong>
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                      <span>
                        Driving? Park at <strong>{directions.parking.name}</strong> —{" "}
                        {directions.parkingWalk.min} min walk to the entrance
                      </span>
                    </li>
                  </ul>
                  <button
                    onClick={() => setShowRoute((v) => !v)}
                    className={`mt-2 w-full rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                      showRoute
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-white text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100"
                    }`}
                  >
                    {showRoute ? "Hide walking route" : "Show walking route on map"}
                  </button>
                </div>
              )}

              {tips.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Before you go
                  </p>
                  <ul className="mt-1.5 space-y-1 text-xs text-gray-600">
                    {tips.map((t) => (
                      <li key={t} className="flex items-start gap-1.5">
                        <span className="mt-0.5 text-green-600">✓</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-3 text-[11px] text-gray-400">
                Plan position: x={selected.coordinates.x.toFixed(1)}, y=
                {selected.coordinates.y.toFixed(1)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LegendItem({
  color,
  label,
  border,
}: {
  color: string;
  label: string;
  border?: boolean;
}) {
  return (
    <span className="flex items-center gap-1">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: color, border: border ? "1px solid #9ca3af" : undefined }}
      />
      {label}
    </span>
  );
}
