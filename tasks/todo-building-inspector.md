# Todo: Building Inspector

- [ ] 1. Register `tests/master-plan-inspector.test.mjs` and add failing tests.
- [ ] 2. Add localized building metadata with alias lookup.
- [ ] 3. Add deterministic faculty office mapping from existing `/api/faculty` rows.
- [ ] 4. Add room availability, unified search, and URL helpers in `master-plan-inspector.ts`.
- [ ] 5. Add `inspector.*` translations in en/ar/ja and update `TranslationKey`.
- [ ] 6. Build `BuildingInspector.tsx` drawer/bottom sheet with Overview, Rooms, and Offices tabs.
- [ ] 7. Wire map markers, search results, deep links, and URL updates in `MasterPlan.tsx` and `/master-plan`.
- [ ] 8. Add office/room deep links from `/faculty` and `/today`.
- [ ] 9. Run typegen, tsc, eslint, npm test, and build.
- [ ] 10. Commit to `main` and push to `origin/main`.

## Checkpoints
- After 1: new tests fail only for missing modules/functions.
- After 4: new unit tests pass.
- After 5: i18n parity passes.
- After 8: full verification passes.
- After 10: `origin/main` contains the final commit.
