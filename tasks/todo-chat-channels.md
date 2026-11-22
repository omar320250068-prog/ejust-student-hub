# Todo: Campus & Course Channels Chat

- [x] 1. Register `tests/chat-validation.test.mjs` and add failing contract tests.
- [x] 2. Add pure chat validation helpers and the `chatMessage` rate-limit policy.
- [x] 3. Add the Neon `chat_messages` store with idempotent schema and indexes.
- [x] 4. Add `GET`/`POST /api/chat/messages`.
- [x] 5. Add `PATCH`/`DELETE /api/chat/messages/[id]` with role authorization.
- [ ] 6. Add en/ar/ja `chat.*` strings, `nav.chat`, and `TranslationKey` coverage.
- [ ] 7. Add `/chat` to `TopNav.tsx`.
- [ ] 8. Build the mobile-first `/chat` page with channels, course rooms, polling, composer, and moderation UI.
- [ ] 9. Run typegen, tsc, eslint, npm test, and build.
- [ ] 10. Commit to `main` and push to `origin/main`.

## Checkpoints
- After 2: new unit tests pass and existing tests remain green.
- After 5: API code typechecks and lints; `npm test` remains green.
- After 7: i18n parity passes.
- After 8: full verification passes.
- After 10: `origin/main` contains the final commit.
