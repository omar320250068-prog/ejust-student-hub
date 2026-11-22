# Plan: Campus & Course Channels Chat

## Overview
Add a mobile-first `/chat` experience backed by Neon PostgreSQL: campus channels, course rooms from scoped student data, secure message APIs, visibility-aware polling, optimistic sending, pinning/moderation, and en/ar/ja localization.

## Decisions
- Keep the existing AI/RAG `/api/chat` route unchanged; message endpoints live under `/api/chat/messages`.
- Follow the existing raw-SQL Neon store pattern (`getSql`, cached `schemaReady`, `CREATE TABLE IF NOT EXISTS`, reset on failure) from `exam-store.ts` and `rate-limit-store.ts`.
- Hard-delete messages; no deleted-message payloads remain in the feed.
- Allow at most one active pinned message per channel by unpinning the previous pinned row inside the PATCH store operation.
- Store plain text only; render through React text nodes with `whitespace-pre-wrap`, never `dangerouslySetInnerHTML`.
- Use `getViewer()` for live server-side roles, and treat unapproved TAs as `STUDENT` for display and authorization.
- Reuse `enforceRateLimit` with the IP/email/user buckets already provided by `rate-limit-api.ts`.
- Derive course rooms from scoped GPA + timetable local data via the existing `student-data.ts` helpers.
- Leave `tasks/plan.md`, `tasks/todo.md`, and unrelated `docs/SRS.md` untouched.

## Work slices

### Slice 1 — Contract and failing tests
- Add this plan and `tasks/todo-chat-channels.md`.
- Register `tests/chat-validation.test.mjs` in `package.json`.
- Write failing tests for channel normalization, message content rules, cursor/limit parsing, role authorization, and the chat rate-limit policy.
- Verify: only the new test file fails.

### Slice 2 — Pure validation and rate-limit policy
- Add `src/lib/chat-validation.ts` with pure, server/client-safe helpers and shared message types.
- Add a `chatMessage` policy to `src/lib/rate-limit.ts`.
- Verify: chat validation tests pass; existing tests stay green.

### Slice 3 — Neon store and secure APIs
- Add `src/lib/chat-store.ts` with idempotent `chat_messages` schema and channel index.
- Add `GET`/`POST` in `src/app/api/chat/messages/route.ts`.
- Add `PATCH`/`DELETE` in `src/app/api/chat/messages/[id]/route.ts` using Promise-based `params` (Next.js 16).
- Verify: typecheck, lint, tests, and build.

### Slice 4 — Localization and navigation
- Add `nav.chat` and a `chat.*` group to en/ar/ja; extend `TranslationKey`.
- Add `/chat` to `TopNav.tsx`.
- Verify: i18n parity test passes.

### Slice 5 — Mobile-first chat UI
- Add `/chat` page with responsive channel drawer, campus channels, scoped course rooms, and course-code join input.
- Implement visibility-aware 3.5s polling, manual refresh, optimistic send, keyboard behavior, char counter, near-bottom auto-scroll, badges, pinned banner, and authorized actions.
- Verify: typecheck, lint, tests, and build.

### Slice 6 — Final verification and delivery
- Run `npx next typegen`, `npx tsc --noEmit`, `npx eslint src tests next.config.ts`, `npm test`, `npm run build`.
- Stage only feature files, commit to `main`, and push `origin/main`.

## Acceptance criteria
- `chat_messages` is created idempotently with the required columns, channel index, and `(channel, created_at DESC)` index.
- Guests can read channels but receive 401 on POST; POST is rate-limited and validates trimmed 1–500 char plain text.
- DELETE is author-or-admin only; PATCH is admin-only and leaves one active announcement per channel.
- `/chat` is discoverable from TopNav and fully localized in en/ar/ja.
- All five verification commands pass; changes are committed on `main` and pushed to `origin/main`.
