import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeBase64Url,
  extractTextFromGmailPayload,
  filterUnprocessedMessages,
  getGmailHeader,
  gmailQueryForRecent,
  mergeGmailDigests,
  normalizeGmailDigest,
  parseGmailDigest,
  parseScheduleChanges,
} from "../src/lib/gmail-digest.ts";

test("decodeBase64Url and extractTextFromGmailPayload read nested Gmail parts", () => {
  const payload = {
    headers: [{ name: "Subject", value: "Exam update" }],
    parts: [
      { mimeType: "text/plain", body: { data: Buffer.from("CSC341 exam").toString("base64url") } },
      {
        mimeType: "multipart/alternative",
        parts: [
          { mimeType: "text/html", body: { data: Buffer.from("<p>Room <b>B4</b></p>").toString("base64url") } },
        ],
      },
    ],
  };
  assert.equal(decodeBase64Url(Buffer.from("hello").toString("base64url")), "hello");
  assert.equal(getGmailHeader(payload, "subject"), "Exam update");
  const text = extractTextFromGmailPayload(payload);
  assert.match(text, /CSC341 exam/);
  assert.match(text, /Room B4/);
});

test("parseScheduleChanges extracts day, time, room and faculty", () => {
  const changes = parseScheduleChanges(
    "CSC341 lab moved to Sunday 10:00-12:00 Building C Room C2, Section 2"
  );
  assert.equal(changes.length, 1);
  const [change] = changes;
  assert.equal(change.courseCode, "CSC341");
  assert.equal(change.faculty, "CSIT");
  assert.equal(change.day, "SUNDAY");
  assert.equal(change.startTime, "10:00");
  assert.equal(change.endTime, "12:00");
  assert.equal(change.building, "C");
  assert.equal(change.room, "C2");
  assert.equal(change.section, "2");
  assert.equal(change.meetingType, "LAB");
});

test("parseGmailDigest extracts exams, schedule changes and a faculty-tagged notice", () => {
  const text = [
    "Exam schedule for Fall 2026",
    "CSC341 Midterm 13 Dec 2026, 10:00-12:00, Building B, Room B4",
    "ECE201 Quiz 2026-12-15 14:00-15:00 A A3",
    "Room change: CSC341 lab moved to Sunday 10:00-12:00 Building C Room C2, Section 2",
    "Please check your student ID before entering.",
  ].join("\n");
  const digest = parseGmailDigest(text, "Exam and lab update");

  assert.equal(digest.exams.length, 2);
  assert.deepEqual(digest.exams.map((row) => [row.courseCode, row.faculty]), [
    ["CSC341", "CSIT"],
    ["ECE201", "FOE"],
  ]);
  assert.equal(digest.scheduleChanges.length, 1);
  assert.equal(digest.announcements.length, 1);
  assert.equal(digest.announcements[0].title, "Exam and lab update");
  assert.equal(digest.announcements[0].category, "SCHEDULE_CHANGE");
  assert.equal(digest.announcements[0].courseCode, "CSC341");
  assert.equal(digest.announcements[0].targetFaculty, "CSIT");
});

test("normalizeGmailDigest validates AI output instead of trusting it", () => {
  const digest = normalizeGmailDigest({
    exams: [
      { courseCode: " mgt-310 ", examType: "Final", examDate: "2026-12-22", startTime: "9:00", endTime: "11:00" },
      { courseCode: "DROP TABLE", examDate: "2026-12-22" },
    ],
    scheduleChanges: [
      { courseCode: "CSC341", day: "SUNDAY", startTime: "10:00", endTime: "12:00", room: "C2" },
      { courseCode: "CSC341", day: "FUNDAY", startTime: "10:00" },
    ],
    announcements: [
      { title: "Registration", body: "Register before Friday", category: "ACADEMIC", courseCode: "FIN220" },
      { title: "", body: "ignored" },
    ],
  });

  assert.equal(digest.exams.length, 1);
  assert.equal(digest.exams[0].courseCode, "MGT310");
  assert.equal(digest.exams[0].faculty, "FIBH");
  assert.equal(digest.scheduleChanges.length, 1);
  assert.equal(digest.scheduleChanges[0].room, "C2");
  assert.equal(digest.announcements.length, 1);
  assert.equal(digest.announcements[0].targetFaculty, "FIBH");
});

test("mergeGmailDigests deduplicates identical intents", () => {
  const first = parseGmailDigest("CSC341 Midterm 13 Dec 2026, 10:00-12:00, Building B, Room B4");
  const merged = mergeGmailDigests(first, first);
  assert.equal(merged.exams.length, 1);
  assert.equal(merged.scheduleChanges.length, 0);
  assert.equal(merged.announcements.length, 1);
});

test("filterUnprocessedMessages drops invalid, processed and duplicate IDs", () => {
  const messages = [
    { id: "abc123" }, { id: "abc123" }, { id: "done456" }, { id: "../etc/passwd" }, { id: "" },
  ];
  assert.deepEqual(filterUnprocessedMessages(messages, ["done456"]), [{ id: "abc123" }]);
});

test("gmailQueryForRecent scopes the search to university senders", () => {
  assert.equal(
    gmailQueryForRecent(2),
    "from:(ejust.edu.eg OR student.ejust.edu.eg) newer_than:2d"
  );
  assert.equal(gmailQueryForRecent(0), "from:(ejust.edu.eg OR student.ejust.edu.eg) newer_than:2d");
});
