# Financial Statement Review — React app

React (Vite) front end. The backend is a separate repository, `api`, which sits beside this one in the
`fs-review` parent folder: it holds sign-in, users, permissions, the activity log, AI settings, the Claude
proxy, OCR and billing on PostgreSQL. The `server/` folder that used to live here was replaced by it on
28 October 2026 (see `api/BACKEND_PLAN.md`); every `/api` route kept its path and payload.

The analysis runs on the api (Phase 6): **Analyse** starts a background job there, and every screen with the
fund open shows its progress from the api's event stream. Closing the tab no longer stops an analysis. This
app keeps its own copy of the checks so the results re-check instantly when engagement settings change.

## Run

```bash
# 1. start the api (in ../api): docker compose up -d && npm run dev    → http://localhost:8787
# 2. start the web app (here)
npm install
npm run dev                 # web on :5173, /api proxied to :8787 (vite.config.js)
# production
npm run build               # static files in dist/, served by any static host; /api points at the api
```

Starting accounts are created by `npm run seed` in the api repo. Settings such as the Claude API key and
mail server live in the api's `.env`, never here.

### Run with Docker

The `Dockerfile` here builds the app and serves it with nginx on port 8080. Its `nginx.conf` passes `/api` to a
container named `api` on port 8787, never buffers the live-update stream, and sends the security headers. Start the
web app and the api together from the api repo, with this repo beside it:

```bash
# in ../api, after copying .env.example to .env.production and filling it in
docker compose -f docker-compose.prod.yml up -d --build      → http://localhost:8080
```

Settings, HTTPS in front and upgrades are in the api's `docs/OPERATIONS.md`, section 8.

## Structure

```
src/App.jsx            State, setup, tab gating, tie-out tray, raising points
src/data/checkLibrary.js  Check library (14 rules), engagement defaults
src/lib/engagements.js  Saving and listing entities and engagements
src/components/EntityModal.jsx  Add and edit an entity
src/lib/roles.js       Roles and permissions (the api enforces the same rules)
src/lib/recognize.js   Document recognition rules (no AI)
src/lib/docText.js     Reads text from PDFs and workbooks in the browser
src/lib/reviewStore.js The fund's review on the api: documents, workflow, analysis jobs and runs, points
src/lib/auth.js        Sign-in client for the api
src/lib/seedUsers.js   Starting accounts
src/tabs/AdminConsole.jsx  Administrator area: Users and roles, Check rules
src/tabs/RuleEditor.jsx   Add and edit check rules
src/lib/library.js     The firm library, shared through React context
src/lib/activity.js    Activity log client for the api
src/tabs/ActivityLogTab.jsx  Administration › Activity Log
src/lib/pipeline.js    Engagement settings applied to the figures (the run itself is on the api)
src/lib/api.js         Calls to the api's OCR route when a scanned document is attached
src/lib/review.js      Deterministic checks, variance model, ranking — no AI
src/lib/files.js       File → PDF base64 / spreadsheet CSV payload (no longer used; the api builds AI payloads)
src/data/sampleFund.js Meridian Global Equity Fund ICAV sample data (the built-in sample documents)
src/lib/useLive.js     The portfolio and the bell, fetched from the api and refreshed on changes
src/tabs/*.jsx         Engagements · Documents · Analysis · Variance · Review Points · Version Comparison
```

## Sign-in and roles

The app opens on a login page. Each role gets its own area:

- **Administrator**: an administration area with **Users and Roles** (staff directory with last sign-in, add user, change role, reset password, deactivate, and the who-can-do-what matrix; accounts are deactivated, never removed) and **Check rules** (the firm's check library; new engagements start from it).

**Check rules** lets the Administrator:
- **Add Rule**: a new firm rule (CHK-15 onwards) that runs as a *tie-out of figures* (add and subtract any figures the app extracts, compare with a stated figure, within a £ or % tolerance; runs in `runChecks`), a *Claude narrative check* (a written instruction added to the narrative review of real documents, passed to the server as data in `<firm_rules>` tags), or *not automated* (recorded only).
- **Edit** any rule: name, description, version, status and approved tolerance. How a built-in rule runs stays in code. Firm rules can also be deleted.
- Set which rules are on by default and their default tolerances (**Save Defaults**).

Firm rule definitions are shared by all engagements, so editing one changes what every engagement runs; bump the version when you do. A rule added after an engagement was saved starts off in that engagement until a Manager switches it on. The library is stored with the engagements (`config/checkRules`).
- **Manager, Reviewer, Preparer**: the review workspace with Engagement, Documents, Analysis, Variance Analysis, Review Points and Version Comparison, with controls limited by role.

Starting accounts are listed in `src/lib/seedUsers.js` (Hamza Mehmood, Administrator; Rahat Kalim, Reviewer; Muhammad Salman, Manager). Run `npm run seed` once in the api repo to add them. They share a known password, so change each one after first sign-in. With no accounts at all, the login page asks you to create the first Administrator instead.

| Permission | Administrator | Manager | Reviewer | Preparer |
|---|---|---|---|---|
| Manage users and check rules | ✓ | | | |
| Add and edit engagements | ✓ | ✓ | | |
| Attach documents | ✓ | ✓ | ✓ | ✓ |
| Run the analysis and version pass | ✓ | ✓ | ✓ | |
| Raise review points and assign them | ✓ | ✓ | ✓ | |
| Respond to review points | ✓ | | | ✓ |
| Clear or reopen points they raised | ✓ | ✓ | ✓ | |
| Clear or reopen any point | ✓ | ✓ | | |
| View engagements, analysis and review points | ✓ | ✓ | ✓ | ✓ |

These are the defaults. Administrators change them in the **Who can do what** matrix on Users and roles: tick or untick roles for each permission and click **Save Permissions** (Reset to Defaults and Discard Changes are there too). The rows are fixed; the Administrator column is always full access, and managing users, permissions and check rules stays Administrator-only. The api stores the matrix in its database, reads it on every request (so a change applies to each person's next action), and logs each grant and removal in the activity log. Screens already open update when the person next signs in.

The rules live in `src/lib/roles.js`. The app uses them to show or hide controls; the api enforces the same rules (from `@fs-review/shared`) in every use case, which is what protects the data.

**On the api**: passwords need at least 8 characters and are stored scrypt-hashed in the database. Sessions are random tokens in an HttpOnly cookie, kept in the database for 12 hours, so they survive a restart. Five failed sign-ins for a username from one address, or 20 from anywhere, block it for 15 minutes. Every review, billing and AI route checks the signed-in person's permissions. The app needs the api: without it, it says the server cannot be reached.

Before production, follow the api's `docs/OPERATIONS.md` (HTTPS, security headers, backups) and `docs/SECURITY.md`.

## Activity log

Every action is recorded: sign-ins (including failed and blocked attempts) and sign-outs; users added, role changes, deactivations, reactivations and password resets (never the password itself); check rules added, edited, deleted and defaults saved; engagements created, updated and put in review; documents attached and removed; analyses and version passes run or failed; review points raised and every status change. Administrators read it under **Administration › Activity Log**, filtered by activity, person or text, and **Export Log (.xlsx)** saves the entries shown (after filters) as an Excel workbook with a second sheet recording when and how it was exported. Each export is itself logged.

**Two views of the log.** Preparers, Reviewers and Managers have an **Activity Log** tab in the review workspace showing only the fund in review: everything anyone did on that fund, but no sign-ins or administration. The Administrator's log shows every entry, with a Fund column and filter. Entries made in the workspace record the fund's engagement id (`engagementId`, `fundName`); entries made before this was added carry no fund, so they appear only in the Administrator's log. On the server, `/api/activity` returns the full log only to Administrators; anyone else must ask for one fund (`?engagementId=`) and receives only its entries.

**On the api**: entries are stored in the database. The api records who did it from the session, never from the request, plus the IP address. There is no route to edit or delete entries. User accounts can be deactivated but not removed, so every entry keeps a valid person.

## Presentation currency per fund

Each fund has a **presentation currency** (GBP by default; also EUR, USD, CHF, JPY, CAD, AUD, HKD, SGD, SEK, NOK, DKK), chosen on the engagement form. Every amount in the review (thresholds, tolerances, checks, variances, review points, the dashboard, the listing) is shown in it (`setCurrency`/`sym` in `src/lib/format.js`). CHK-14 checks the draft against the fund's currency, including accounts that say they are presented in a different one. When AI is used, Claude is told the fund's currency. Billing keeps the firm's own invoicing currency.

## Review report

The permanent record of a fund's review (`src/lib/reviewReport.js`), made as a PDF **automatically at the final sign-off**: the Manager's, or the Partner's where partner sign-off is required (the Manager's sign-off alone makes none). It contains a cover summary (conclusion, points, checks, last analysis); the engagement (client, fund, year end, currency, framework, team, threshold, umbrella and partner settings, rules overridden); the documents reviewed with version, who attached them, their check or confirmation and their **SHA-256 fingerprints**; every check at the final analysis; every review point with its full thread, responses, revised documents and evidence names; the disclosure checklist answers; the sign-off history with conclusions and acknowledged attention items; and the use of AI and OCR. Each report has a version number and its own fingerprint, shown on the Sign-off screen with *Download PDF*; signing off again after an unlock makes a new version and keeps the earlier ones. *Download Draft Report* makes a watermarked DRAFT at any time. Generation is logged. Each report PDF is made in the browser and filed on the api (`POST /api/engagements/:id/reports`, the `review_reports` table, with the file in storage), so anyone who can read the fund can download it later.

## Portfolio dashboard

**Portfolio** (first in the review workspace menu, for all staff) shows every fund's review: headline counts (funds, in progress, ready for sign-off, awaiting partner, signed off, open and overdue points), funds by stage (*Not started*, *Preparing documents*, *Sent back to preparer*, *Ready to analyse*, *In review*, *Returned to reviewer*, *Ready for sign-off*, *Awaiting partner*, *Signed off*; click a bar to filter), and a table of client, fund, year end, stage, **who it is waiting for** (by the fund's named Preparer, Reviewer, Manager or Partner), open, overdue and responded points and last activity. Filters: all funds or **My funds** (where I am on the team), stage, client and search; export to Excel. Clicking a fund opens it at the screen for its stage. Funds with overdue points are listed first. The dashboard is worked out on the api (`GET /api/portfolio`) from every fund in the database, and refreshes when anyone changes a fund.

## Optional per client or fund: partner sign-off and umbrella accounts

Both are **off by default** and are set on the client's entity at onboarding, with a per-fund override in the engagement settings (*Follow the client* / on / off) (`src/lib/engagementOptions.js`).

**Partner sign-off.** By default the Manager's sign-off is final. Where a client or fund requires partner sign-off, the Manager signs off first (*Sign Off (Manager)*), which locks the review and shows *Awaiting partner*; a user with the new **Partner** role then gives the **Partner Sign-off** (final; the fund then goes to Finance for invoicing) or **returns it to the reviewer** with a reason. Partners work in the review workspace; by default they can raise points, clear or reopen any point and give the partner sign-off (permission *Partner sign-off, where a client or fund requires it*). The Partner's bell shows reviews ready for partner sign-off; a fund can name its Partner on the engagement.

**Umbrella accounts.** Where a client prepares one set of accounts covering all its funds, each fund's figures are read from **its own column** (one column per sub-fund, with or without years underneath, and a Total column) or **its own section** (statements under the sub-fund's heading); notes that apply to all funds are kept. Each fund can give its **name in the umbrella accounts** if it differs from the fund name. The Documents screen explains this and offers **Use These Umbrella Documents** to attach the draft, signed accounts and supporting information already attached to a sister fund; a sister fund with a newer umbrella draft shows in the bell. A new CHK-03 row, **Sub-funds add up to the umbrella totals**, checks every Total column against the sub-fund columns. When AI reads an umbrella document it is told which sub-fund to read, and its reading is kept per fund. The trial balance and investment schedule remain each fund's own.

## CHK-13: disclosure checklist

- **Which checklist:** the client's **accounting framework** (FRS 102, IFRS or Other) is set on its entity; its funds use that framework's checklist. The Administrator maintains one checklist per framework under **Administration › Disclosure Checklists**: edit items (Ref, Section, Requirement, Keywords), **Import from Excel** (first sheet, a *Requirement* column plus ideally Ref, Section, Keywords), export, and **save as a new version** (v1, v2…). Short **starter checklists** for investment funds are provided and clearly marked; replace them with the firm's own. A review copies the checklist version when first answered, so later edits don't change a review in progress.
- **On or off at three levels:** CHK-13 is a rule in the firm's **template** (off by default); a **client** can be set to *Always on* or *Always off* on its entity; a **fund** can override either way in its own settings. The engagement form shows *Template*, *Client setting* or *Overridden* for each rule, with *Reset*. (Client-level overrides work for any rule; the entity form offers CHK-13.)
- **Completing it:** the **Disclosures** tab lists each item with a suggestion of where it may be disclosed (a keyword search of the draft, no AI). The reviewer answers *Yes*, *No* or *N/A* with a reference; each answer records who and when. Every **No** raises a review point (RP-D1, RP-D2…) for the preparer. CHK-13 shows *Not tested* until every item is answered, then *Agrees* or the number of missing disclosures. With CHK-13 on, the Manager can't sign off until every item is answered.
- AI suggestions for checklist answers are not built yet.

## Document checks (no AI)

`src/lib/docChecks.js` adds checks that work on the documents themselves:

- **CHK-03 Every subtotal and total casts**, in the statements and notes, for both years, and across tables with a Total column (Level 1 + 2 + 3). A total equals the lines since the previous total, or the previous total plus those lines (running totals such as net operating profit).
- **CHK-04 Note totals agree to the statements**: each note total is tied to the statement line that refers to it ("Note 3") or whose wording matches.
- **CHK-07 Investment schedule agrees to the trial balance**: the schedule total against the ledger accounts mapped to the investments line (CHK-02 mapping), or found by name.
- **CHK-14 Amounts are in the presentation currency** (now active): any amount in another currency, e.g. a EUR comparative in GBP accounts.
- **CHK-12 Dates in the narrative belong to this year** (now active): an approval date of the financial statements on or before the year end, or another approval dated before this financial year began; a "year ended" date from last year. Director names and other carried-forward wording remain with the AI narrative review.

Checks that count findings (CHK-12, CHK-14) show "2 found" and raise points titled by what was found, not as money differences.

## Check rules per engagement: template and overrides

The firm's check rules (defaults plus the Administrator's changes) are a **template that applies live**. An engagement stores only its **overrides** (`ruleOverrides`); in the engagement form each rule shows *Template* or *Overridden* with *Reset*. When the Administrator changes the template, every engagement that has not overridden that rule follows it. Engagements saved before this keep their full copy of the rules, shown as overrides where they differ from the template, and are converted on the next save.

## CHK-02: trial balance to statements

`src/lib/tbMapping.js`; no AI. Each fund has a **trial balance mapping**: every ledger account is mapped to one line of the primary statements (Statement of Financial Position, Statement of Comprehensive Income, Statement of Changes in Net Assets). It is saved on the engagement (`tbMap`, with who saved it and when) and used by every later analysis of that fund.

- **Mapping.** On the Analysis tab, *Map Trial Balance* opens a window listing each account with its balance. *Suggest Mapping* fills unmapped accounts by matching names on the same side of the ledger (balance sheet assets and negative results lines are debits; liabilities and positive lines are credits), and sends fee, cost and expense accounts to the expenses line. A person confirms or corrects every choice; the window shows each line's result live. Anyone who attaches documents or runs the analysis can map; the mapping is read-only after sign-off.
- **The check.** For each mapped line, the accounts are netted (debits minus credits) on the line's side and compared with the draft within the CHK-02 tolerance, so a wrong-side account also shows as a difference. A second row checks that **every account with a balance is mapped**. Calculated lines such as the increase in net assets from operations need no accounts; casting (CHK-03) and the net asset movement (CHK-06) cover them.
- Saving a mapping re-runs the check immediately; no new analysis or AI call is needed. Real trial balances are read with account codes and Debit/Credit columns (see the extraction instructions in the api's `src/application/ai/prompts.ts`).
- **Excel trial balances are read without AI** (`src/lib/tbReader.js`). The reader finds the header row (Debit and Credit columns, or a single signed Balance column), the account code and name columns, every account row (amounts as numbers or text such as "(1,234.50)" or "1,234 CR"; section headings skipped) and the totals row, and picks up the reporting date from the title. At upload the card shows "Can be read without AI"; such a trial balance no longer needs AI, so CHK-01 and CHK-02 run on a real trial balance even when AI is off or the client does not permit AI. A workbook in a layout the reader does not recognise falls back to AI, as before. The suggestion understands common ledger abbreviations (FVTPL, WHT, NAV, b/f, Mgmt, rec, inv and so on).
- **PDF statements and supporting information are read without AI too** (`src/lib/fsReader.js`), when the PDF is digitally produced (has a text layer). The reader rebuilds each page's lines from the position of every piece of text, recognises statement and note headings, column headers (years, or Level 1/2/3), table rows (numbers placed under their column by right edge), sub-headings such as "Liabilities", totals and paragraphs, then picks out the figures the checks need by fixed rules (asset and liability lines and totals, net assets, income lines and total, expenses, the net asset movement including distributions, the investment note total, the fair value levels, the management fee charged, and the prospectus fee rate). The card says whether every figure was found. If it was, the app's own reading is used; if some were not and AI is available, AI reads the document fully; without AI the partial reading is used and the checks it cannot support show *Not tested*. Scanned PDFs (no text layer) are read with OCR on the server (below), or by AI. The **narrative review** and **variance explanations** still need AI by their nature; with AI off the analysis says they were skipped.
- **Scanned PDFs are read with OCR on the api** (`POST /api/ocr`, the api's `ReadScannedPages` use case and `TesseractEngine`; `src/lib/ocr.js` here), with no AI: the browser draws each page as an image, the api reads it with **Tesseract** (open source; the English language data is installed with the api, so nothing leaves the server), one page at a time with a limit of 90 seconds a page, and logs each reading in the fund's activity log. During an analysis the api draws the pages itself and keeps the OCR reading by content, so a file is read once. The words come back with their positions so the same reader rebuilds the tables. OCR artefacts are cleaned (stray marks, letters misread inside numbers such as O→0, a full stop misread as a thousands comma). The card shows "Scanned PDF read with OCR … (N pages, confidence %)" and warns when confidence is low. Because OCR can misread a digit, every difference found in a document read by OCR says so, asking for the figure to be confirmed against the document before a point is raised. Reading takes a few seconds per page and is done once per file content. **When OCR confidence is low** (below 70%), the card is marked *Needs a check*, the bell alerts whoever handles the documents, and the user chooses: **Read with AI** (offered only when AI is permitted for the client and switched on; the choice is recorded and logged, and the analysis then sends that document to AI), keep the OCR reading (*Confirm Anyway* with a reason), or replace it with a clearer scan.
- **CHK-06 includes distributions** (opening + subscriptions − redemptions + result − distributions = closing), read from the statement of changes in net assets, so distributing funds no longer show a false difference.
- **Excel investment schedules are read without AI too** (`src/lib/isReader.js`): a summary by asset class is used as printed; a list of holdings is added up by its asset class column (or its total when there is no class column), with fair value levels and holdings shown for reference. The card shows "Can be read without AI" with the number of classes, holdings and the total, and warns if the schedule's own total differs from the sum of its lines. CHK-07 then runs without AI.
- CHK-02 is on for new engagements. Engagements created before it existed have it off; turn it on under the engagement's checks.

## Document file types

Each document slot accepts one file type, set in `src/lib/fileRules.js`:

| Document | Accepts |
|---|---|
| Current Year Draft Financial Statements | PDF |
| Prior Year Signed Financial Statements | PDF |
| Trial Balance | Excel (.xlsx) |
| Investment Schedule | Excel (.xlsx) |
| Supporting Information | PDF |

The file picker only offers that type, and `src/lib/validateFile.js` checks every file (button or drag and drop, and the next draft on Version Comparison) before it is attached: the extension, that it isn't empty or over 25 MB, and that the content really is that type, so a renamed file is caught by its first bytes. PDFs must be complete and not password-protected; workbooks must open and contain a worksheet. A refused file shows the reason on its card and is recorded in the activity log. The api repeats the extension, size and first-bytes checks when the file is uploaded (`POST /api/engagements/:id/documents`), and checks the file type again before a document is sent to Claude.

## Document recognition and the Ready for Review step (no AI)

When a document is attached, the browser reads its text (PDFs with pdf.js, spreadsheets with SheetJS) and `src/lib/recognize.js` applies fixed rules; no AI and no API key are involved. It works out:

- **Which document it is**, by scoring wording and layout: primary statements and notes; draft markers against an auditor's report and approval; minutes and prospectus wording; Debit and Credit columns; market value, quantity and price columns. Draft and signed statements are also told apart by their reporting date.
- **Which fund**: the fund's name or its entity's name must appear (so umbrella accounts pass); naming another fund in the app is a mismatch.
- **Which date**: the draft, trial balance and investment schedule must be at the engagement's year end, and the signed accounts one year earlier.
- **Trial balance arithmetic** (debits equal credits) and **duplicates** (the same file in two slots, by SHA-256).

Each document is **Recognised**, **Needs a check** (something couldn't be found, or the file has no readable text, as with scanned PDFs), or **Mismatch** (wrong document, fund or date, or a duplicate). A check or mismatch can be cleared by replacing the file or with **Confirm Anyway**, which records the person and, for a mismatch, a required reason. Every upload is kept as a numbered version with who uploaded it and when.

**Mark Ready for Review** is available once every required document is attached and cleared; the documents are then locked and **Analyse** becomes available. A Reviewer or Manager can **Send Back to Preparer** with a reason, which unlocks the documents and disables Analyse until they are marked ready again. Each step is recorded in the fund's activity log.

**Same content, same document.** A document's identity is its content fingerprint (SHA-256), never its file name (built-in samples, which have no file, are identified by their sample name). Uploading a file whose content matches the current version makes no new version, whatever it is called; the card says so. A file matching an older version becomes a new version marked "same content as vN".

**Running the analysis again.** Each analysis records the document versions it read; changes since then are compared by content.

**AI reads each document's content only once.** An AI reading of a document is stored on the api with its content fingerprint, the slot and the model (the `document_readings` table). When the analysis runs again, only documents whose content is new are sent to AI; unchanged documents, and files restored to earlier content, reuse their earlier reading. Narrative review, variance explanations and the version pass still run on any change, because they look across all documents together. The analysis summary and the activity log say how many documents were read and how many readings were reused. Changing the model under AI Settings causes each document to be read once with the new model. After it has run, **Run the Analysis Again** is disabled for everyone until a document changes since that run (a new version, a removed document or a newly added one); the Documents screen says which documents changed. A change to the engagement's settings does not re-enable it: the checks table updates straight away, and review points refresh the next time a document changes. The version pass on Version Comparison is a document change in itself, so it is unaffected.

**Storage.** Documents, versions, results and the workflow go through `src/lib/reviewStore.js`, which reads and writes only the api. The api keeps the records in its database (`document_versions`, `workflows`, `analysis_jobs`, `analysis_runs`, `document_readings`, `review_points`, `point_messages`, `point_evidence`, `disclosure_checklists`, `signoffs` and `review_reports`) and the files in object storage (an S3 bucket, or a local folder when no S3 settings are given). Everyone sees the same review, and colleagues' changes arrive through the api's event stream (`/api/events`). Recognition runs in the browser, which sends its result to the api; the same rules could also run on the api, since `recognize.js` has no browser dependencies.

## Review points: raise, respond, clear

Each review point is a record in `src/lib/reviewStore.js` with who raised it, who it is **assigned to**, its status and a thread of messages that are never edited or deleted.

- **Status cycle:** Open → Responded → Cleared, or Reopened → Responded → Cleared. Cleared points stay on record and can be reopened.
- **Who does what** (permission matrix, Users and Roles): *Raise review points and assign them* (Reviewer, Manager), *Respond to review points* (Preparer), *Clear or reopen points they raised* (Reviewer, Manager) and *Clear or reopen any point* (Manager). A Preparer can never clear a point; that is fixed.
- **Analysis points** are saved when the analysis runs and assigned to the engagement's Preparer. When a later draft is analysed, existing points keep their status and thread and get an app note ("Re-tested on draft v3: appears resolved"); nothing is cleared automatically.
- **Review Points tab:** filters for *Waiting for Me*, *With Preparer*, *Responded*, *Cleared* and *All*; the sidebar shows how many points are waiting for the signed-in person. The Preparer sends a response; the person who raised the point (or a Manager) clears it or reopens it with a reason; anyone involved can comment, and a Reviewer or Manager can reassign it.
- **Analysis runs** are kept with the document versions they read, so the latest analysis reopens for whoever opens the fund.
- Every raise, response, reopen, clear, comment and assignment is in the fund's activity log.

### Manager sign-off

The **Sign-off** tab is the Manager's final review. It becomes ready when the analysis has run, the documents are marked ready and every point is cleared. It shows:

- every point with who cleared it, how many responses and reopens it had, and the last response;
- **Needs Your Attention**: High points cleared without a response from the preparer, documents confirmed despite a check or mismatch, a draft attached after the last analysis, checks still showing a difference and variances still marked to investigate. These don't block sign-off, but the Manager ticks that they have considered them;
- the current document versions and the latest analysis.

The Manager (permission *Sign off the review, or unlock it*) either **signs off** with a conclusion or **returns it to the reviewer** with a reason; a Reviewer then **resubmits** it. Signing off **locks** the engagement: documents, points, analysis and engagement settings become read-only, and the fund shows *Signed off*. Only someone with the sign-off permission can **unlock** it, with a reason. Every step is in the sign-off history and the activity log (category *Sign-off*), and the summary the Manager saw is stored with the sign-off.

- **Revised documents and evidence on responses.** When responding, a Preparer can attach a **revised document** (it becomes the next version of that document, checked like any upload, even while the documents are locked, and refused if its content is unchanged) and **evidence** files (PDF, Excel, CSV, Word, images, email, text; up to 25 MB), kept with the point and downloadable from the thread. If a revised document needs a check, *Confirm Anyway* stays available while the documents are locked.
- **Types and due dates.** Each point is *Needs a change*, *Needs an explanation* (the default for variance points) or *For information*, and can have a due date; both are set by whoever can raise points and noted in the thread. Overdue points are marked, can be filtered, and appear in the assignee's bell.

## AI settings (Administrators)

**Administration › AI Settings** controls where the app uses Claude (the api's `src/application/ai/AiSettingsUseCases.ts`, `/api/ai/settings`; `src/lib/aiOptions.js` here). Settings are saved in the api's database (the `ai_settings` table) and enforced by the api on every Claude call (`RunAiStep`): with no key, AI turned off, that step turned off or a client that does not permit AI, the call is refused.

- **Connection.** The API key is never entered or shown in the app: it stays in the api's environment (`ANTHROPIC_API_KEY` in the api's `.env`). The page shows whether a key is configured and its last four characters, and **Test Connection** makes one tiny call.
- **Use of AI.** AI is **off until an Administrator turns it on**, which requires confirming that the firm's policy allows client data to be sent to Anthropic (who confirmed and when is recorded).
- **Where AI is used.** Separate switches for reading real documents, narrative review, variance explanations and the version pass. When one is off the analysis says which steps ran without AI; with the version pass off, a new draft's points are matched to earlier ones by the app (by title), not by AI.
- **Per client, decided at onboarding** (`src/lib/aiDecision.js`). Adding or editing an Entity requires recording whether the client permits AI (*AI permitted* / *AI not permitted*) and the basis, for example the engagement letter; who recorded it and when are kept. A client with no recorded decision (including entities saved before this was added, shown as *AI assistance off*) is treated as **no AI** until someone records one. A fund follows its client, and can additionally be opted out (*Don't use AI for this fund*, with a reason), but never opted in when the client said no. The fund dashboard shows *AI: Permitted / Not permitted / Not decided / Off for this fund*, and every decision is in the activity log.
- **Model.** Claude Sonnet 5.5 (recommended), Opus 5.5 or Haiku 5.5.
- **Logging and labels.** Every Claude call is recorded in the activity log (category *AI*) with the step, model and token counts, and settings changes are logged too. Narrative points and variance explanations written by Claude are labelled *Drafted by AI*.
- Anthropic's errors are shown in plain language (for example, a rejected key or an overloaded service).

Next: a monthly spending limit and a usage report. The token counts they need are already stored in the database with each AI entry in the activity log.

## Self-service password reset

On the sign-in page, **Forgot your password?** asks for a username or email address and emails a **one-time link valid for 30 minutes** (the api's `RequestPasswordReset` and `ResetPassword` use cases, `/api/auth/forgot` and `/api/auth/reset`). The answer is always the same, whether or not an account matches, so the form can't reveal who has accounts; requests are limited to 10 an hour per address and 3 an hour per account. Only a SHA-256 fingerprint of the link's secret is stored (the `password_resets` table), and a new request deletes that person's older unused links. The link opens **Choose a new password** (same password rules); saving ends all of that person's sign-ins, the link can't be used again, and both the request and the reset are in the activity log. Accounts need an **email address**, which the Administrator sets when adding or editing a user.

Api settings (in the api's `.env`): the email settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, and `MAIL_FROM`, or the older name `BILLING_FROM`) and **`APP_URL`**, the address people use to open the app. The api will not start without `APP_URL`, and in production it must use https. Reset links are always built from `APP_URL`, never from the incoming request, so a forged Host header can't point a link at another site. Without `SMTP_HOST` and a from address the sign-in page keeps saying "Ask an Administrator to reset it"; the Administrator's own reset remains available.

## Billing (Finance)

A separate **Finance** role works only in the billing area (Ready to Invoice, Invoices, Recovery, Billing Settings) and cannot see documents, the analysis or review points. Only Finance can bill; Managers and Reviewers see no billing or cost information. The rules that change billing live in the api's shared workspace (`shared/src/billing.ts`, `applyBilling`) and are enforced by the api (`BillingActions`, `/api/billing`, which needs the `billing.manage` permission). Each change is read, checked and saved in one database transaction. Billing is kept in the api's database (the `billing_settings`, `billing_events`, `invoices`, `invoice_transactions` and `billing_sequences` tables). The screens use `src/lib/billing.js` here for totals, ageing and recovery figures.

- **From sign-off to invoice.** When a Manager signs off a fund, the app sends Finance a sign-off event (fund, client, year end, who signed off); unlocking sends another. Signed-off funds appear under **Ready to Invoice**.
- **The invoice.** A draft has a professional fee line (default set in Billing Settings) and an **AI usage line** worked out from the fund's recorded AI calls: calls and tokens, cost at the model's prices converted to pounds, plus the markup. Finance can add lines, change amounts (reducing the AI charge needs a reason), set VAT and payment terms, then **Issue**: the invoice gets a number (e.g. INV-2026-0001) and a due date, and its lines and AI usage are locked so usage is never billed twice. Invoices export to Excel with an AI usage detail sheet.
- **Recovery.** Record payments (never more than outstanding), write off a balance with a reason, or cancel an unpaid invoice with a credit note (its AI usage becomes billable again). AI usage recorded after an invoice (for example after an unlock and re-analysis) appears again under Ready to Invoice for a **supplementary** invoice. The **Recovery** report shows billed, collected (cash recovery %), outstanding, overdue, written off, the ageing of what is owed, AI cost against AI recharged (AI recovery %) and unbilled AI, in total and by client, with Excel export.
- **Prices.** No prices are built in: Finance enters each model's prices from Anthropic's pricing page (US dollars per million tokens), the USD to GBP rate and the markup. Until then AI usage shows on invoices without a charge, and an invoice with unpriced AI usage can't be issued.
- Every billing action is in the activity log (category *Billing*), and Finance's bell shows funds ready to invoice, overdue invoices and funds unlocked after invoicing. AI usage comes from the AI entries the api writes to the activity log.

### Billing extras: PDF, email, credit notes, period lock, exchange rates, Xero

- **PDF invoices** (`src/lib/invoicePdf.js`, made in the browser): firm details and VAT number, invoice number and dates, the client and fund, each line (with the AI usage at cost and markup), net, VAT, total, any credit notes and payments with the balance due, and the payment terms. *Preview PDF* on drafts, *Download PDF* once issued.
- **Email** (on the api, the `EmailInvoice` use case, `/api/billing/email`): *Email Invoice* sends the PDF to the client's **billing contact email** (set on the entity) with subject and message templates from Billing Settings (`{number}`, `{firm}`, `{fund}`, `{due}`). Each email is recorded on the invoice and in the activity log. Api settings: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `MAIL_FROM` (the older name `BILLING_FROM` still works).
- **Partial credit notes:** *Raise Credit Note* credits any amount up to what is owed, with its own number (CN-2026-0001), the VAT split out and a reason; the invoice shows *Part credited* or *Credited*, and the recovery report shows credits.
- **Period lock:** a lock date in Billing Settings (with a reason, logged). Nothing can be issued, paid, credited, written off or cancelled on or before it; an invoice issued in a locked period can only be corrected by a credit note.
- **Exchange rate:** *Update Rate Now* fetches the European Central Bank's daily USD to GBP reference rate (via api.frankfurter.app) and records its date and source; `BILLING_FX_AUTO=1` in the api's `.env` updates it twice a day. Issued invoices keep the rate they were charged at.
- **Xero:** connect your Xero organisation (OAuth through `/api/xero/connect`; api settings `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI` from an app at developer.xero.com), then *Send to Xero* posts an issued invoice as an authorised sales invoice (ACCREC) with your sales account code and tax type. Xero's tokens last 30 minutes; the api refreshes them one at a time when they are about to expire and keeps the connection in its database (the `xero_connection` table). Without a connection, *Export for Xero (.csv)* on the Invoices screen produces Xero's sales invoice import file. The Xero and exchange-rate calls were tested against simulated services, not live ones.
- When the api has no email or Xero settings, Billing Settings says which settings are missing; PDFs, credit notes, the lock date and the Xero CSV work either way.

## Notifications (the bell)

The bell in the top bar of the review workspace shows, across every fund, what concerns the signed-in person (`src/lib/notifications.js`):

- **Needs your action** (stays until done): points waiting for your response or reopened; responses waiting for you to clear; documents sent back to you; documents ready (or changed and ready) for you to analyse; a review ready for your sign-off; a review returned to you.
- **Updates** (from other people): responses to points you raised; your points reopened, cleared, commented on or assigned to you; an analysis that assigned you points; documents marked ready or sent back; reviews returned, resubmitted, signed off or unlocked.

A fund's Preparer, Reviewer and Manager fields decide whose items they are; when a field is empty, everyone whose role has the matching permission is included. The badge counts the to-dos plus updates since you last opened the bell (remembered per person in this browser). Clicking an item opens that fund and screen. The items are worked out on the api (`GET /api/notifications`, rules in the api's `shared/src/reviewStatus.ts`) and refresh when anything changes. Notifications are in-app only; there are no notification emails yet.

## Entities and funds

An **entity** is the legal entity funds belong to (an ICAV, SICAV, unit trust and so on), with its client name, legal form, jurisdiction, financial year end, administrator and auditor. Each fund engagement links to one entity by `entityId`, never by name, so renaming an entity updates every fund under it.

- The Engagement listing groups funds under their entity, with a search across entity, client and fund names.
- **Add Entity** (top of the listing, or "+ Add a new entity…" inside a fund's form) and **Edit Entity**. Entity names must be unique, ignoring case and spacing.
- **Add Fund** on an entity starts a fund already linked to it, with the entity's year end filled in.
- The Entity field is required to save a fund; changing it moves the fund, and the move is logged.
- Funds saved before entities existed appear under "Not linked to an entity" until a Manager links them.
- Creating, editing and moving are logged in the activity log. Entities can't be deleted, so a fund's history always points at a real entity.
- Who can add and edit entities follows the "Add and edit engagements" permission.
- **Preparer, Reviewer and Manager** are chosen from lists of active users with that role (Users and Roles). A fund stores each person's user id and their name at the time, so renames show everywhere; a deactivated person stays visible, marked, until replaced; names typed before the lists existed are kept until replaced. The lists come from `/api/people`, which returns names and roles only, to any signed-in user.

Entities are stored on the api alongside engagements (the `entities` and `engagements` tables), shared by everyone. Reviews still run per fund; if your accounts are prepared once per umbrella, the entity is where umbrella-level review would attach.

## Engagements and the check library

The **Engagement** tab (first in the sidebar) opens the engagement listing. **Add Engagement** at the top opens a new engagement; **Save Engagement** at the bottom adds it to the listing and makes it the engagement under review. **Open** edits a saved engagement. When the app loads only the Engagement tab is available; clicking **In Review** on an engagement enables Documents and shows that fund's dashboard across the top. Analysis and the other tabs open once the analysis has run. Putting a different engagement in review clears the previous engagement's documents and results.

Engagements are stored by `src/lib/engagements.js`, which calls the api (`/api/entities`, `/api/engagements`, `/api/config/check-rules`, `/api/config/checklists`); the api keeps them in its database, shared by everyone. The lists refresh after every save, when the window regains focus and every 20 seconds. Engagements a browser saved in localStorage before the api existed are moved to the api once, the first time that browser opens the app while the api has none.

Each engagement holds:

- **Fund**: name, year end (date), preparer, reviewer and manager, shown in the sidebar. Name and year end are required to save.
- **Review parameters**: review threshold, the multiple of the threshold that makes a point High priority, an optional management fee rate override (otherwise the prospectus rate from supporting information is used) and the fee period in months.
- **Variance listing (CHK-11)**: *Every material movement* follows the approved rule; *Material and outside expectation* lists only material lines that are also outside the Investigate / Explain bands.
- **Narrative review**: switches the Claude narrative call on or off. It covers CHK-12 and CHK-14 as judgement, not as exact-match tests.
- **Check library**: the 14 rules from `src/data/checkLibrary.js`. Rules the app can run have an on/off switch and an editable tolerance (CHK-10 can be £ or %). A tolerance that differs from the approved version is marked. Rules not built yet (CHK-02, CHK-09, CHK-13) are listed with what they need.

Changing the engagement after an analysis re-runs the checks table immediately. Review points are refreshed when the analysis is run again; a banner says so.

To add or change a rule, edit `LIBRARY` in `src/data/checkLibrary.js`. A rule with `engine: 'code'` lists the check ids in `src/lib/review.js` that implement it (`impl`).

## Claude API call sites

The four Claude steps run on the api, inside an analysis job (`POST /api/engagements/:id/analysis-jobs`); there are no separate Claude routes. They are in the api's `src/application/analysis/AiAnalysisSteps.ts` and go through `src/application/ai/RunAiStep.ts`, which applies the AI settings and the client's decision and logs every call with its token counts. The instructions and answer schemas are in `src/application/ai/prompts.ts`. All calls use `temperature: 0` and forced tool use, so the output is always JSON matching a schema.

**① Document extraction** (step `extract`)
- When: during an analysis, in parallel, for each uploaded (non-sample) document the app's own readers could not read in full. A stored reading of the same content, slot and model is reused instead.
- Sends: the PDF as a `document` block, or the workbook as CSV text.
- Returns: `{ title, meta, blocks, figures }`. `blocks` drives the document viewer. `figures` are the normalised numbers the checks run on (`ca`, `cl`, `statedTA`, `statedNA`, `sched`, `tbDr`, `mgmtRate` …, listed in `FIGURE_KEYS`).
- Replaces: the hard-coded `docs` and `K` in the sample data.

**② Narrative & disclosure review** (step `narrative`)
- When: after extraction and the deterministic checks, if the engagement's narrative review is switched on.
- Sends: extracted current year, prior year, investment schedule and supporting information, plus the firm's narrative rules.
- Returns: review points such as stale prior-year text, directors vs minutes, undisclosed subsequent events and wrong currency labels. Each point has an `anchor` so the viewer can highlight the line.
- Replaces: the hand-written qualitative points (RP-02, RP-04, RP-05, RP-07).

**③ Variance commentary** (step `explain`)
- When: after the variance model has put lines into bands. Only lines outside expectation are sent, with the prior year accounts and supporting information.
- Returns: `band`, `pri`, `expect`, `note` and `action` per line. Claude may move a line from Explain up to Investigate, but never down: when Claude's band is lower, the variance model keeps its own (`varianceModel` in the api's `shared/src/analysis/checks.ts`, and its copy in `src/lib/review.js` here).
- Replaces: the hand-written `VAR_NOTES`.

**④ Version pass** (step `version`)
- When: a next draft is analysed from the Version Comparison tab (an analysis job in `nextDraft` mode). With the version pass off under AI Settings, earlier points are matched to the new draft's points by title instead.
- Sends: the earlier points, candidate points on the new draft, and the previous and new current year drafts.
- Returns: resolved or outstanding status for each earlier point, plus which candidates are genuinely newly introduced.
- Replaces: the scripted `v2`/`v3` statuses.

## Deliberately not Claude

- Casting, tie-outs, net-asset roll-forward and fee recalculation run in `runChecks`.
- Variance banding uses the threshold and expected growth in `varianceModel`.
- Ranking, the tie-out tray maths and status changes are also handled in code.

This keeps every number reproducible and auditable. Claude reads documents and writes judgement-style text; code does the arithmetic.

## Before production

- **Data**: client financial statements are sent to Anthropic. Confirm your data processing terms and retention settings first.
- **Auth**: sign-in and roles are built in (see above). Add per-user limits on analyses that use AI if needed.
- **Validation**: spot-check extracted `figures` against the source document. A wrong extraction makes a check fail, which is then visible in the Analysis tab rather than hidden.
- **Large files**: very long PDFs may hit request size or token limits. Split by statement, or raise `maxTokens` for the `extract` step in the api's `src/application/ai/RunAiStep.ts` (16,000 now).
- **Persistence**: the api stores everything in Postgres and the files in object storage. Set up the backups and the restore test in the api's `docs/OPERATIONS.md` before real client data goes in.
- **Word documents**: `.docx` is not parsed. Convert to PDF before upload, or add a parser such as mammoth.
