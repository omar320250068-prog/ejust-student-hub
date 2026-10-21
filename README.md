# EJUST Student Hub

A student toolkit for the **Egypt-Japan University of Science and Technology** (New Borg El-Arab City, Alexandria). Everything is client-side and free/open-source — no accounts, no backend, no tracking. Your plans are stored in the browser's `localStorage`.

## Features

| Route | What it does |
| --- | --- |
| `/today` | Dashboard: today's classes, next exam + study split, GPA snapshot, closest scholarship deadline, food spend today |
| `/` | Campus **master plan** — interactive SVG, search/filter, walking directions (nearest gate + parking, compass heading, route overlay) |
| `/map` | **GPS map** (Leaflet/OpenStreetMap) with 21 real campus locations, categories, and student reviews |
| `/gpa` | **GPA predictor & degree tracker** — current/forecast GPA, grades needed for a target, semester + cumulative chart |
| `/timetable` | Weekly **timetable builder** with conflict detection and `.ics` export |
| `/exams` | **Exam countdown & study planner** — urgency-weighted daily study allocation per exam |
| `/cafeteria` | **Meal budget** — pick a tray per day, daily and weekly budget tracking |
| `/scholarships` | **Scholarship finder** — 9 funding opportunities, filters, saved shortlist, calendar export |
| `/assistant` | **Campus assistant** — offline RAG chat that answers from this app's own data and cites its sources |

### Extras

- **Calendar export** — exams and scholarship deadlines export as `.ics` (Google Calendar, Outlook, Apple Calendar)
- **Print / Save as PDF** — GPA and Timetable pages print cleanly (nav and buttons hidden automatically)
- **Offline assistant** — no API key, no external model, no network calls

## The assistant

`/assistant` is a retrieval-augmented chat over the app's own data — the 47-entry
knowledge base is built directly from the campus data, scholarship list, cafeteria
menu and GPA scale, so it can never drift from what the pages show.

It is deliberately **extractive**: it quotes retrieved passages instead of
paraphrasing with a model, which means it cannot invent an answer. The trade-off is
that it reads a little stiffly. Everything runs locally (BM25 retrieval in
`src/lib/rag/`); there is no API key and no network call.

**It refuses out-of-scope questions on purpose.** Retrieval always returns its
closest document, and for a question it doesn't cover that document is a
confidently wrong answer — the first version happily returned the Eiffel
scholarship for "what is the capital of France", because the word *France* appears
in that entry. Since BM25 scores a rare word highly whether or not the document is
about it, no score threshold can tell those apart. So the assistant checks the
question against an explicit list of supported subjects (`DOMAIN_VOCABULARY`)
before searching, and declines anything outside them rather than guessing.

```bash
npx tsx scripts/rag-acceptance.ts   # 18 in-scope / out-of-scope cases; exits non-zero on regression
```

`/api/knowledge` reports what the retriever is holding; `/api/sync` reports whether
Supabase credentials are present (they aren't, so it stays on the local retriever).
The retrieval source is injected via one interface (`KnowledgeSource`), so swapping
in pgvector later is a one-line change and nothing else moves.

## Tech stack

- **Next.js 16** (App Router, Turbopack, Cache Components) · **React 19** · **TypeScript**
- **Tailwind CSS v4**
- **Leaflet + react-leaflet** (GPS map) · **Recharts** (GPA chart) · **lucide-react** (icons)

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run lint
npm run build
npm run start    # production server
```

## Project structure

```
src/
  app/
    today/         Dashboard
    page.tsx       Master plan (home)
    map/           GPS map
    gpa/           GPA & degree tracker
    timetable/     Timetable builder
    exams/         Exam planner
    cafeteria/     Meal budget
    scholarships/  Scholarship finder
    assistant/     Campus assistant (chat UI)
    api/chat/      POST — answer a question
    api/knowledge/ GET  — retriever diagnostics
    api/sync/      GET  — Supabase readiness report
    layout.tsx     Shell: TopNav + PrintHeader
  components/       MasterPlan, CampusMap, TopNav, PrintButton, PrintHeader, ...
  data/             campusData.json, locations.ts, scholarships.ts, cafeteria.ts
  lib/
    campusTypes, gpa, timetable, exams, ics
    rag/
      knowledge.ts  Corpus builder + DOMAIN_VOCABULARY (in-scope subjects)
      retriever.ts  BM25 with field weighting and phrase matching
      answer.ts     Extractive answers + refusal
      tokenize.ts   Shared stopwords and stemming
scripts/
  rag-acceptance.ts  Retrieval acceptance suite
```

## Data notes

- **Campus buildings (B07–B30)** were placed by zone (north/central/west/south grids plus a west extension) and are approximations — correct the `coordinates` in `src/data/campusData.json` against the official master plan as needed.
- **Cafeteria menu and prices are samples.** Replace them with the real list in `src/data/cafeteria.ts`.
- **Scholarship deadlines are indicative.** Each card links to the official page — always verify.
- **The assistant's vocabulary is intentionally narrow.** If you add a whole new subject area (say, library services or bus routes), add its terms to `DOMAIN_VOCABULARY` in `src/lib/rag/knowledge.ts` — otherwise questions about it will be refused. A question that mixes an unsupported subject with a supported word can still slip through (asking about a *visa to Germany* matches the DAAD scholarship's host country); the acceptance suite in `scripts/rag-acceptance.ts` is there to catch regressions like that.

## Deploy

### Vercel (recommended)

1. Push this repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new) — the framework is auto-detected, no environment variables are required.
3. Or use the CLI:

```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production deployment
```

### Any Node host

```bash
npm run build
npm run start   # serves on $PORT, default 3000
```

## Roadmap

- **Upgrade the assistant from BM25 to embeddings** — the retrieval interface is already abstracted; the missing piece is a funded embedding API or a Supabase project (`/api/sync` reports what's absent). Embeddings would also settle the mixed-subject false positives that the vocabulary list can't.
- Supabase-backed shared reviews across devices
- Real cafeteria menu and verified scholarship deadlines

## Environment Setup

Copy .env.example to .env.local and fill in your credentials:
- AUTH_SECRET: Generate with openssl rand -base64 32`n- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET: From Google Cloud Console
- DATABASE_URL: Postgres connection string (Supabase/Neon)

