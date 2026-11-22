import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";

import {
  canonicalBuildingCode,
  findBuildingDetail,
  searchBuildingDetails,
} from "../src/data/building-inspector.ts";
import { findRoomStatuses } from "../src/lib/free-rooms.ts";
import {
  inspectorHref,
  mapFacultyToOffices,
  parseMasterPlanLocation,
  searchFacultyOffices,
  searchMasterPlan,
} from "../src/lib/master-plan-inspector.ts";

function facultyRows() {
  const db = new Database("data/EJUST_Faculty.db", { readonly: true });
  try {
    return db
      .prepare(
        "SELECT id, full_name, academic_rank, faculty_school, department, email FROM faculty ORDER BY id",
      )
      .all();
  } finally {
    db.close();
  }
}

const saturdayMorning = { day: "Sat", start: "09:00", end: "09:45" };

test("building metadata resolves map IDs, short codes and localized names", () => {
  assert.equal(canonicalBuildingCode("B7"), "B07");
  assert.equal(canonicalBuildingCode(" B08 "), "B08");
  assert.equal(canonicalBuildingCode("coe"), "COE");

  const b7 = findBuildingDetail("B7");
  assert.ok(b7);
  assert.equal(b7.code, "B07");
  assert.match(b7.name.en, /Computer Science/i);
  assert.match(b7.name.ar, /حاسوب/);
  assert.match(b7.name.ja, /情報/);
  assert.ok(b7.floors.length >= 3);
  assert.ok(b7.departments.length > 0);
  assert.ok(b7.amenities.length > 0);

  const byName = searchBuildingDetails("library");
  assert.ok(byName.some((building) => building.code === "LIB"));
});

test("room statuses filter by building and report live free/occupied state", () => {
  const occupied = findRoomStatuses({ ...saturdayMorning, filter: "B7 F1.12" });
  assert.equal(occupied.length, 1, "F1.12 is scheduled during the query window");
  assert.equal(occupied[0].building, "B7");
  assert.equal(occupied[0].status, "occupied");
  assert.match(occupied[0].activeClass?.courseCode ?? "", /ECE 324/);

  const buildingRooms = findRoomStatuses({ ...saturdayMorning, filter: "B7" });
  assert.ok(buildingRooms.length > 1);
  assert.ok(buildingRooms.every((room) => canonicalBuildingCode(room.building) === "B07"));
  assert.ok(buildingRooms.every((room) => room.floor.length > 0));
  assert.ok(buildingRooms.some((room) => room.status === "free"));
  assert.ok(
    buildingRooms.every(
      (room) =>
        (room.status === "occupied" && room.activeClass !== null) ||
        (room.status === "free" && room.nextClass === null) ||
        (room.status === "free" && room.nextClass !== null),
    ),
  );
});

test("faculty records are all mapped to buildings with searchable office numbers", () => {
  const rows = facultyRows();
  const offices = mapFacultyToOffices(rows);

  assert.equal(offices.length, rows.length);
  assert.ok(offices.every((office) => /^(B\d{2}|COE|LIB|ADMIN)$/.test(office.building)));
  assert.ok(offices.every((office) => office.email.endsWith("@ejust.edu.eg")));
  assert.ok(offices.every((office) => /^\d{3}$/.test(office.officeNumber)));
  assert.ok(offices.every((office) => office.floor >= 1));

  const tamer = offices.find((office) => office.facultyId === "1");
  assert.ok(tamer);
  assert.equal(tamer.building, "B09");
  assert.equal(
    searchFacultyOffices(offices, "Tamer")[0]?.facultyId,
    "1",
  );
  assert.ok(
    searchFacultyOffices(offices, tamer.officeNumber).some((office) => office.facultyId === "1"),
  );
  assert.ok(searchFacultyOffices(offices, "CSE", { building: "B07" }).length >= 6);
  assert.equal(searchFacultyOffices(offices, "Tamer", { building: "B17" }).length, 0);
});

test("unified search returns buildings, rooms and offices with inspector targets", () => {
  const offices = mapFacultyToOffices(facultyRows());
  const rooms = findRoomStatuses({ day: "Sat", start: "08:00", end: "08:45" });

  const building = searchMasterPlan("B7", offices, rooms);
  assert.ok(building.some((result) => result.kind === "building" && result.buildingCode === "B07"));

  const room = searchMasterPlan("G0.22", offices, rooms);
  assert.ok(
    room.some(
      (result) =>
        result.kind === "room" && result.buildingCode === "B17" && result.highlight === "G0.22",
    ),
  );

  const office = searchMasterPlan("Tamer", offices, rooms);
  assert.ok(
    office.some(
      (result) =>
        result.kind === "office" && result.buildingCode === "B09" && result.tab === "offices",
    ),
  );
});

test("deep links normalize aliases and choose the right inspector tab", () => {
  assert.deepEqual(
    parseMasterPlanLocation({ building: "B7", tab: "offices", q: "Tamer", room: ["F1.12"] }),
    { building: "B07", tab: "offices", room: "F1.12", office: "", q: "Tamer" },
  );
  assert.deepEqual(parseMasterPlanLocation({ building: "B17", room: "G0.22" }), {
    building: "B17",
    tab: "rooms",
    room: "G0.22",
    office: "",
    q: "",
  });
  assert.deepEqual(parseMasterPlanLocation({ building: "B07", tab: "bogus" }), {
    building: "B07",
    tab: "overview",
    room: "",
    office: "",
    q: "",
  });
  assert.equal(
    inspectorHref({ building: "B07", tab: "offices", office: "faculty-1" }),
    "/master-plan?building=B07&tab=offices&office=faculty-1",
  );
});
