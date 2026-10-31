"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, Building2, CircleDot, Crosshair, LocateFixed,
  MapPin, Navigation, Search, X, Zap,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import CampusBackground from "@/components/CampusBackground";

type MapCategory = "academic" | "services" | "dining" | "housing";
type NodeId = "admin" | "library" | "faculty" | "housing" | "sports" | "gate";

type CampusNode = {
  id: NodeId;
  labelKey: "admin" | "library" | "faculty" | "studentHousing" | "sports" | "gate";
  descriptionKey:
    | "adminDescription" | "libraryDescription" | "facultyDescription"
    | "studentHousingDescription" | "sportsDescription" | "gateDescription";
  category: MapCategory;
  x: number;
  y: number;
  floors: string[];
};

const NODES: CampusNode[] = [
  { id: "admin", labelKey: "admin", descriptionKey: "adminDescription", category: "services", x: 18, y: 29, floors: ["Ground · Registration", "1 · Student affairs", "2 · Administration"] },
  { id: "library", labelKey: "library", descriptionKey: "libraryDescription", category: "academic", x: 43, y: 20, floors: ["Ground · Collections", "1 · Quiet study", "2 · Research desks"] },
  { id: "faculty", labelKey: "faculty", descriptionKey: "facultyDescription", category: "academic", x: 64, y: 38, floors: ["Ground · Lecture halls", "1 · Engineering labs", "2 · Faculty offices"] },
  { id: "housing", labelKey: "studentHousing", descriptionKey: "studentHousingDescription", category: "housing", x: 77, y: 73, floors: ["Ground · Commons", "1–3 · Residence", "4 · Study lounge"] },
  { id: "sports", labelKey: "sports", descriptionKey: "sportsDescription", category: "dining", x: 42, y: 78, floors: ["Ground · Courts", "1 · Fitness studio", "2 · Wellness room"] },
  { id: "gate", labelKey: "gate", descriptionKey: "gateDescription", category: "services", x: 12, y: 83, floors: ["Gatehouse · Security", "Arrival · Shuttle stop"] },
];

const EDGES: Array<[NodeId, NodeId]> = [
  ["gate", "admin"], ["admin", "library"], ["library", "faculty"],
  ["faculty", "housing"], ["housing", "sports"], ["sports", "gate"],
];

const CATEGORY_COLORS: Record<MapCategory, string> = {
  academic: "#44d9ff", services: "#b28cff", dining: "#ffc857", housing: "#58e6a3",
};

export default function MapPage() {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MapCategory | "all">("all");
  const [selectedId, setSelectedId] = useState<NodeId | null>(null);
  const [fromId, setFromId] = useState<NodeId | "">("");
  const [toId, setToId] = useState<NodeId | "">("");

  const visibleNodes = useMemo(() => NODES.filter((node) => {
    const label = t(`map.${node.labelKey}`).toLowerCase();
    return (category === "all" || node.category === category) && (!query.trim() || label.includes(query.trim().toLowerCase()));
  }), [category, query, t]);
  const selected = NODES.find((node) => node.id === selectedId) ?? null;
  const routeNodes = fromId && toId ? NODES.filter((node) => node.id === fromId || node.id === toId) : [];

  function chooseNode(id: NodeId) {
    setSelectedId(id);
    if (!fromId) setFromId(id);
    else if (!toId && id !== fromId) setToId(id);
  }

  return (
    <main className="campus-life-page relative min-h-[calc(100vh-3rem)] overflow-hidden bg-slate-50/80 text-slate-900 dark:bg-slate-950/85 dark:text-slate-100">
      <CampusBackground image="/images/campus/architecture.jpg.png" />
      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[1500px] flex-col gap-4 p-4 lg:p-6">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-cyan-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_14px_#44d9ff]" />
              E-JUST / SPATIAL NETWORK
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{t("map.title")}</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-300">{t("map.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-slate-950/65 px-3 py-2 text-xs text-cyan-200 backdrop-blur-xl">
            <Zap size={14} /> 06 zones online <span className="text-slate-500">·</span> 2.4 km campus grid
          </div>
        </section>

        <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[270px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3 shadow-2xl backdrop-blur-xl">
            <label className="relative">
              <Search size={16} className="absolute left-3 top-3 text-slate-500" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("map.search")} className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60" />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(["all", "academic", "services", "dining", "housing"] as const).map((item) => (
                <button key={item} type="button" onClick={() => setCategory(item)} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${category === item ? "bg-cyan-300 text-slate-950 shadow-[0_0_16px_rgb(68_217_255/35%)]" : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"}`}>
                  {t(`map.${item === "all" ? "all" : item}`)}
                </button>
              ))}
            </div>
            <div className="mt-2 border-t border-white/10 pt-3">
              <p className="mb-2 text-[10px] font-semibold tracking-[0.14em] text-slate-500">BUILDING SIGNALS</p>
              <div className="space-y-1">
                {visibleNodes.map((node) => (
                  <button key={node.id} type="button" onClick={() => chooseNode(node.id)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${selectedId === node.id ? "bg-cyan-300/10 text-cyan-200" : "text-slate-300 hover:bg-white/5"}`}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[node.category], boxShadow: `0 0 10px ${CATEGORY_COLORS[node.category]}` }} />
                    <span className="truncate">{t(`map.${node.labelKey}`)}</span>
                    <span className="ml-auto text-[10px] text-slate-600">{node.floors.length}F</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-auto rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-400">
              <div className="flex items-center gap-2 text-cyan-200"><Crosshair size={14} /> Click a node to inspect</div>
              <p className="mt-2 leading-5">Select two buildings to draw a walking vector across the campus grid.</p>
            </div>
          </aside>

          <div className="relative min-h-[520px] overflow-hidden rounded-2xl border border-cyan-200/20 bg-slate-950/70 shadow-2xl backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(rgb(68 217 255 / 8%) 1px, transparent 1px), linear-gradient(90deg, rgb(68 217 255 / 8%) 1px, transparent 1px)", backgroundSize: "42px 42px" }} />
            <div className="absolute left-4 top-4 z-10 rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 font-mono text-[10px] text-slate-400">
              GRID 30.1562°N / 31.8289°E <span className="ml-3 text-emerald-300">● LIVE</span>
            </div>
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full p-8" role="img" aria-label={t("map.title")}>
              <defs>
                <filter id="hud-glow"><feGaussianBlur stdDeviation="0.8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>
              <path d="M 12 83 L 18 29 L 43 20 L 64 38 L 77 73 L 42 78 Z" fill="none" stroke="rgb(68 217 255 / 14%)" strokeWidth="0.3" strokeDasharray="1 1" />
              {EDGES.map(([a, b]) => {
                const start = NODES.find((node) => node.id === a)!;
                const end = NODES.find((node) => node.id === b)!;
                const active = routeNodes.some((node) => node.id === a) && routeNodes.some((node) => node.id === b);
                return <line key={`${a}-${b}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={active ? "#44d9ff" : "rgb(148 163 184 / 25%)"} strokeWidth={active ? "1.1" : "0.35"} strokeDasharray={active ? "2 1" : "1 2"} filter={active ? "url(#hud-glow)" : undefined} />;
              })}
              {NODES.map((node) => {
                const visible = visibleNodes.some((item) => item.id === node.id);
                const active = selectedId === node.id || fromId === node.id || toId === node.id;
                return <g key={node.id} onClick={() => chooseNode(node.id)} className={visible ? "cursor-pointer" : "pointer-events-none opacity-20"} role="button" aria-label={t(`map.${node.labelKey}`)}>
                  <circle cx={node.x} cy={node.y} r={active ? 4.7 : 3.2} fill="rgb(2 6 23 / 85%)" stroke={CATEGORY_COLORS[node.category]} strokeWidth={active ? "0.9" : "0.55"} filter="url(#hud-glow)" />
                  <circle cx={node.x} cy={node.y} r={active ? 2 : 1.3} fill={CATEGORY_COLORS[node.category]} />
                  <text x={node.x + 5} y={node.y - 4} fill="white" fontSize="2.8" fontWeight={active ? "700" : "500"}>{t(`map.${node.labelKey}`)}</text>
                </g>;
              })}
            </svg>
            <div className="absolute bottom-4 left-4 flex items-center gap-3 rounded-lg border border-white/10 bg-slate-950/75 px-3 py-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-300" /> Academic</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-300" /> Services</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-300" /> Housing</span>
            </div>
            {selected && (
              <aside className="absolute inset-y-0 right-0 z-20 w-full max-w-sm overflow-y-auto border-l border-cyan-200/20 bg-slate-950/95 p-5 shadow-2xl backdrop-blur-2xl">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs font-semibold tracking-[0.14em] text-cyan-300">ZONE PROFILE</p><h2 className="mt-2 text-2xl font-semibold text-white">{t(`map.${selected.labelKey}`)}</h2></div>
                  <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg p-2 text-slate-500 hover:bg-white/10 hover:text-white" aria-label="Close"><X size={18} /></button>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{t(`map.${selected.descriptionKey}`)}</p>
                <div className="mt-6"><p className="text-xs font-semibold text-slate-300">{t("map.floors")}</p><div className="mt-2 space-y-2">{selected.floors.map((floor) => <div key={floor} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">{floor}</div>)}</div></div>
                <div className="mt-6"><p className="text-xs font-semibold text-slate-300">{t("map.actions")}</p><div className="mt-2 grid gap-2"><button type="button" onClick={() => setFromId(selected.id)} className="flex items-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-left text-sm text-cyan-200 hover:bg-cyan-300/20"><ArrowUp size={15} />{t("map.start")}</button><button type="button" onClick={() => setToId(selected.id)} className="flex items-center gap-2 rounded-lg border border-violet-300/25 bg-violet-300/10 px-3 py-2 text-left text-sm text-violet-200 hover:bg-violet-300/20"><ArrowDown size={15} />{t("map.arrive")}</button></div></div>
              </aside>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/75 p-3 shadow-2xl backdrop-blur-xl sm:p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-200"><Navigation size={16} className="text-cyan-300" /> {t("map.route")}</div>
            <select value={fromId} onChange={(event) => setFromId(event.target.value as NodeId | "")} className="min-w-40 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-300/60"><option value="">{t("map.from")}</option>{NODES.map((node) => <option key={node.id} value={node.id}>{t(`map.${node.labelKey}`)}</option>)}</select>
            <select value={toId} onChange={(event) => setToId(event.target.value as NodeId | "")} className="min-w-40 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-300/60"><option value="">{t("map.to")}</option>{NODES.map((node) => <option key={node.id} value={node.id}>{t(`map.${node.labelKey}`)}</option>)}</select>
            <button type="button" onClick={() => { setFromId(""); setToId(""); }} className="rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-white/10 hover:text-white">{t("map.clear")}</button>
            {fromId && toId && <span className="flex items-center gap-1 text-xs text-emerald-300"><LocateFixed size={14} /> Route highlighted</span>}
          </div>
        </section>
      </div>
    </main>
  );
}
