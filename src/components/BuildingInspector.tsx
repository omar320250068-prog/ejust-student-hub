"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Clock3,
  DoorOpen,
  Mail,
  Search,
  Users,
  X,
} from "lucide-react";
import type { BuildingDetail, BuildingRoomKind } from "@/data/building-inspector";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { FLOOR_LABEL } from "@/lib/room-parser";
import type { RoomStatus } from "@/lib/free-rooms";
import {
  buildingOffices,
  searchFacultyOffices,
  type FacultyOffice,
  type InspectorTab,
} from "@/lib/master-plan-inspector";

const TABS: InspectorTab[] = ["overview", "rooms", "offices"];

const TAB_LABELS: Record<InspectorTab, TranslationKey> = {
  overview: "inspector.overview",
  rooms: "inspector.rooms",
  offices: "inspector.offices",
};

const ROOM_KIND_LABELS: Record<BuildingRoomKind, TranslationKey> = {
  lecture: "inspector.lectureHall",
  tutorial: "inspector.tutorialRoom",
  lab: "inspector.lab",
  facility: "inspector.facility",
};

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
}

function floorLabelKey(code: string): TranslationKey {
  if (code === "G") return "map.floorGround";
  if (code === "B01") return "map.floorBasement";
  if (code === "F1") return "map.floorFirst";
  if (code === "F2") return "map.floorSecond";
  if (code === "F3") return "map.floorThird";
  return "map.floorUpper";
}

function floorCodeFromStatus(room: RoomStatus): string | null {
  if (room.floor === FLOOR_LABEL.ground) return "G";
  if (room.floor === FLOOR_LABEL.basement) return "B01";
  if (room.floor === FLOOR_LABEL.first) return "F1";
  if (room.floor === FLOOR_LABEL.second) return "F2";
  if (room.floor === FLOOR_LABEL.third) return "F3";
  const match = /^(\d+)th Floor$/.exec(room.floor);
  return match ? `F${match[1]}` : null;
}

function roomKind(detail: BuildingDetail, room: RoomStatus): BuildingRoomKind {
  const seeded = detail.rooms.find((item) => item.code.toUpperCase() === room.room.toUpperCase());
  if (seeded) return seeded.kind;
  const scheduleText = room.slots.map((slot) => `${slot.title} ${slot.courseCode}`).join(" ").toLocaleLowerCase();
  if (/lab|practical|studio/.test(scheduleText)) return "lab";
  if (/theater|lecture|hall/.test(scheduleText)) return "lecture";
  return "tutorial";
}

function isHighlighted(highlight: string, values: string[]): boolean {
  const key = normalize(highlight);
  if (!key) return false;
  return values.some((value) => normalize(value) === key || normalize(value).includes(key));
}

export interface BuildingInspectorProps {
  detail: BuildingDetail;
  tab: InspectorTab;
  rooms: RoomStatus[];
  offices: FacultyOffice[];
  query?: string;
  highlight?: string;
  onTabChange: (tab: InspectorTab) => void;
  onClose: () => void;
}

/** Responsive slide-over (desktop) / bottom sheet (mobile) for a plan building. */
export default function BuildingInspector({
  detail,
  tab,
  rooms,
  offices,
  query = "",
  highlight = "",
  onTabChange,
  onClose,
}: BuildingInspectorProps) {
  const { t, locale } = useLanguage();
  const dialogRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLElement | null>(null);
  const [officeQuery, setOfficeQuery] = useState(query);
  const [officeFloor, setOfficeFloor] = useState("all");

  const buildingOfficesList = useMemo(
    () => buildingOffices(offices, detail.code),
    [offices, detail.code],
  );

  const floors = useMemo(
    () => [...new Set(buildingOfficesList.map((office) => String(office.floor)))].toSorted((a, b) => Number(a) - Number(b)),
    [buildingOfficesList],
  );

  const filteredOffices = useMemo(
    () =>
      searchFacultyOffices(buildingOfficesList, officeQuery, {
        floor: officeFloor,
      }),
    [buildingOfficesList, officeQuery, officeFloor],
  );

  useEffect(() => {
    dialogRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    highlightRef.current?.scrollIntoView({ block: "nearest" });
  }, [tab, highlight]);

  const floorDirectory = detail.floors.map((floor) => ({
    code: floor,
    rooms: rooms.filter((room) => floorCodeFromStatus(room) === floor),
    offices: buildingOfficesList.filter((office) => `F${office.floor}` === floor),
  }));
  const extraFloors = [...new Set(rooms.map(floorCodeFromStatus).filter((value): value is string => typeof value === "string" && !detail.floors.includes(value)))]
    .toSorted((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 sm:justify-end"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="building-inspector-title"
        tabIndex={-1}
        className="flex max-h-[86vh] w-full flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl outline-none dark:border-slate-700 dark:bg-slate-900 sm:h-full sm:max-h-none sm:w-[30rem] sm:rounded-l-3xl sm:rounded-tr-none"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-950/40">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-cyan-100 px-2 py-1 font-mono text-xs font-bold text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-200">
                {detail.code}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t("inspector.buildingCode")}
              </span>
            </div>
            <h2 id="building-inspector-title" className="mt-2 truncate text-lg font-bold text-slate-900 dark:text-white">
              {detail.name[locale]}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {detail.description[locale]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("inspector.close")}
            className="shrink-0 rounded-xl p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </header>

        <div role="tablist" aria-label={t("inspector.title")} className="flex border-b border-slate-200 px-2 dark:border-slate-700">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              id={`building-inspector-tab-${item}`}
              aria-controls={`building-inspector-panel-${item}`}
              aria-selected={tab === item}
              tabIndex={tab === item ? 0 : -1}
              onClick={() => onTabChange(item)}
              className={`flex-1 border-b-2 px-2 py-3 text-xs font-semibold transition sm:text-sm ${
                tab === item
                  ? "border-cyan-600 text-cyan-700 dark:border-cyan-300 dark:text-cyan-200"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              {t(TAB_LABELS[item])}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`building-inspector-panel-${tab}`}
          aria-labelledby={`building-inspector-tab-${tab}`}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
        >
          {tab === "overview" && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-2">
                <Stat icon={<Building2 size={15} />} label={t("inspector.floors")} value={t("inspector.floorCount", { n: detail.floors.length })} />
                <Stat icon={<DoorOpen size={15} />} label={t("inspector.rooms")} value={String(rooms.length)} />
                <Stat icon={<Users size={15} />} label={t("inspector.faculty")} value={String(buildingOfficesList.length)} />
              </div>

              <Section title={t("inspector.departments")}>
                <ChipList values={detail.departments.map((item) => item[locale])} />
              </Section>

              <Section title={t("inspector.amenities")}>
                <ChipList values={detail.amenities.map((item) => item[locale])} />
              </Section>

              <Section title={t("inspector.floorDirectory")}>
                <ul className="space-y-2">
                  {[...floorDirectory, ...extraFloors.map((code) => ({ code, rooms: rooms.filter((room) => floorCodeFromStatus(room) === code), offices: [] as FacultyOffice[] }))]
                    .map((row) => (
                      <li key={row.code} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{t(floorLabelKey(row.code))}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {[
                            row.rooms.length ? row.rooms.map((room) => room.room).join(", ") : "",
                            row.offices.length ? row.offices.map((office) => t("inspector.officeNumber", { number: office.officeNumber })).join(", ") : "",
                          ].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </li>
                    ))}
                </ul>
              </Section>
            </div>
          )}

          {tab === "rooms" && (
            <div className="space-y-3">
              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{t("inspector.availabilityNote")}</p>
              {rooms.length === 0 ? (
                <EmptyNote text={t("inspector.noRooms")} />
              ) : (
                <ul className="space-y-2">
                  {rooms.map((room) => {
                    const kind = roomKind(detail, room);
                    const highlighted = isHighlighted(highlight, [room.room, room.key, room.label]);
                    return (
                      <li
                        key={room.key}
                        ref={highlighted ? (node) => { highlightRef.current = node; } : undefined}
                        className={`rounded-xl border p-3 transition ${
                          highlighted
                            ? "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-200 dark:border-cyan-400 dark:bg-cyan-950/30 dark:ring-cyan-900"
                            : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/30"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                              {room.room}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {t(ROOM_KIND_LABELS[kind])} · {t(floorLabelKey(floorCodeFromStatus(room) ?? "G"))}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                              room.status === "free"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200"
                            }`}
                          >
                            {room.status === "free" ? t("inspector.freeNow") : t("inspector.occupied")}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                          {room.activeClass && (
                            <p className="flex items-center gap-1.5">
                              <Clock3 size={13} />
                              {t("inspector.occupiedBy", { course: `${room.activeClass.courseCode} · ${room.activeClass.title}` })}
                            </p>
                          )}
                          {room.nextClass && (
                            <p className="flex items-center gap-1.5">
                              <Clock3 size={13} />
                              {t("inspector.nextClass", { time: room.nextClass.start })}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {tab === "offices" && (
            <div className="space-y-3">
              <label className="relative block">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={officeQuery}
                  onChange={(event) => setOfficeQuery(event.target.value)}
                  placeholder={t("inspector.officeSearch")}
                  aria-label={t("inspector.officeSearch")}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                />
              </label>

              <div className="flex items-center justify-between gap-2">
                <select
                  value={officeFloor}
                  onChange={(event) => setOfficeFloor(event.target.value)}
                  aria-label={t("inspector.floors")}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                >
                  <option value="all">{t("inspector.allFloors")}</option>
                  {floors.map((floor) => (
                    <option key={floor} value={floor}>{t("inspector.floorNumber", { n: Number(floor) })}</option>
                  ))}
                </select>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t("inspector.showing", { n: filteredOffices.length, total: buildingOfficesList.length })}
                </p>
              </div>

              {filteredOffices.length === 0 ? (
                <EmptyNote text={buildingOfficesList.length ? t("inspector.noMatches") : t("inspector.noOffices")} />
              ) : (
                <ul className="space-y-2">
                  {filteredOffices.map((office) => {
                    const highlighted = isHighlighted(highlight, [
                      office.id,
                      office.officeNumber,
                      office.name,
                      `floor ${office.floor}`,
                    ]);
                    return (
                      <li
                        key={office.id}
                        ref={highlighted ? (node) => { highlightRef.current = node; } : undefined}
                        className={`rounded-xl border p-3 transition ${
                          highlighted
                            ? "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-200 dark:border-cyan-400 dark:bg-cyan-950/30 dark:ring-cyan-900"
                            : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/30"
                        }`}
                      >
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{office.name}</p>
                        <p className="mt-0.5 text-xs font-medium text-cyan-700 dark:text-cyan-300">{office.title}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{office.department}</p>
                        <p className="mt-2 inline-flex rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {t("inspector.floorNumber", { n: office.floor })} · {t("inspector.officeNumber", { number: office.officeNumber })}
                        </p>
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <Clock3 size={13} />
                          {office.officeHours.length
                            ? office.officeHours.map((slot) => `${slot.day} ${slot.start}–${slot.end}`).join(", ")
                            : t("inspector.byAppointment")}
                        </p>
                        <a
                          href={`mailto:${office.email}`}
                          className="mt-1 flex items-center gap-1.5 text-xs font-medium text-cyan-700 hover:underline dark:text-cyan-300"
                        >
                          <Mail size={13} />
                          {office.email}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-950/40">
      <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        {icon}
        {label}
      </span>
      <strong className="mt-1 block text-sm text-slate-900 dark:text-white">{value}</strong>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function ChipList({ values }: { values: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <span key={value} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {value}
        </span>
      ))}
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
      {text}
    </p>
  );
}
