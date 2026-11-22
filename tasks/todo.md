# Todo: Campus productivity features + GPS map retirement

- [ ] 1. Create plan/task files (done by this document).
- [ ] 2. Register `tests/student-productivity.test.mjs` in `package.json` and add failing ICS/deadline/free-room tests.
- [ ] 3. Remove GPS Map nav item, Today card, landing/services/dashboard highlights, metadata, and README references.
- [ ] 4. Replace `/map` with `redirect('/master-plan')`; add `/master-plan` alias wrapper while leaving `MasterPlan` untouched.
- [ ] 5. Delete GPS-only components/tests and remove Leaflet dependencies from `package.json` + lockfile.
- [ ] 6. Implement pure `src/lib/ics-export.ts` with escaping, Cairo context, weekly RRULE, and VALARM.
- [ ] 7. Extend `src/lib/student-data.ts` with scoped/guest deadlines, validation, sorting, urgency, and snapshot support.
- [ ] 8. Implement pure `src/lib/free-rooms.ts` with official + custom room index, overlap/filter/next-slot logic, and Cairo defaults.
- [ ] 9. Add deadline backup keys and strict validation to `src/lib/data-backup.ts`.
- [ ] 10. Add all new en/ar/ja strings and update `TranslationKey`; keep i18n parity green.
- [ ] 11. Wire timetable and exam export buttons and localized empty-state prompts.
- [ ] 12. Build the `/today` Deadlines & Quizzes section and Free Rooms quick card.
- [ ] 13. Wire FreeRoomsPanel into `/master-plan` and TopNav More menu; preserve room deep-link filter.
- [ ] 14. Run full verification: typegen, tsc, eslint, npm test, build.
- [ ] 15. Commit all changes to `main` and push to `origin/main`.

## Checkpoints
- After 2: new tests fail for the intended missing modules/functions.
- After 5: no GPS Map UI/dependency remains and `/map` redirects.
- After 10: `npm test` passes including i18n parity and backup tests.
- After 13: all three features are reachable and localized.
- After 15: remote `origin/main` contains the final commit.
