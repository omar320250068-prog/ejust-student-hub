import test from "node:test";
import assert from "node:assert/strict";
import {
  FLOOR_LABEL,
  decodeFloor,
  parseRoomLocation,
  roomHrefFromLocation,
  roomMapHref,
} from "../src/lib/room-parser.ts";

test("parses the room formats used by SIS, timetable and exams", () => {
  assert.deepEqual(parseRoomLocation("B18 G08"), {
    buildingCode: "B18", roomCode: "G08", floorLabel: FLOOR_LABEL.ground,
  });
  assert.deepEqual(parseRoomLocation("B7 F1.20"), {
    buildingCode: "B7", roomCode: "F1.20", floorLabel: FLOOR_LABEL.first,
  });
  assert.deepEqual(parseRoomLocation("PHY LAB. CoE F1_14"), {
    buildingCode: "CoE", roomCode: "F1_14", floorLabel: FLOOR_LABEL.first,
  });
  assert.deepEqual(parseRoomLocation("Building 7, F1.07"), {
    buildingCode: "B7", roomCode: "F1.07", floorLabel: FLOOR_LABEL.first,
  });
});

test("decodes ground, basement and numbered floor prefixes", () => {
  assert.equal(decodeFloor("G08"), "Ground Floor");
  assert.equal(decodeFloor("B01"), "Basement");
  assert.equal(decodeFloor("F1.20"), "First Floor");
  assert.equal(decodeFloor("F1_14"), "First Floor");
  assert.equal(decodeFloor("F2.03"), "Second Floor");
  assert.equal(decodeFloor("F3.11"), "Third Floor");
  assert.equal(decodeFloor("F4.02"), "4th Floor");
  assert.equal(decodeFloor("TBA"), "Floor not specified");
  assert.equal(decodeFloor(null), "Floor not specified");
});

test("normalizes named buildings and separators", () => {
  assert.deepEqual(parseRoomLocation("Main Library · G02"), {
    buildingCode: "LIB", roomCode: "G02", floorLabel: FLOOR_LABEL.ground,
  });
  assert.equal(parseRoomLocation("Food Court G01").buildingCode, "FOOD");
  assert.equal(parseRoomLocation("dorm B01").buildingCode, "DORM");
  assert.equal(parseRoomLocation("gate G01").buildingCode, "GATE");
  assert.equal(parseRoomLocation("Admin F2.04").floorLabel, FLOOR_LABEL.second);
});

test("rejects strings without a building and room pair", () => {
  for (const value of [null, undefined, "", "   ", "TBA", "G08", "Building 7", "PHY LAB."]) {
    assert.equal(parseRoomLocation(value), null, String(value));
  }
});

test("builds map deep links for parsed rooms", () => {
  assert.equal(
    roomMapHref(parseRoomLocation("B18 G08")),
    "/map?building=B18&room=G08"
  );
  assert.equal(
    roomHrefFromLocation("PHY LAB. CoE F1_14"),
    "/map?building=CoE&room=F1_14"
  );
  assert.equal(roomHrefFromLocation("TBA"), null);
});
