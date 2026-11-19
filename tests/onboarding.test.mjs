import test from "node:test";
import assert from "node:assert/strict";
import {
  ACADEMIC_YEARS,
  DEPARTMENTS_BY_FACULTY,
  FACULTY_LABEL_KEY,
  ONBOARDING_FACULTIES,
  clearOnboardingDismissed,
  dismissalKey,
  normalizeAcademicProfile,
  shouldShowOnboarding,
  toTimetableFaculty,
  toTimetableGroup,
  toTimetableTrack,
  toHubFaculty,
} from "../src/lib/onboarding.ts";

const VALID = {
  faculty: "CSIT",
  year: 3,
  group: "2",
  track: "AID",
  section: "7",
};

test("onboarding exposes six faculties, years 1-5 and 12 sections", () => {
  assert.deepEqual(ONBOARDING_FACULTIES, ["FOE", "CSIT", "FIBH", "FOP", "BAS", "FAD"]);
  assert.deepEqual(ACADEMIC_YEARS, [1, 2, 3, 4, 5]);
});

test("every faculty has department presets and a translation key", () => {
  for (const faculty of ONBOARDING_FACULTIES) {
    assert.ok(DEPARTMENTS_BY_FACULTY[faculty].length > 0, faculty);
    assert.equal(FACULTY_LABEL_KEY[faculty], `onboarding.${faculty.toLowerCase()}`);
  }
  assert.deepEqual(DEPARTMENTS_BY_FACULTY.CSIT, ["CNC", "AID", "CSC", "BIF"]);
  assert.ok(DEPARTMENTS_BY_FACULTY.FOP.includes("BIO"));
  assert.ok(DEPARTMENTS_BY_FACULTY.BAS.includes("NAN"));
  assert.ok(DEPARTMENTS_BY_FACULTY.FAD.includes("ART"));
});

test("normalizeAcademicProfile keeps a valid profile", () => {
  assert.deepEqual(normalizeAcademicProfile(VALID), VALID);
});

test("normalizeAcademicProfile accepts year 5 and new faculty/department values", () => {
  const profile = normalizeAcademicProfile({
    faculty: "fad",
    year: 5,
    group: "4",
    track: "ind",
    section: 12,
    updatedAt: "2026-11-19T00:00:00.000Z",
  });
  assert.equal(profile.faculty, "FAD");
  assert.equal(profile.year, 5);
  assert.equal(profile.group, "4");
  assert.equal(profile.track, "IND");
  assert.equal(profile.section, "12");
  assert.equal(profile.updatedAt, "2026-11-19T00:00:00.000Z");
});

test("normalizeAcademicProfile sanitizes types and ranges", () => {
  const profile = normalizeAcademicProfile({
    faculty: "foe",
    year: "4",
    group: 9,
    track: "general",
    section: 12,
  });
  assert.equal(profile.faculty, "FOE");
  assert.equal(profile.year, 4);
  assert.equal(profile.group, "1");
  assert.equal(profile.track, "General");
  assert.equal(profile.section, "12");
});

test("normalizeAcademicProfile rejects unusable profiles", () => {
  for (const value of [null, undefined, "profile", [], { ...VALID, faculty: "MED" },
    { ...VALID, year: 0 }, { ...VALID, year: 6 }, { ...VALID, section: 13 }]) {
    assert.equal(normalizeAcademicProfile(value), null, JSON.stringify(value));
  }
  // Unknown tracks are safe to default rather than discard the whole profile.
  assert.equal(normalizeAcademicProfile({ ...VALID, track: "XYZ" }).track, "General");
});

test("clearOnboardingDismissed removes the stale per-user dismissal flag", () => {
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.delete(key),
    },
  };
  try {
    store.set(dismissalKey("fresh-account"), "1");
    clearOnboardingDismissed("fresh-account");
    assert.equal(store.has(dismissalKey("fresh-account")), false);
  } finally {
    delete globalThis.window;
  }
});

test("shouldShowOnboarding requires authentication, empty state and no dismissal", () => {
  assert.equal(shouldShowOnboarding({
    authenticated: true, profile: null, syncedCourseCount: 0, dismissed: false,
  }), true);
  assert.equal(shouldShowOnboarding({
    authenticated: false, profile: null, syncedCourseCount: 0, dismissed: false,
  }), false);
  assert.equal(shouldShowOnboarding({
    authenticated: true, profile: VALID, syncedCourseCount: 0, dismissed: false,
  }), false);
  assert.equal(shouldShowOnboarding({
    authenticated: true, profile: null, syncedCourseCount: 3, dismissed: false,
  }), false);
  assert.equal(shouldShowOnboarding({
    authenticated: true, profile: null, syncedCourseCount: 0, dismissed: true,
  }), false);
});

test("welcome flag opens onboarding for a fresh account but never for guests", () => {
  assert.equal(shouldShowOnboarding({
    authenticated: true, profile: VALID, syncedCourseCount: 3, dismissed: true, welcome: true,
  }), true);
  assert.equal(shouldShowOnboarding({
    authenticated: false, profile: null, syncedCourseCount: 0, dismissed: false, welcome: true,
  }), false);
});

test("mappings translate the wizard profile for hub pages", () => {
  assert.equal(toTimetableFaculty("CSIT"), "CSIT");
  assert.equal(toTimetableFaculty("FOE"), "Engineering");
  assert.equal(toTimetableFaculty("FIBH"), "Business");
  assert.equal(toTimetableFaculty("FOP"), "FOP");
  assert.equal(toTimetableFaculty("BAS"), "BAS");
  assert.equal(toTimetableFaculty("FAD"), "FAD");
  assert.equal(toTimetableGroup("3"), "Group 3");
  assert.equal(toTimetableGroup("bad"), "Group 1");
  assert.equal(toTimetableTrack("General"), "CSC");
  assert.equal(toTimetableTrack("AID"), "AID");
  assert.equal(toTimetableTrack("BIO"), "CSC");
  assert.equal(toHubFaculty("FIBH"), "FIBH");
  assert.equal(toHubFaculty("FOP"), "FOP");
});
