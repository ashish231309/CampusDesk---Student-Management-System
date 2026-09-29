# CampusDesk — build progress

Working notes for the staged build of CampusDesk. This file is a development
aid only and is removed once the application is complete.

## Stage 01 — Project foundation & architecture  ✅

- npm workspace monorepo (`client` + `server`) with shared root scripts
- React 19 + Vite + Tailwind CSS 4 frontend, design tokens for the approved palette
- Express 5 API with config, routes, controllers, services, middleware and validators layered
- Mongoose models for `User`, `Student` and `Counter`, incl. generated student IDs
- Reusable UI kit, responsive app shell, routing architecture, API client
- `.env.example` for both apps, MIT license, README

Deliberately **not** implemented yet: real authentication, real student CRUD,
file uploads, production hardening.

## Stage 02 — Backend & database foundation  ✅

- MongoDB connection handling: bounded query timeout, honest readiness status, clean
  disconnect, no credential leakage; production still refuses to boot without a database
- `Student` and `User` models finalised — validation, normalisation, unique indexes,
  generated `CDS-YYYY-NNNN` IDs via an atomic counter (safe under concurrent writes)
- Student API complete through route → controller → service → model: list (search,
  filters, sorting, pagination), detail, create, update, delete and dashboard statistics
- Validation and error handling extended to the documented envelopes, including
  invalid ObjectIds, duplicates, malformed JSON and database outages
- `npm run verify` grows an HTTP-level API section (no database needed);
  `npm run verify:db` exercises the same API against a real MongoDB and self-skips

## Stage 03 — Authentication & user management  ✅

- Registration, sign-in, sign-out and `/api/auth/me` implemented through the existing
  route → controller → service → model layers, with field-level validation
- JWT sessions signed in one place; the account is reloaded on every request, so the
  stored role — never a token claim — decides what a caller may do
- Public registration always creates a `staff` account; a supplied `role` is rejected
  with a 422 and no public route can create an administrator
- bcrypt hashing on the User model, generic 401s for bad credentials (no account
  enumeration), a tighter limiter on the credential endpoints, no password or hash in
  any response, log or token
- The React side now uses the real endpoints: AuthProvider owns the session, a rejected
  token drops it, protected routes wait for the check, and the login and registration
  pages share one state
- Temporary preview authentication removed: `VITE_PREVIEW_SESSION`, `PREVIEW_USER`, the
  preview badge and the "continue in preview mode" path are gone from the code and the
  environment template
- `npm run verify` grew an authentication section (HTTP, no database) and a static check
  that no preview mechanism survived; `npm run verify:db` gained real-database auth checks

Still to come: the signed-in student screens still read the design fixture in
`client/src/data/sampleStudents.js` — the API they will use already exists.

## Stage 04 — Student data layer & REST API integration  ✅

- The student screens now read and write through the API: listing, detail, creation,
  editing, deletion and dashboard statistics all go through `studentService`
- Search, filters (status, year, department, course), sorting and pagination are the
  server's job — the client sends the query and renders the page it receives, and the
  pagination controls are driven by the API's own metadata
- `apiClient` keeps the success envelope's `meta` for collection calls, and a rejected
  token still clears the session through the shared `onUnauthorized` path
- Loading, empty, not-found, permission, outage and validation states are handled per
  endpoint; a record that could not be read is never shown as missing
- The sample student dataset is gone — `client/src/data/` was deleted, along with the
  "Sample records" indicator. The landing page keeps four clearly-labelled example rows
  declared inside itself for its marketing panel
- `npm run verify` gained a client data-layer section that bundles the real client
  modules and drives them against the running API (99 checks in total, no database)

Still to come: the visual and interaction polish (dashboard and student screens) of the
later stages, and database-backed verification wherever MongoDB is available.

## Stage 05 — Search, filtering & student operations  ✅

- Search now splits on spaces and requires every word to match something —
  "ashish kumar" finds the student whatever order the name is stored in, and
  "cse 2026" can match a department and a student ID in one query. Still escaped,
  still capped at 120 characters, now also capped at six terms
- New protected `GET /api/students/filters` returns the courses and departments
  actually in use, so the filter controls follow the data rather than a list that
  goes stale; case-insensitive duplicates collapse
- The register's URL is its state (search, filters, sort, page, page size), read
  defensively — an out-of-date link cannot push an invalid value at the API
- Active filters appear as removable chips with a "Clear all" action; page size
  is selectable (10/25/50/100, all inside the API's limit)
- Superseded requests are aborted, not just ignored, and a cancelled request is
  never reported as a failure; the dashboard refreshes itself when students change
- Deleting the last record on a page steps back to the last real page instead of
  leaving an empty register on screen; a double submit cannot create two students
- `npm run verify` grew to 116 checks (search rules, filter options, URL state,
  page size, cancellation, stale-response protection); `npm run verify:db` gained
  multi-term, options and last-page-delete checks

## Stage 06 — Frontend foundation & routing  ✅

- Every URL is described once, in `routes/routeMeta.js`: its path, its document
  title, whether it is public, and the label the interface uses. Tab titles, the
  top bar and the student breadcrumb trails now come from there
- The router has three clear groups — public pages, the signed-in application
  behind the guard and inside the shell, and one catch-all that answers
  everything else. The account pages share a `PublicLayout`; the landing page
  keeps its own marketing shell
- The shell owns the frame, a "skip to content" link, the entry transition and
  the wait for a code-split page, so pages are only their own content and no page
  carries layout or routing responsibility any more
- The register page went from 486 lines to 106: one controller hook owns the URL
  state it always did, and three components draw the toolbar, the active-filter
  chips and the rows
- A URL that matches nothing is answered according to the session: the plain
  not-found page for a visitor, the same page inside the shell for a signed-in
  user, and the session is resolved before either is drawn
- A render-time crash is now caught by an error boundary that explains itself,
  offers a reload and a way back, and never shows internals
- The blanket `prefers-reduced-motion` rule that silenced every animation and
  transition has been removed; motion is decided where it is used
- `npm run verify` grew to 132 checks, including five that render the real route
  tree in Node: anonymous visitors see no signed-in screen, a stored session
  shows the loader rather than the page, and the navigation marks exactly one
  section at a time

## Stage 07 — CampusDesk design system & responsive UI  ✅

- The palette now lives in one place as tokens (surfaces, text, borders, the four
  status tones) alongside a type scale, a spacing rhythm, three radii and three
  shadow levels; no screen hardcodes a colour or a pixel font size any more
- One panel hierarchy instead of one repeated card: resting surface, quiet
  surface, inset group, accent panel, and the single dark band the dashboard uses
- Buttons have five variants with a clear job each; destructive actions carry an
  icon, a label and a filled danger button so colour is never the only signal
- Form controls share one shape, hover, focus, disabled and error treatment, and
  the create/edit form is grouped into identity, academic, contact and
  registration sections with the staff date restriction explained in place
- The register toolbar reads as three groups — search, narrow, show — and the
  table has a quiet head, hairline rows and hover feedback; the mobile card leads
  with identity, then the facts, then the actions at thumb height
- The dashboard opens on a dark summary band with two live figures, then the
  metric row, the department distribution and the active/inactive split
- Dialogs are bottom sheets on phones, trap Tab and restore focus; toasts keep
  four tones that read without colour; the sidebar ends on the action users want
- `npm run verify` grew to 143 checks, including a design-system section (palette
  tokens, no stray colours, the scale, panel hierarchy, button and field states,
  responsive construction, state design, dialog/toast patterns, subtle motion)
  and a structural render check (one h1, labelled controls, skeleton loading)

## Stage 08 — Authentication & student management interface  ✅

- Signing in and registering now navigate exactly once, from the session change
  itself, and keep the whole intended destination — a shared link's query string
  included, so a filtered register survives the sign-in
- A token the API stops accepting is no longer a mystery: the session ends, the
  guard carries the reason, and the sign-in screen explains that it expired
- Every form shares one submission lifecycle: a second submit is refused while
  one is in flight, the button is genuinely disabled, a failure keeps everything
  typed, and a rejected form moves focus to the first field that needs fixing —
  including fields the API rejected
- The client's field rules now mirror the API's exactly: a photo may be a
  site-relative path as well as an absolute URL, and a future registration date
  is refused at the field instead of being stored
- The register's links carry the register with them, so opening a student,
  cancelling a form, saving a record or deleting one returns to the search,
  filters, sort and page the user was working in; the trail is validated, so it
  can only ever be an internal path
- Deleting is never optimistic and never silent: the dialog stays up until the
  API answers, Escape and the backdrop cannot dismiss it mid-request, a 404 is
  reported as "already removed", and the register is re-read rather than patched
- Unsaved edits are protected without a navigation framework: the browser asks
  before a reload or a closed tab, and Cancel confirms before discarding. In-app
  navigation is not blocked, because `BrowserRouter` cannot veto it
- Search says what it searches and that every word must match; the field reports
  its own busy state while a search is in flight, and an empty or failed register
  is announced, with the two kinds of empty kept distinct
- `npm run verify` grew to 157 checks: eleven static workflow checks (auth form
  structure, session expiry, the shared form lifecycle, the create/edit path, the
  API-aligned rules, the registration-date rule, the unsaved-changes guard, the
  return trail, the delete flow, list interaction) and three that render real
  screens in Node — the sign-in screen with an expired session, the create form's
  sections and labels, and the edit form for staff versus an administrator

## Stage 09 — Dashboard, search & filtering experience  ✅

- Every dashboard figure is now a way in: the stat cards, the department rows,
  the year rows and the status rows link into the register already narrowed to
  the students they describe, built through the register's own reader and writer
  so a link can never carry a filter value, page size or sort the API would refuse
- The dashboard no longer derives anything it was not given: the "share of the
  register" percentage and the percentage claim in the status bar are gone, each
  figure says what it counts, and no growth or trend is implied
- A summary that could not be read is no longer drawn as a register of zero: the
  failure explains itself with a retry, and the figures are withheld
- A refresh after a create, edit or delete keeps the last real numbers on screen
  and reports "Updating figures…" instead of throwing the dashboard back to
  skeletons; the first load still shows skeletons
- The dashboard gained the year-of-study breakdown the statistics endpoint
  already returns, and the department and year lists scroll, so a register with
  many departments stays readable
- The register now answers "what am I looking at": the pagination line reads
  "Page 2 of 5 · Showing 26–50 of 124 matching students", with "matching" chosen
  from the URL state and every figure taken from the API's own metadata
- Filters and sorting are no longer mixed together: the chip row lists the
  narrowing filters with a count of them, and a non-default sort has its own chip
  with its own way back to the default order
- Each narrowing control shows that it is narrowing something, a filter or page
  change reports "Updating results…" separately from the search box being busy,
  and the interface says that changing the query starts again at page 1
- `npm run verify` grew to 169 checks: nine static dashboard/filter checks (one
  statistics source, the announcement refresh, honest figures, canonical links,
  the four dashboard states, results read from API metadata, filter discovery,
  search semantics, page/sort allowlists) and three that render real components
  in Node — canonical link building including hostile input, a filtered URL
  producing exactly the chips and sort chip it describes, and the dashboard
  rendering as a summary still being read rather than as zeros

## Stage 10 — GSAP/Motion animations & interactive UX  ⏳
