# Plan: Interactive Master Plan Building Inspector

## Overview
Enhance the existing `/` and `/master-plan` SVG campus map so every building polygon opens a rich Building Inspector (overview, rooms/labs with live availability, and searchable faculty offices). Extend the existing search bar and URL contract (`building`, `room`, plus `tab`, `q`, `office`) so room and office links from timetable, today, and faculty pages deep-link into the correct building and tab.

## Decisions
- Keep `campusData.json` as the map source of truth. Add a separate enrichment dataset for localized building metadata, aliases, departments, and amenities instead of editing the JSON shape.
- Reuse the SQLite `/api/faculty` records at runtime; do not copy names/emails into static data. Add deterministic department→building and office-number mapping in a pure library.
- Reuse `free-rooms.ts` for live room status and `room-parser.ts` for room-code/floor decoding.
- Keep the existing `?building=…&room=…` contract from `RoomBadge`; add `tab`, `q`, and `office` as optional refinements.
- Use server-parsed `searchParams` from `/master-plan` and a remount key so client state always matches deep links; no `useSearchParams` suspension boundary needed.
- Leave `tasks/plan.md` / `tasks/todo.md` unchanged because they belong to the prior completed productivity work.

## Work slices

### Slice 1 — Plan and failing tests
- Add `tasks/plan-building-inspector.md` and `tasks/todo-building-inspector.md`.
- Register `tests/master-plan-inspector.test.mjs` in `package.json`.
- Write failing tests for building lookup/aliases, room availability, faculty office mapping/search, and deep-link parsing.
- Verify: only the new test file fails.

### Slice 2 — Data and pure libraries
- Add `src/data/building-inspector.ts` with localized building metadata and aliases.
- Add `src/lib/faculty-offices.ts` mapping the 76 existing faculty rows to buildings, floors, offices, and normalized emails.
- Add `src/lib/master-plan-inspector.ts` with room status, office filtering, unified search, and URL helpers.
- Verify: new unit tests pass; existing tests remain green.

### Slice 3 — Localization
- Add an `inspector.*` group to `en`, `ar`, and `ja` in `src/lib/i18n.tsx` and extend `TranslationKey`.
- Verify: `tests/i18n-parity.test.mjs` passes with zero mismatches.

### Slice 4 — Inspector UI and map integration
- Add `src/components/BuildingInspector.tsx` as an accessible responsive drawer/bottom sheet with three tabs.
- Wire building markers, hover/selected/focus states, upgraded sidebar search, and URL updates in `MasterPlan.tsx`.
- Pass parsed deep-link state from `src/app/master-plan/page.tsx`.
- Verify: typecheck, lint, tests, and build.

### Slice 5 — Cross-page deep links
- Add office links in `/faculty` and room links in `/today`; keep `/timetable` via `RoomBadge`.
- Verify: typecheck, lint, tests, and build.

### Slice 6 — Final verification and delivery
- Run `npx next typegen`, `npx tsc --noEmit`, `npx eslint src tests next.config.ts`, `npm test`, `npm run build`.
- Commit to `main` and push `origin/main`; exclude unrelated `docs/SRS.md`.

## Acceptance criteria
- Every building polygon is clickable and keyboard accessible with visible hover/selected/focus states.
- Inspector shows localized overview, floor directory, live room statuses, and searchable/floor-filtered faculty offices.
- Search matches building name/code, professor name, office number, and lab/hall name; selecting a result opens the right inspector tab and highlights the card.
- `?building=B7&tab=offices&q=…`, `?building=B17&room=G0.22`, and existing `RoomBadge` links open the exact inspector automatically.
- All new strings exist in en/ar/ja with matching placeholders; all five verification commands pass; changes are committed and pushed.
