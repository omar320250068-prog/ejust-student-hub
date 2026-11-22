import test from "node:test";
import assert from "node:assert/strict";
import {
  applyBackup,
  collectBackup,
  validateBackup,
} from "../src/lib/data-backup.ts";
import {
  buildExamsIcs,
  buildTimetableIcs,
  escapeIcsText,
} from "../src/lib/ics-export.ts";
import {
  deadlineStorageKey,
  deadlineHoursLeft,
  isUrgentDeadline,
  readDeadlines,
  sanitizeDeadlines,
  sortDeadlines,
  writeDeadlines,
} from "../src/lib/student-data.ts";
import {
  defaultFreeRoomsQuery,
  findFreeRooms,
  parseRoomText,
} from "../src/lib/free-rooms.ts";

function storage(initial = new Map()) {
  return {
    map: initial,
    getItem(key) {
      return initial.has(key) ? initial.get(key) : null;
    },
    setItem(key, value) {
      initial.set(key, value);
    },
    removeItem(key) {
      initial.delete(key);
    },
    keys() {
      return [...initial.keys()];
    },
  };
}

const NOW = new Date("2026-11-22T12:00:00Z");

test("ICS text escapes RFC 5545 delimiters", () => {
  assert.equal(
    escapeIcsText("Intro\\; lab, part 1\nSign in"),
    "Intro\\\\\\; lab\\, part 1\\nSign in",
  );
});

test("timetable ICS has Cairo context, weekly recurrence, and a 15-minute alarm", () => {
  const ics = buildTimetableIcs(
    [
      {
        id: "c1",
        courseCode: "CSC 111",
        title: "Programming; Lab, Basics\nIntro",
        day: "Mon",
        start: "09:00",
        end: "10:00",
        location: "B17 · G0.22",
        instructor: "Dr. A",
      },
    ],
    { now: NOW },
  );

  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /VERSION:2\.0/);
  assert.match(ics, /X-WR-TIMEZONE:Africa\/Cairo/);
  assert.match(ics, /BEGIN:VTIMEZONE/);
  assert.match(ics, /TZID=Africa\/Cairo:20261123T090000/);
  assert.match(ics, /DTEND;TZID=Africa\/Cairo:20261123T100000/);
  assert.match(ics, /RRULE:FREQ=WEEKLY;COUNT=15/);
  assert.match(ics, /SUMMARY:CSC 111 Programming\\; Lab\\, Basics\\nIntro/);
  assert.match(ics, /LOCATION:B17 · G0\.22/);
  assert.match(ics, /BEGIN:VALARM[\s\S]*TRIGGER:-PT15M[\s\S]*ACTION:DISPLAY[\s\S]*END:VALARM/);
  assert.equal(ics.replace(/\r\n/g, "").includes("\n"), false);
});

test("exam ICS includes room, seat, and a 15-minute alarm", () => {
  const ics = buildExamsIcs(
    [
      {
        id: "e1",
        courseCode: "MTH 111",
        title: "Midterm; Final",
        type: "Midterm",
        date: "2026-12-01T10:00",
        weight: 30,
        difficulty: 3,
        notes: "Bring, calculator",
      },
    ],
    { now: NOW, seat: { hall: "B18 · G08", seat: "24" } },
  );

  assert.match(ics, /BEGIN:VEVENT/);
  assert.match(ics, /DTSTART;TZID=Africa\/Cairo:20261201T100000/);
  assert.match(ics, /SUMMARY:MTH 111 Midterm: Midterm\\; Final/);
  assert.match(ics, /LOCATION:B18 · G08/);
  assert.match(ics, /DESCRIPTION:[\s\S]*Seat: 24/);
  assert.match(ics, /TRIGGER:-PT15M/);
  assert.match(ics, /END:VCALENDAR/);
});

test("deadlines are validated, sorted by due date, and flagged within 48 hours", () => {
  const deadlines = sanitizeDeadlines([
    {
      id: "later",
      title: "Essay",
      courseCode: "HIS 101",
      type: "assignment",
      dueAt: "2026-11-25T12:00:00Z",
      completed: false,
    },
    {
      id: "soon",
      title: "Quiz 2",
      courseCode: "CSC 111",
      type: "quiz",
      dueAt: "2026-11-23T09:00:00Z",
      completed: false,
    },
    {
      id: "bad",
      title: "Ignored",
      courseCode: "CSC 111",
      type: "lab",
      dueAt: "not-a-date",
      completed: false,
    },
  ]);

  assert.deepEqual(deadlines.map((item) => item.id), ["later", "soon"]);
  assert.deepEqual(
    sortDeadlines(deadlines).map((item) => item.id),
    ["soon", "later"],
  );
  assert.equal(deadlineHoursLeft(deadlines[1], NOW), 21);
  assert.equal(isUrgentDeadline(deadlines[1], NOW), true);
  assert.equal(isUrgentDeadline(deadlines[0], NOW), false);
  assert.equal(
    isUrgentDeadline(
      { ...deadlines[1], dueAt: "2026-11-24T12:00:00Z" },
      NOW,
    ),
    false,
  );
});

test("deadlines use per-user keys and survive JSON backup round-trips", () => {
  const first = { id: "student-a" };
  const second = { email: "other@example.com" };
  const deadline = {
    id: "d1",
    title: "Lab report",
    courseCode: "CSC 111",
    type: "lab",
    dueAt: "2026-11-25T10:00:00Z",
    completed: false,
  };
  const store = storage();
  writeDeadlines(store, first, [deadline]);
  writeDeadlines(store, second, []);

  assert.equal(deadlineStorageKey(first), "ejust:deadlines:u:student-a");
  assert.equal(deadlineStorageKey(null), "ejust:deadlines");
  assert.deepEqual(readDeadlines(store, first), [deadline]);
  assert.deepEqual(readDeadlines(store, second), []);

  const backup = collectBackup(store);
  assert.deepEqual(backup.data[deadlineStorageKey(first)], [deadline]);
  const validated = validateBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(validated.ok, true);
  if (!validated.ok) return;

  const target = storage();
  assert.ok(applyBackup(target, validated.backup) >= 1);
  assert.deepEqual(readDeadlines(target, first), [deadline]);
});

test("free rooms exclude overlapping slots and report the next class", () => {
  assert.deepEqual(parseRoomText("B17 · G0.22"), {
    building: "B17",
    room: "G0.22",
  });

  const occupied = {
    id: "custom-1",
    courseCode: "TEST 101",
    title: "Occupied",
    day: "Mon",
    start: "10:30",
    end: "11:30",
    location: "B17 · G0.22",
    color: "#000000",
  };
  const next = {
    ...occupied,
    id: "custom-2",
    courseCode: "TEST 102",
    title: "Next",
    start: "14:30",
    end: "15:30",
    location: "B99 · NEXT-ROOM",
  };

  const busyResults = findFreeRooms({
    day: "Mon",
    start: "10:00",
    end: "11:00",
    filter: "G0.22",
    customClasses: [occupied],
  });
  assert.equal(busyResults.some((room) => room.room === "G0.22"), false);

  const nextResults = findFreeRooms({
    day: "Mon",
    start: "10:00",
    end: "11:00",
    filter: "NEXT-ROOM",
    customClasses: [next],
  });
  assert.equal(nextResults.length, 1);
  assert.equal(nextResults[0].nextClass?.start, "14:30");

  const restOfDay = findFreeRooms({
    day: "Tue",
    start: "10:00",
    end: "11:00",
    filter: "NEXT-ROOM",
    customClasses: [next],
  });
  assert.equal(restOfDay[0].nextClass, null);
});

test("free room defaults use the current Cairo day and a one-hour window", () => {
  const query = defaultFreeRoomsQuery(new Date("2026-11-22T22:30:00Z"));
  assert.equal(query.day, "Mon");
  assert.equal(query.start, "00:30");
  assert.equal(query.end, "01:30");
});
