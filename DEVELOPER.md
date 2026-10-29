# FS Review: developer handover

A web application for reviewing investment funds' year-end financial statements: document checks, automated
tie-outs, review points, sign-off, a review report, and billing. **README.md** describes every feature in detail;
this page is the quick start and the map.

## Stack

| Part | Technology |
| --- | --- |
| Front end | React 18 (function components and hooks), built with Vite; no UI framework, styles in `src/styles.css` and `src/components/ui.jsx` |
| Server | Node.js 20+, Express, ES modules |
| PDF reading | pdf.js (in the browser); SheetJS for Excel |
| PDF writing | pdf-lib (invoices and the review report, made in the browser) |
| OCR | Tesseract (`tesseract.js` with offline English data), on the server |
| Email | nodemailer (SMTP) |
| AI | Anthropic Claude API, called only from the server |

## Run it

```
npm install
cp .env.example .env        # fill in what you need; every setting is explained there
npm run seed-users          # five starting accounts (one per role except Partner), password 12345678 (change them)
npm run dev                 # web on http://localhost:5173, API on :8787
```

`npm run build` then `npm start` runs the production build. Without a server the app falls back to a demo mode
(accounts and data in the browser), which is how the single-file hosted demo works.

## Where things are

| Folder | What it holds |
| --- | --- |
| `src/App.jsx` | The review workspace: state, actions, permissions, which screen shows |
| `src/tabs/` | One file per screen: Documents, Analysis, Review Points, Sign-off, Disclosures, Portfolio, Engagement, Users, Check Rules, Checklists, AI Settings, Finance, sign-in |
| `src/components/` | Shared pieces: sidebar, entity form, buttons, dialogs |
| `src/lib/` | Logic with no screens: `review.js` and `docChecks.js` (the checks), `fsReader.js` / `tbReader.js` / `isReader.js` (reading documents without AI), `ocr.js`, `reviewStore.js` (review data), `billing.js` (billing rules, shared with the server), `roles.js` (roles and permissions), `notifications.js`, `reviewReport.js`, `invoicePdf.js` |
| `src/data/` | The check library, starter disclosure checklists, built-in sample fund |
| `server/` | `index.js` (routes, AI calls), `auth.js` (sign-in, users), `permissions.js`, `activity.js` (log), `aiSettings.js`, `billing.js` + `billingExtras.js` (email, exchange rates, Xero), `ocr.js`, `passwordReset.js`, `mail.js`, `prompts.js` (AI instructions) |

Server data is written to `server/data/` (JSON files, created on first run, not in the zip).

## Most important thing to know

**Review work is held in the browser** (`src/lib/reviewStore.js`, an in-memory store): documents, review points,
analysis runs, sign-offs, checklist answers and review reports. It is lost on refresh and not shared between users.
Users, permissions, the activity log, billing and AI settings are on the server.

`reviewStore.js` was written as a set of tables (document versions, workflows, review points, point messages,
analysis runs, sign-offs, readings, reports) so it can move to a database. **Moving it to a database (Supabase /
PostgreSQL is the plan) is the top priority**: it brings shared work, server-side enforcement of review
permissions, per-fund access and backups.

## Next priorities (from the gap review)

1. Database for review data, with the permissions enforced on the server.
2. Two-factor sign-in or company single sign-on.
3. Automated tests, especially for the checks (`src/lib/review.js`, `docChecks.js`), the readers, the
   permissions (`roles.js`) and the billing rules (`billing.js`). The ABC and XYZ sample documents have known
   planted errors and make good test fixtures.
4. Secure deployment: HTTPS, secrets kept out of the code, hosting region.
5. Email notifications for review work; year-end roll-forward; an AI spending limit.

## Notes

- The Xero, exchange-rate and email integrations were tested against simulated services only; try them once
  against real ones (a Xero demo company, a test mailbox).
- Reset links use `APP_URL`; never build links from the request's Host header.
- Every AI call goes through the server and is logged with its tokens; the client's and fund's AI decision is
  enforced there.
