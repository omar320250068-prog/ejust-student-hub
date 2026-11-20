"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown, ArrowUp, Crosshair, ExternalLink, LocateFixed,
  MapPin, Navigation, Search, X, Zap,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import CampusBackground from "@/components/CampusBackground";
import RoomBadge, { floorTranslationKey } from "@/components/RoomBadge";
import {
  CAMPUS_BUILDINGS, CAMPUS_CENTER, findCampusBuilding, projectBuilding,
  type CampusCategory,
} from "@/data/campus-buildings";
import { decodeFloor } from "@/lib/room-parser";

const CATEGORY_COLORS: Record<CampusCategory, string> = {
  academic: "#44d9ff", services: "#b28cff", dining: "#ffc857", housing: "#58e6a3",
};

const CATEGORIES: Array<CampusCategory | "all"> = ["all", "academic", "services", "dining", "housing"];

export default function CampusMapPage() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramBuilding = searchParams.get("building");
  const paramRoom = searchParams.get("room");
  const linkedBuilding = findCampusBuilding(paramBuilding);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CampusCategory | "all">("all");
  const [manualCode, setManualCode] = useState<string | null>(null);
  const [fromCode, setFromCode] = useState("");
  const [toCode, setToCode] = useState("");

  // A room deep link (e.g. /map?building=B18&room=G08) focuses the target pin
  // without needing to synchronize URL state into React state.
  const selectedCode = linkedBuilding?.code ?? manualCode;

  const visibleBuildings = useMemo(() => CAMPUS_BUILDINGS.filter((item) => {
    const text = `${item.code} ${item.name.en} ${item.name.ar} ${item.name.ja}`.toLowerCase();
    return (category === "all" || item.category === category) && (!query.trim() || text.includes(query.trim().toLowerCase()));
  }), [category, query]);

  const visibleCodes = useMemo(() => {
    const codes = new Set(visibleBuildings.map((item) => item.code));
    if (linkedBuilding) codes.add(linkedBuilding.code);
    return codes;
  }, [visibleBuildings, linkedBuilding]);
  const selected = findCampusBuilding(selectedCode);
  const routeCodes = new Set([fromCode, toCode].filter(Boolean));

  function chooseBuilding(code: string) {
    setManualCode(code);
    if (!fromCode) setFromCode(code);
    else if (!toCode && code !== fromCode) setToCode(code);
  }

  function closeDetail() {
    setManualCode(null);
    if (linkedBuilding) router.replace("/map");
  }

  return (
    <main className="campus-life-page relative min-h-[calc(100vh-3rem)] overflow-hidden bg-slate-50/80 text-slate-900 dark:bg-slate-950/85 dark:text-slate-100">
      <CampusBackground image="/images/campus/architecture.jpg.png" />
      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[1500px] flex-col gap-4 p-4 lg:p-6">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-cyan-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_14px_#44d9ff]" />
              E-JUST / NEW BORG EL ARAB
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{t("map.title")}</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-300">{t("map.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-slate-950/65 px-3 py-2 text-xs text-cyan-200 backdrop-blur-xl">
            <Zap size={14} /> {t("map.zoneCount").replace("{n}", String(CAMPUS_BUILDINGS.length))}
          </div>
        </section>

        <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3 shadow-2xl backdrop-blur-xl">
            <label className="relative">
              <Search size={16} className="absolute left-3 top-3 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("map.search")}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${category === item ? "bg-cyan-300 text-slate-950 shadow-[0_0_16px_rgb(68_217_255/35%)]" : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"}`}
                >
                  {t(`map.${item}`)}
                </button>
              ))}
            </div>
            <div className="mt-2 border-t border-white/10 pt-3">
              <p className="mb-2 text-[10px] font-semibold tracking-[0.14em] text-slate-500">{t("map.buildingCode").toUpperCase()}</p>
              <div className="space-y-1">
                {visibleBuildings.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => chooseBuilding(item.code)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${selectedCode === item.code ? "bg-cyan-300/10 text-cyan-200" : "text-slate-300 hover:bg-white/5"}`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[item.category], boxShadow: `0 0 10px ${CATEGORY_COLORS[item.category]}` }} />
                    <span className="truncate">{item.name[locale]}</span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-500">{item.code}</span>
                  </button>
                ))}
                {!visibleBuildings.length && <p className="px-2 py-3 text-xs text-slate-500">{t("assistant.noAnswer")}</p>}
              </div>
            </div>
            <div className="mt-auto rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-400">
              <div className="flex items-center gap-2 text-cyan-200"><Crosshair size={14} /> {t("map.open")}</div>
              <p className="mt-2 text-[11px] font-semibold text-slate-300">{t("map.floorHints")}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-cyan-200">
                <span className="rounded-md bg-white/5 px-1.5 py-1">{t("map.hintGround")}</span>
                <span className="rounded-md bg-white/5 px-1.5 py-1">{t("map.hintFirst")}</span>
                <span className="rounded-md bg-white/5 px-1.5 py-1">{t("map.hintBasement")}</span>
              </div>
            </div>
          </aside>

          <div className="relative min-h-[520px] overflow-hidden rounded-2xl border border-cyan-200/20 bg-slate-950/70 shadow-2xl backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(rgb(68 217 255 / 8%) 1px, transparent 1px), linear-gradient(90deg, rgb(68 217 255 / 8%) 1px, transparent 1px)", backgroundSize: "42px 42px" }} />
            <div className="absolute left-4 top-4 z-10 rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 font-mono text-[10px] text-slate-400">
              GRID {CAMPUS_CENTER[0].toFixed(4)}°N / {CAMPUS_CENTER[1].toFixed(4)}°E <span className="ml-3 text-emerald-300">● LIVE</span>
            </div>
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full p-8" role="img" aria-label={t("map.title")}>
              <defs>
                <filter id="hud-glow"><feGaussianBlur stdDeviation="0.8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>
              {CAMPUS_BUILDINGS.map((item) => {
                const { x, y } = projectBuilding(item);
                const active = selectedCode === item.code || routeCodes.has(item.code);
                const visible = visibleCodes.has(item.code);
                return (
                  <g
                    key={item.code}
                    onClick={() => chooseBuilding(item.code)}
                    className={visible ? "cursor-pointer" : "pointer-events-none opacity-20"}
                    role="button"
                    aria-label={item.name[locale]}
                  >
                    {linkedBuilding?.code === item.code && (
                      <circle cx={x} cy={y} r={6} fill="none" stroke="#facc15" strokeWidth="0.5" strokeDasharray="1 1" />
                    )}
                    <circle cx={x} cy={y} r={active ? 3.4 : 2.2} fill="rgb(2 6 23 / 85%)" stroke={CATEGORY_COLORS[item.category]} strokeWidth={active ? "0.9" : "0.5"} filter="url(#hud-glow)" />
                    <circle cx={x} cy={y} r={active ? 2 : 1.2} fill={CATEGORY_COLORS[item.category]} />
                    <text x={x + 3.5} y={y - 2.5} fill="white" fontSize="2.6" fontWeight={active ? "700" : "500"}>{item.code}</text>
                  </g>
                );
              })}
            </svg>
            <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-slate-950/75 px-3 py-2 text-[10px] text-slate-400">
              {CATEGORIES.filter((item) => item !== "all").map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[item] }} /> {t(`map.${item}`)}
                </span>
              ))}
            </div>
            {selected && (
              <aside className="absolute inset-y-0 right-0 z-20 w-full max-w-sm overflow-y-auto border-l border-cyan-200/20 bg-slate-950/95 p-5 shadow-2xl backdrop-blur-2xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.14em] text-cyan-300">{t("map.buildingCode")} · {selected.code}</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">{selected.name[locale]}</h2>
                  </div>
                  <button type="button" onClick={closeDetail} className="rounded-lg p-2 text-slate-500 hover:bg-white/10 hover:text-white" aria-label="Close"><X size={18} /></button>
                </div>
                <p className="mt-2 text-xs text-slate-400">{t(`map.${selected.category}`)}</p>

                {selected.code === linkedBuilding?.code && paramRoom && (
                  <div className="mt-5 rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-cyan-200"><MapPin size={13} /> {t("map.targetRoom")}</p>
                    <div className="mt-2"><RoomBadge buildingCode={selected.code} roomCode={paramRoom} tone="solid" /></div>
                    <p className="mt-2 text-[11px] text-cyan-100/80">{t(floorTranslationKey(decodeFloor(paramRoom)))}</p>
                  </div>
                )}

                <div className="mt-6">
                  <p className="text-xs font-semibold text-slate-300">{t("map.floors")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selected.floors.map((floor) => (
                      <span key={floor} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-300">
                        {floor} · {t(floorTranslationKey(decodeFloor(floor)))}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-xs font-semibold text-slate-300">{t("map.coordinates")}</p>
                  <p className="mt-2 font-mono text-xs text-slate-400">{selected.lat.toFixed(4)}°N, {selected.lng.toFixed(4)}°E</p>
                </div>

                <div className="mt-6">
                  <p className="text-xs font-semibold text-slate-300">{t("map.actions")}</p>
                  <div className="mt-2 grid gap-2">
                    <button type="button" onClick={() => setFromCode(selected.code)} className="flex items-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-left text-sm text-cyan-200 hover:bg-cyan-300/20"><ArrowUp size={15} />{t("map.start")}</button>
                    <button type="button" onClick={() => setToCode(selected.code)} className="flex items-center gap-2 rounded-lg border border-violet-300/25 bg-violet-300/10 px-3 py-2 text-left text-sm text-violet-200 hover:bg-violet-300/20"><ArrowDown size={15} />{t("map.arrive")}</button>
                    <a href={selected.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/10"><ExternalLink size={15} />{t("map.googleMaps")}</a>
                  </div>
                </div>
              </aside>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/75 p-3 shadow-2xl backdrop-blur-xl sm:p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-200"><Navigation size={16} className="text-cyan-300" /> {t("map.route")}</div>
            <select value={fromCode} onChange={(event) => setFromCode(event.target.value)} className="min-w-0 flex-1 basis-36 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-300/60"><option value="">{t("map.from")}</option>{CAMPUS_BUILDINGS.map((item) => <option key={item.code} value={item.code}>{item.name[locale]} ({item.code})</option>)}</select>
            <select value={toCode} onChange={(event) => setToCode(event.target.value)} className="min-w-0 flex-1 basis-36 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-300/60"><option value="">{t("map.to")}</option>{CAMPUS_BUILDINGS.map((item) => <option key={item.code} value={item.code}>{item.name[locale]} ({item.code})</option>)}</select>
            <button type="button" onClick={() => { setFromCode(""); setToCode(""); }} className="rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-white/10 hover:text-white">{t("map.clear")}</button>
            {fromCode && toCode && <span className="flex items-center gap-1 text-xs text-emerald-300"><LocateFixed size={14} /> {t("map.arrive")}</span>}
          </div>
        </section>
      </div>
    </main>
  );
}
