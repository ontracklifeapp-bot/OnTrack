# OnTrack

**A planner for students and everyday life — tasks, bills, homework, reminders and grades in one place.**

🔗 **Live:** [ontracklife.app](https://ontracklife.app)

OnTrack is a web app (installable as a PWA) built with React Native + Expo and Firebase. It started as a personal tool to keep track of recurring chores, bills and school work, and grew into a full product with accounts, daily email digests, calendar sync and a browser extension that imports grades from a school gradebook.

---

## Features

**Planning**
- Tasks, bills, homework and reminders with due dates, repeat schedules (daily → yearly, custom intervals) and notes
- Home dashboard of what's overdue, due today and coming up; quick add; search; snooze (tomorrow / 3 days / next week / pick a date) with undo
- Month calendar with every item's future occurrences
- Bills: payment history, "this month: paid vs. left to pay", auto-advancing recurring bills

**Staying on top of it**
- Daily 7am email summary in each user's own time zone (Cloud Functions + scheduled job)
- Private calendar feed (iCalendar) that subscribes in Google Calendar, Apple Calendar or Outlook
- Phone-style swipe navigation on mobile, sidebar layout on desktop, dark/light themes

**Grades** (with the OnTrack Chrome extension)
- One click imports grades, every quarter's assignments, the teacher's real category weights and past school years
- Exact grade calculated from assignments (the gradebook only shows a rounded one), semester grades from quarters + exams
- "What-if" mode: change any score or add hypothetical grades and see the projected grade live
- Weighted GPA with editable class boosts (AP / Honors / Dual / custom), drag-to-reorder classes, change since last update

---

## Tech stack

| Area | Tools |
|---|---|
| App | React Native, Expo (Router, web export), TypeScript |
| Backend | Firebase Authentication (email + Google), Cloud Firestore, Cloud Functions (Node 22), Firebase Hosting |
| Email & calendar | Nodemailer (Gmail), scheduled functions, iCalendar (RFC 5545) feed |
| Extension | Chrome Extension Manifest V3 (service worker, `scripting`, optional per-site permissions) |
| Quality | ESLint, TypeScript checks, Sentry error tracking (no personal data) |

---

## Engineering highlights

- **Privacy-first grade import.** The extension never handles passwords and never logs in for the student. It runs only when clicked, only on the gradebook site the student approves, and reads the pages *they* are signed in to. Data is handed to the web app through the URL fragment (which browsers never send to a server), validated, and stored only in the student's own account.
- **Security rules as the source of truth.** Firestore rules restrict every document to its owner and validate shapes and sizes (allowed collections, field types, text lengths, numeric ranges), so a modified client can't write junk or read anyone else's data. Secrets (e.g. the mail password) live in Secret Manager, never in code.
- **Grade math that matches the gradebook.** Category-weighted averages with *adjusted weights* (empty categories are excluded and their share redistributed), quarter → semester rollups, and what-if projections — all pure functions shared across screens.
- **Time-zone-correct scheduling.** The daily digest runs hourly and sends at 7am in each user's zone, de-duplicated per local day.
- **One codebase, web + phone.** Platform-specific files (`*.web.tsx`) swap in web implementations (date pickers, Google sign-in popup, error tracking) without forking the app.
- **Mobile web polish.** A swipeable page strip for tabs (CSS transforms + GPU transitions, no re-renders mid-drag) and a drag-to-reorder list built on PanResponder.

---

## Project structure

```
app/                 Screens (Expo Router): tabs, add/edit forms, grades, class detail, settings, landing page
components/          Shared UI (date picker, swipe pager, snooze sheet, drag list, emoji & gradebook pickers…)
utils/               Dates & repeat rules, grade math, import validation, notifications, theme
firebase/            Firebase setup (config comes from .env)
functions/           Cloud Functions: daily email digest, test email, calendar feed + links
extension/           OnTrack Chrome extension (Manifest V3)
scripts/             Store build for the extension
firestore.rules      Database security rules
```

---

## Running it yourself

1. `npm install`
2. Create a Firebase project with Authentication, Firestore and Hosting, then copy `.env.example` to `.env` and fill in your web app config.
3. `npx expo start --web`

Cloud Functions need the Blaze plan and a `GMAIL_APP_PASSWORD` secret (`firebase functions:secrets:set GMAIL_APP_PASSWORD`).

---

*This repository is a public snapshot for portfolio purposes; the live app's configuration and user data are not included.*
