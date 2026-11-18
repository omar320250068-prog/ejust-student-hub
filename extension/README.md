# E-JUST Hub SIS Sync v1.1.0 (Chrome / Edge)

A small Manifest V3 extension that watches the visible course/grade tables on `sis.ejust.edu.eg` and sends changes to the E-JUST Student Hub. It never reads passwords, form values, or cookies.

## What's new in 1.1.0

- **Zero-click pairing:** sign in to the hub in the same browser and your sync token is stored automatically.
- **Automatic background sync:** with auto-sync enabled (the default), changed **Registered Courses** or **Academic Transcript** tables are sent without clicking anything — including after ASP.NET postbacks.
- **No duplicate uploads:** an unchanged table produces no request. A green `✓` badge and a dismissible corner toast confirm a successful sync.

## Install

1. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge) and enable **Developer mode**.
2. Download the ZIP from the hub's sync guide, extract it, click **Load unpacked**, and select the extracted folder.
3. Sign in to the hub and open any page with the sync guide (GPA Tracker / Timetable / Exams / Today). The token pairs automatically; the popup will show it pre-filled. Copy/paste from the guide still works as a fallback.

## Use

- **Automatic:** open **Registered Courses** (Timetable / Exams) or **Academic Transcript** (GPA) on the SIS. The extension detects changes and syncs them in the background. You'll see `✓` on the toolbar icon and a small toast like `E-JUST Hub: Synced 7 courses`.
- **Manual fallback:** click the extension icon, use **Detect courses** or paste a copied table, review the preview, then click **Sync to Hub**.
- Toggle **Automatic sync** in the popup to pause background syncing at any time.

## Privacy

Only the course/grade table text and the signed sync token are used. No SIS credentials, cookies, or form values are accessed.
