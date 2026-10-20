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

### Extras

- **Calendar export** — exams and scholarship deadlines export as `.ics` (Google Calendar, Outlook, Apple Calendar)
- **Print / Save as PDF** — GPA and Timetable pages print cleanly (nav and buttons hidden automatically)

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
    layout.tsx     Shell: TopNav + PrintHeader
  components/       MasterPlan, CampusMap, TopNav, PrintButton, PrintHeader, ...
  data/             campusData.json, locations.ts, scholarships.ts, cafeteria.ts
  lib/              campusTypes, gpa, timetable, exams, ics
```

## Data notes

- **Campus buildings (B07–B30)** were placed by zone (north/central/west/south grids plus a west extension) and are approximations — correct the `coordinates` in `src/data/campusData.json` against the official master plan as needed.
- **Cafeteria menu and prices are samples.** Replace them with the real list in `src/data/cafeteria.ts`.
- **Scholarship deadlines are indicative.** Each card links to the official page — always verify.

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

- Supabase + pgvector RAG chatbot for campus Q&A (requires credentials)
- Supabase-backed shared reviews across devices
- Real cafeteria menu and verified scholarship deadlines
