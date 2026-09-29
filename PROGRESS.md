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

## Stage 04 — Student data model & REST API  ⏳
