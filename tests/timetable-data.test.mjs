import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = new URL("../src/data/timetable-fall-2026.json", import.meta.url);
const raw = readFileSync(file, "utf8");

test("the published timetable contains no placeholder titles", () => {
  assert.equal(/xxx/i.test(raw), false, "timetable data still contains an xxx placeholder");

  const timetable = JSON.parse(raw);
  const entries = Array.isArray(timetable)
    ? timetable
    : Object.values(timetable).flatMap((value) => (Array.isArray(value) ? value : []));
  const titles = entries
    .filter((entry) => entry && typeof entry === "object" && typeof entry.title === "string")
    .map((entry) => entry.title);
  assert.ok(titles.length > 0);
  assert.equal(titles.some((title) => /xxx/i.test(title)), false);
});
