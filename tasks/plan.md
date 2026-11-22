# Plan: Campus productivity features + GPS map retirement

## Goal
Retire the Leaflet GPS map while preserving the existing Master Plan, then add three student-productivity capabilities: RFC 5545 calendar exports, per-user deadlines/quizzes, and a Free Rooms Finder. All student data must remain isolated per signed-in account, included in JSON backup/restore, and fully localized in `en`, `ar`, and `ja`.

## Decisions
- Keep the existing Master Plan component untouched at `/`. Add `/master-plan` as an alias route that renders the same `MasterPlan` component plus the new Free Rooms Finder panel.
- `/map` becomes a server-side `redirect('/master-plan')`; old `/map?building=…&room=…` links are honored by the alias page's Free Rooms filter.
- Delete GPS-only `CampusMap.tsx` and `CampusMapPage.tsx`; remove `leaflet`, `react-leaflet`, and `@types/leaflet` from dependencies and lockfile.
- Student keys: signed-in `ejust:deadlines:u:<encoded user>`; guest fallback `ejust:deadlines`. Extend `student-data.ts` rather than creating a parallel storage layer.
- `.ics` exports use floating local times with `TZID=Africa/Cairo` / `X-WR-TIMEZONE:Africa/Cairo`, a 15-minute `VALARM`, and deterministic testable builders.
- Free rooms are derived from `timetable-fall-2026.json` meetings that have a building and room, merged with custom class blocks whose location can be parsed as `B17 · G0.22`.

## Work slices

### Slice 1 — Plan and failing tests
- Create `tasks/plan.md` and `tasks/todo.md`.
- Add `tests/student-productivity.test.mjs` to the explicit `npm test` script.
- Write failing tests for:
  - ICS escaping, weekly `RRULE`, `VALARM`, timezone context, and exam room/seat details.
  - Deadline validation, sorting, `<48h` urgency, signed-in isolation, guest fallback, and backup round-trip.
  - Free-room overlap filtering, custom-slot merge, filter, and next-slot detection.
- Verify: `npm test` fails only on the new file.

### Slice 2 — GPS map retirement
- Remove the `/map` nav item, Today launch card, landing feature copy, services/dashboard highlighting, metadata mention, and README references.
- Replace `src/app/map/page.tsx` with `redirect('/master-plan')`.
- Add `src/app/master-plan/page.tsx` + a small client wrapper that renders the untouched `MasterPlan` and `FreeRoomsPanel`.
- Delete `src/components/CampusMap.tsx`, `src/components/CampusMapPage.tsx`, and GPS-only tests; update `room-parser` deep links and `auth-gate` test paths to `/master-plan`.
- Remove Leaflet packages from `package.json` and `package-lock.json`.
- Verify: typecheck, lint, tests.

### Slice 3 — Pure libraries
- Implement `src/lib/ics-export.ts`: `escapeIcsText`, `buildTimetableIcs`, `buildExamsIcs`, Cairo day/time helpers, folded lines, `RRULE:FREQ=WEEKLY;COUNT=15`, `VALARM`.
- Extend `src/lib/student-data.ts` with `Deadline`, `deadlineStorageKey`, `readDeadlines`, `writeDeadlines`, `sortDeadlines`, `deadlineHoursLeft`, `isUrgentDeadline`, and deadlines in `TodaySnapshot`.
- Implement `src/lib/free-rooms.ts`: room index from official meetings + custom classes, Cairo default window, overlap detection, optional filter, and next-class labels.
- Verify: new unit tests pass.

### Slice 4 — Backup parity and i18n
- Add `ejust:deadlines` to `BACKUP_KEYS` and strict validation for deadline arrays/scoped keys in `data-backup.ts`.
- `DataBackupPanel` continues to use generic `collectBackup`/`applyBackup`, so no UI logic change is needed unless validation fails.
- Add `nav.freeRooms`, `deadlines.*`, `freeRooms.*`, `study.exportExams`, `timetable.exportEmpty`, and dashboard/landing copy changes to all three dictionaries; extend `TranslationKey` with the two new groups and remove removed nav keys.
- Verify: `tests/i18n-parity.test.mjs`, `tests/data-backup.test.mjs`, `npm test`.

### Slice 5 — UI wiring
- `/timetable`: replace `downloadIcs` with `buildTimetableIcs` + browser download; empty click shows localized inline status instead of a disabled button.
- `/exams`: replace `downloadEventIcs`/`examEvent` with `buildExamsIcs`, passing saved seat info; include room/seat in location/description; empty click shows localized status.
- `/today`: add a “Deadlines & Quizzes” section with course select/custom code, type, title, due datetime, sorted incomplete list, `<48h` badge/countdown, complete/delete actions, localized empty state; replace the GPS launch card with a Free Rooms quick link.
- Add `FreeRoomsPanel` to `/master-plan` and a TopNav More-menu link; show the estimated-availability note.
- Verify: typecheck, lint, tests, build, and manual DOM spot-check where practical.

### Slice 6 — Final verification and delivery
- Run, in order: `npx next typegen`, `npx tsc --noEmit`, `npx eslint src tests next.config.ts`, `npm test`, `npm run build`.
- Fix every failure; re-run the full suite after the last code change.
- `git add -A`, commit to `main`, push to `origin/main`.

## Acceptance criteria
- No GPS Map nav item, card, feature highlight, component, route UI, or Leaflet dependency remains; `/map` redirects to `/master-plan` without a 404.
- Master Plan at `/` and `/master-plan` is unchanged visually and functionally except for the added Free Rooms panel on the alias route.
- `.ics` files are valid RFC 5545 text with Cairo context, escaped fields, weekly class recurrence (`COUNT=15`), exam room/seat, and 15-minute display alarms.
- Deadlines persist per user and guests, survive JSON backup/restore, sort by `dueAt`, and flag anything due within 48 hours.
- Free Rooms returns only rooms with zero overlapping scheduled classes, supports custom slots and filters, and reports the next class or rest of day.
- All new strings exist in en/ar/ja with matching placeholders; all verification commands pass; changes are committed and pushed.
