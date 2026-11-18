import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseTimetableCells, type RawCell } from "../src/lib/timetable-parser";

const inputPath = process.argv[2] ?? "data/raw/timetable_cells.json";
const outputPath = process.argv[3] ?? "src/data/timetable-fall-2026.json";

const cells = JSON.parse(readFileSync(inputPath, "utf8")) as RawCell[];
const meetings = parseTimetableCells(cells);

const payload = {
  academicYear: "2026/2027",
  semester: "Fall",
  source: "CSIT_Fall_2026_Completed_Timetable_v09-17.pdf",
  meetings,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`wrote ${meetings.length} meetings to ${outputPath}`);
