/**
 * Pure free-room lookup derived from the official Fall 2026 meeting data and
 * the signed-in student's own custom timetable slots. No browser or network
 * APIs are used so the overlap rules are easy to test.
 */

import officialTimetable from "../data/timetable-fall-2026.json" with { type: "json" };
import { decodeFloor } from "./room-parser.ts";
import { DAYS, toMinutes, type ClassBlock, type Day } from "./timetable.ts";

const CAIRO_TIME_ZONE = "Africa/Cairo";

export interface ScheduledSlot {
  day: Day;
  start: string;
  end: string;
  courseCode: string;
  title: string;
}

export interface RoomSchedule {
  key: string;
  building: string;
  room: string;
  label: string;
  slots: ScheduledSlot[];
}

export interface FreeRoom {
  key: string;
  building: string;
  room: string;
  label: string;
  nextClass: ScheduledSlot | null;
}

/** A room's state during the requested window, used by the Building Inspector. */
export interface RoomStatus extends RoomSchedule {
  floor: string;
  status: "free" | "occupied";
  activeClass: ScheduledSlot | null;
  nextClass: ScheduledSlot | null;
}

export interface FreeRoomsQuery {
  day: Day;
  start: string;
  end: string;
  filter?: string;
  customClasses?: ClassBlock[];
}

interface OfficialMeeting {
  day: string;
  startTime: string;
  endTime: string;
  building: string | null;
  room: string | null;
  courseCode: string;
  title: string;
}

export function normalizeRoomDay(value: string): Day | null {
  const candidate = DAYS.find(
    (day) => day.toLowerCase() === value.trim().slice(0, 3).toLowerCase(),
  );
  return candidate ?? null;
}

/** Parse `B17 · G0.22`, `B18 G08`, or `B7|F1.01` into a room identity. */
export function parseRoomText(location: string): { building: string; room: string } | null {
  const match = location.trim().match(/^([A-Za-z]{1,4}\d*)\s*(?:[·|,/-]|\s)\s*(.+)$/);
  if (!match) return null;
  const building = match[1].trim();
  const room = match[2].trim();
  return building && room ? { building, room } : null;
}

function roomKey(building: string, room: string): string {
  return `${building.toUpperCase()}|${room.toUpperCase()}`;
}

function labelFor(building: string, room: string): string {
  return `${building} · ${room}`;
}

function addSlot(
  rooms: Map<string, RoomSchedule>,
  building: string,
  room: string,
  slot: ScheduledSlot,
): void {
  const key = roomKey(building, room);
  const existing = rooms.get(key);
  if (existing) {
    const duplicate = existing.slots.some(
      (item) =>
        item.day === slot.day &&
        item.start === slot.start &&
        item.end === slot.end &&
        item.courseCode === slot.courseCode,
    );
    if (!duplicate) existing.slots.push(slot);
    return;
  }
  rooms.set(key, {
    key,
    building,
    room,
    label: labelFor(building, room),
    slots: [slot],
  });
}

/** Build a room -> day/time slot index from official meetings and custom classes. */
export function buildRoomSchedule(customClasses: ClassBlock[] = []): Map<string, RoomSchedule> {
  const rooms = new Map<string, RoomSchedule>();

  for (const meeting of officialTimetable.meetings as OfficialMeeting[]) {
    const day = normalizeRoomDay(meeting.day);
    if (!day || !meeting.building || !meeting.room) continue;
    addSlot(rooms, meeting.building.trim(), meeting.room.trim(), {
      day,
      start: meeting.startTime,
      end: meeting.endTime,
      courseCode: meeting.courseCode,
      title: meeting.title,
    });
  }

  for (const block of customClasses) {
    const parsed = parseRoomText(block.location ?? "");
    const day = normalizeRoomDay(block.day);
    if (!parsed || !day || !/^\d{1,2}:\d{2}$/.test(block.start) || !/^\d{1,2}:\d{2}$/.test(block.end)) {
      continue;
    }
    addSlot(rooms, parsed.building, parsed.room, {
      day,
      start: block.start,
      end: block.end,
      courseCode: block.courseCode,
      title: block.title,
    });
  }

  return rooms;
}

function overlaps(windowStart: number, windowEnd: number, slot: ScheduledSlot): boolean {
  const start = toMinutes(slot.start);
  const end = toMinutes(slot.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;
  return start < windowEnd && windowStart < end;
}

/** Return rooms with zero overlapping classes during the requested window. */
export function findFreeRooms(query: FreeRoomsQuery): FreeRoom[] {
  const day = normalizeRoomDay(query.day);
  const windowStart = toMinutes(query.start);
  const windowEnd = toMinutes(query.end);
  if (!day || !Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowEnd <= windowStart) {
    return [];
  }

  const filter = (query.filter ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const results: FreeRoom[] = [];

  for (const room of buildRoomSchedule(query.customClasses ?? []).values()) {
    if (filter && !room.label.toLowerCase().replace(/[^a-z0-9]/g, "").includes(filter)) continue;
    const daySlots = room.slots
      .filter((slot) => slot.day === day)
      .toSorted((a, b) => toMinutes(a.start) - toMinutes(b.start));
    if (daySlots.some((slot) => overlaps(windowStart, windowEnd, slot))) continue;
    results.push({
      key: room.key,
      building: room.building,
      room: room.room,
      label: room.label,
      nextClass: daySlots.find((slot) => toMinutes(slot.start) >= windowEnd) ?? null,
    });
  }

  return results.toSorted(
    (a, b) => a.building.localeCompare(b.building) || a.room.localeCompare(b.room),
  );
}

/**
 * Return every scheduled room with an explicit free/occupied state for the
 * requested Cairo-time window. `FreeRoomsPanel` only needs free rooms, while
 * the Building Inspector must also show what is occupying a room and when the
 * next class starts.
 */
export function findRoomStatuses(query: FreeRoomsQuery): RoomStatus[] {
  const day = normalizeRoomDay(query.day);
  const windowStart = toMinutes(query.start);
  const windowEnd = toMinutes(query.end);
  if (!day || !Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowEnd <= windowStart) {
    return [];
  }

  const filter = (query.filter ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const results: RoomStatus[] = [];

  for (const room of buildRoomSchedule(query.customClasses ?? []).values()) {
    if (filter && !room.label.toLowerCase().replace(/[^a-z0-9]/g, "").includes(filter)) continue;
    const daySlots = room.slots
      .filter((slot) => slot.day === day)
      .toSorted((a, b) => toMinutes(a.start) - toMinutes(b.start));
    const activeClass = daySlots.find((slot) => overlaps(windowStart, windowEnd, slot)) ?? null;
    results.push({
      ...room,
      floor: decodeFloor(room.room),
      status: activeClass ? "occupied" : "free",
      activeClass,
      nextClass: daySlots.find((slot) => toMinutes(slot.start) >= windowEnd) ?? null,
    });
  }

  return results.toSorted(
    (a, b) => a.building.localeCompare(b.building) || a.room.localeCompare(b.room),
  );
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function minutesToTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Current Cairo day and a one-hour window, used to initialize the finder UI. */
export function defaultFreeRoomsQuery(now: Date = new Date()): {
  day: Day;
  start: string;
  end: string;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CAIRO_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  const day = normalizeRoomDay(read("weekday")) ?? "Sat";
  const startMinutes = Number(read("hour")) * 60 + Number(read("minute"));
  const endMinutes = Math.min(startMinutes + 60, 23 * 60 + 59);
  return { day, start: minutesToTime(startMinutes), end: minutesToTime(endMinutes) };
}
