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

## Stage 02 — Backend & database foundation  ⏳

## Stage 03 — Authentication  ⏳
