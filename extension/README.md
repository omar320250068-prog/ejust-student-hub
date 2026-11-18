# E-JUST Hub SIS Sync (Chrome / Edge)

A small Manifest V3 extension that reads the **visible course table** on `sis.ejust.edu.eg` and sends the courses/grades to the E-JUST Student Hub through the signed sync API.

It never reads or stores SIS passwords, cookies, or form values.

## Install (3 bullets)

1. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge) and turn on **Developer mode**.
2. Extract this folder, click **Load unpacked**, and choose the extracted `extension` folder.
3. Sign in to the hub, open the sync guide on any of GPA Tracker / Timetable / Exams / Today, copy your **sync token**, and paste it into the extension popup.

## Use

1. On the SIS, open **Registered Courses** (for Timetable / Exams) or **Academic Transcript** (for GPA).
2. Click the extension icon, then **Detect courses**. You can also press `Ctrl+A`, `Ctrl+C` and paste into the popup on desktop; on mobile use the in-app Smart Copy-Paste box in the guide.
3. Review the preview and click **Sync to Hub**. The hub's GPA Tracker, Timetable, and Exams will pick up your synced courses.

## Scope

The extension only runs on:

- `https://sis.ejust.edu.eg/*`
- `https://ejust-student-hub.vercel.app/*`
