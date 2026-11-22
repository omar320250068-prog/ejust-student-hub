# Plan: Mobile-first student utilities

## Context

The previous feature set (GPS Map retirement, Free Rooms finder, deadlines, calendar export)
shipped in `2d95eeb`. This plan covers the next four utilities, requested together and
delivered as a single integrated change:

1. Smart Paste from SIS (resilient plain-text parser + UI)
2. PWA + Offline Mode (manifest, service worker, install prompt)
3. Attendance & DN Tracker (per-user scoped storage + JSON backup parity)
4. Final Exam Target Calculator (pure utility + UI)

The existing `tasks/plan.md` and `tasks/todo.md` describe the already-shipped prior feature
and are deliberately left untouched as historical records.

## Delivery decision

- One short-lived branch off `main`, one integrated commit, then push to `origin/main`.
- Each workstream is still implemented and verified as a thin slice (TDD: red → green → verify)
  so failures are localized, but the final history is a single commit.

## Guiding constraints

- **Pure logic first.** Parsing/calculation/storage helpers stay dependency-free and
  independently testable under `node:test` (`.mjs` importing `.ts` via the repo's existing
  strip-types convention).
- **Conservative parsing.** The SIS parser skips ambiguous rows instead of guessing; import
  merges into existing scoped data and never replaces it.
- **Per-user scoping.** Attendance follows the `StorageUser` helper used by deadlines:
  `ejust:attendance:u:<id>` when signed in, guest fallback otherwise.
- **Backup parity.** Any stored attendance data must round-trip through `DataBackupPanel`
  export/import with strict validation, mirroring deadlines.
- **Offline safety.** The service worker bypasses `/api/*` entirely; only the five core
  student pages get network-first with offline cache fallback. Static assets are cache-first.
- **i18n parity.** Every new user-facing string is added to `en`, `ar`, and `ja` with
  identical keys and identical `{placeholder}` sets; `tests/i18n-parity.test.mjs` stays green.
- **No regressions.** Existing 123 tests, type check, lint, and production build must all pass.

## Workstreams

### 1. Pure utilities + failing tests (red first)

- `tests/student-utilities.test.mjs`: register in `package.json`.
- `src/lib/sis-paste-parser.ts`:
  - exported result types for parsed courses, classes, and exams
  - grade tokens: `A+`, `A`, `B+`, `B`, `C+`, `C`, `D+`, `D`, `F`, in-progress
  - weekly slots: `Sun`–`Thu`, start/end times, room
  - exam entries with date/time where present
  - tolerate copied table text, extra whitespace, CRLF, and Arabic/Japanese labels
- `src/lib/final-grade-calc.ts`:
  - exact 9-grade scale and boundaries (`A+ 97`, `A 93`, `B+ 89`, `B 84`, `C+ 79`,
    `C 74`, `D+ 69`, `D 60`)
  - inputs: current coursework score, coursework max (default `60`, editable), final exam
    max (default `40`), target grade
  - outputs: required final raw mark, required percentage, achievable flag
- `src/lib/attendance.ts` (or extend `student-data.ts` per actual layout):
  - `courseCode -> { absences, maxAllowed }`, default `maxAllowed: 4`, editable
  - scoped/guest read/write helpers, strict parsing/validation, snapshot support

### 2. Storage + JSON backup parity

- Mirror the deadlines pattern in `student-data.ts` and `data-backup.ts`.
- Add attendance backup keys and strict validation.
- Wire `DataBackupPanel` to collect/restore attendance alongside existing keys.

### 3. SIS Paste UI

- Add a "Paste from SIS" tab/flow inside `SisSyncGuide`.
- Paste textarea, live preview of parsed courses/classes/exams, one-click merge import.
- Trigger from `/gpa`, `/timetable`, and `/exams` empty states and action bars.

### 4. Attendance & DN Tracker UI

- Compact tracker on each course/class row in `/timetable` and `/gpa`.
- Shows `absences / maxAllowed`, `-` / `+1` buttons, editable limit.
- Progress bar: green safe, amber at `>= 50%`, red + localized "DN Risk" badge at
  `>= 75%` or `>= maxAllowed`.

### 5. Final Exam Target Calculator UI

- Reusable component rendered on `/exams` and `/gpa`.
- Inputs for coursework score/max, exam max, target grade; live required-mark result
  and achievable state.

### 6. PWA + Offline Mode

- `src/app/manifest.ts` with the exact requested names, colors, `standalone`, `/today`, icons.
- App icons (generated or static) plus Apple web-app metadata in `layout.tsx`.
- `public/sw.js`: static cache-first; network-first + cache fallback for `/today`,
  `/timetable`, `/exams`, `/gpa`, `/master-plan`; hard bypass of `/api/*`.
- Client registration component + dismissible localized install prompt and iOS
  "Share → Add to Home Screen" tip.

### 7. i18n

- Add all new copy to `en`, `ar`, `ja`; update `TranslationKey`.
- Keep `tests/i18n-parity.test.mjs` green.

### 8. Verify and ship

- `npx next typegen`
- `npx tsc --noEmit`
- `npx eslint src tests next.config.ts`
- `npm test`
- `npm run build`
- `git add -A`, one commit, `git push origin main`

## Risks / open items

- Exact integration points, existing hook signatures, and test import convention must be
  confirmed from the codebase map before writing code.
- SIS portal markup varies; the parser must degrade gracefully and never corrupt existing
  scoped data.
- Service worker must not cache authenticated or API responses under any path.
