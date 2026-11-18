import assert from "node:assert/strict";
import test from "node:test";

import { parseTimetableCells, parseTimetableText } from "../src/lib/timetable-parser.ts";

function cell(x0, y0, x1, y1, lines) {
  const words = lines.flatMap(({ text, y }) =>
    text.split(/\s+/).map((word, index) => ({
      text: word,
      x0: x0 + 10 + index * 55,
      y0: y - 10,
      x1: x0 + 10 + index * 55 + word.length * 6,
      y1: y + 10,
    }))
  );

  return {
    rect: { x0, y0, x1, y1 },
    words,
    lines: lines.map((line) => line.text),
  };
}

test("maps a single class cell to its year, group, section, day, and slot", () => {
  const meetings = parseTimetableCells([
    cell(606.54, 603.3, 773.45, 740.75, [
      { text: "CSC 111", y: 625 },
      { text: "Fundamentals of Programming", y: 655 },
    ]),
  ]);

  assert.equal(meetings.length, 1);
  const meeting = meetings[0];
  assert.equal(meeting.courseCode, "CSC 111");
  assert.equal(meeting.title, "Fundamentals of Programming");
  assert.equal(meeting.meetingType, "LECTURE");
  assert.equal(meeting.year, 1);
  assert.equal(meeting.group, "Group 1");
  assert.equal(meeting.section, "3");
  assert.equal(meeting.day, "SATURDAY");
  assert.equal(meeting.startTime, "09:00");
  assert.equal(meeting.endTime, "09:45");
});

test("maps the second block to Year 2 sections and Monday's first slot", () => {
  const meetings = parseTimetableCells([
    cell(1294.91, 1646.21, 1461.82, 1807.66, [
      { text: "PHY 113 Physics 1", y: 1670 },
      { text: "LEC", y: 1705 },
    ]),
  ]);

  assert.equal(meetings.length, 1);
  assert.equal(meetings[0].year, 2);
  assert.equal(meetings[0].group, "Group 1");
  assert.equal(meetings[0].section, "1");
  assert.equal(meetings[0].day, "MONDAY");
  assert.equal(meetings[0].startTime, "09:00");
});

test("splits slash-separated electives and assigns them by code position", () => {
  const meetings = parseTimetableCells([
    cell(772.36, 1089.84, 1157.46, 1313.48, [
      { text: "LRA 102 Introduction to Philosophy (Dr. Haytham Elsayed)", y: 1120 },
      { text: "B18 G.21", y: 1165 },
      { text: "/ LRA 104 Music and Technoology", y: 1188 },
      { text: "B17 G.09", y: 1211 },
      { text: "/ LRA 105 Theater and Drama (Prof. Ahmed Awaad)", y: 1234 },
      { text: "B18 G.13", y: 1280 },
    ]),
  ]);

  const codes = [...new Set(meetings.map((meeting) => meeting.courseCode))].sort();
  assert.deepEqual(codes, ["LRA 102", "LRA 104", "LRA 105"]);
  assert.deepEqual([...new Set(meetings.map((meeting) => meeting.section))].sort(), ["4", "5"]);

  const lra105 = meetings.find((meeting) => meeting.courseCode === "LRA 105");
  assert.equal(lra105?.startTime, "13:15");
  assert.equal(lra105?.endTime, "14:00");
  assert.equal(lra105?.room, "G.13");
});

test("inherits the previous slot's course for a continuation lab cell", () => {
  const meetings = parseTimetableCells([
    cell(606.54, 603.3, 773.45, 740.75, [
      { text: "CSC 111", y: 620 },
      { text: "Fundamentals of Programming", y: 650 },
    ]),
    cell(606.54, 739.66, 773.45, 868.39, [
      { text: "LAB", y: 760 },
      { text: "Eng Nouran Morad", y: 790 },
      { text: "B18 G0.17", y: 815 },
    ]),
  ]);

  const lab = meetings.find((meeting) => meeting.meetingType === "LAB");
  assert.ok(lab);
  assert.equal(lab.courseCode, "CSC 111");
  assert.equal(lab.startTime, "09:45");
  assert.equal(lab.endTime, "10:30");
  assert.equal(lab.building, "B18");
  assert.equal(lab.room, "G0.17");
  assert.equal(lab.instructor, "Nouran Morad");
});

test("fans a merged track cell out to every covered Year 3 section", () => {
  const meetings = parseTimetableCells([
    cell(3450.55, 603.3, 4778.18, 740.75, [
      { text: "ECE 324 Digital Signal Processing", y: 630 },
      { text: "LAB", y: 665 },
      { text: "B7 F1.12", y: 700 },
    ]),
  ]);

  assert.equal(meetings.length, 9);
  assert.deepEqual(
    [...new Set(meetings.map((meeting) => meeting.track))].sort(),
    ["AID", "BIF", "CNC", "CSC"]
  );
  assert.ok(meetings.every((meeting) => meeting.year === 3 && meeting.meetingType === "LAB"));
});

test("parseTimetableText exposes course codes from free text electives", () => {
  const parsed = parseTimetableText(
    "LRA 102 Introduction to Philosophy / LRA 104 Music and Technoology / LRA 105 Theater and Drama"
  );
  assert.deepEqual(
    parsed.map((entry) => entry.courseCode),
    ["LRA 102", "LRA 104", "LRA 105"]
  );
});
