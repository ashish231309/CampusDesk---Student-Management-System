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
- `npm run verify` grows an HTTP-level API section (65 checks, no database needed);
  `npm run verify:db` exercises the same API against a real MongoDB and self-skips

Still to come: real authentication (`/api/auth/register`, `/api/auth/login`) — the
student area stays behind the auth guard until Stage 03, and the temporary preview
session used to review the interface is removed then too.

## Stage 03 — Authentication  ⏳
