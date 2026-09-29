# CampusDesk

**Student Management System** — a responsive web application for recording students, keeping their
details current, and watching enrolment across a campus.

CampusDesk is aimed at the people who run a small institution's student office: staff who add and
maintain student records, and administrators who need an overview of enrolment. It keeps the register
itself — who is enrolled, in which course and department, since when, and whether they are still
active — behind a sign-in, and it answers questions about that register (search, filters, sorting,
paging and enrolment statistics) from the server rather than from whatever happens to be on screen.

The repository is an npm workspace monorepo: a React client and an Express/MongoDB API that share one
repository and one set of root scripts.

---

## Features

**Accounts and sessions**

- Registration, sign-in and sign-out, with a session that survives a page refresh
- Protected routes: every student screen and every student endpoint requires a signed-in account
- Two roles — `staff` and `admin` — read from the stored account on every request, never from the token
- Public registration always creates a `staff` account; a registration that asks for a role is refused
- A rejected or expired token ends the session and the sign-in screen explains why

**Student register**

- Add, view, edit and delete students, with a confirmation before anything is removed
- Automatic student IDs in the `CDS-YYYY-NNNN` format, generated server-side from an atomic counter
- Listing with server-side search, filtering, sorting and pagination
- Search matches name, student ID, email, phone, course and department; every word typed has to match
  something, and phone numbers match regardless of spacing, so `98220 41145`, `9822041145` and
  `+91 98220 41145` all find the same record
- Filters for status, year, department and course, with the department and course values offered by
  the API rather than hard-coded
- Sorting on eight fields in either direction, paging with a page size of 10 by default and up to 100
- The register's URL is its state: search, filters, sort and page live in the address, so a narrowed
  register can be shared, bookmarked or reloaded, and anything invalid in the URL is dropped rather
  than sent to the API
- Opening a student, editing one, or cancelling an edit returns you to the register you left, with its
  search, filters, sorting and page intact

**Dashboard**

- One summary read from a single statistics endpoint: total, active and inactive counts, distribution
  by department and by year, and the five most recent registrations
- Each figure links into the register already narrowed to the students it describes
- Refreshing the summary keeps the previous figures on screen while the new ones load

**Interface**

- One design system: a beige and dark-grey palette defined once as tokens, a shared type scale,
  spacing rhythm, radii and elevations, and a single set of components (buttons, fields, panels,
  tables, dialogs, toasts, skeletons, pagination)
- Responsive from a small phone to a wide desktop, with the table becoming a card list on narrow
  screens, a slide-over navigation drawer, and long values wrapped or shortened — never dropped
- Accessible by construction: real labels, a visible focus ring on every interactive control, full
  keyboard operation, dialogs that trap focus and restore it on close, a skip link, live regions for
  toasts and status text, and status that is never communicated by colour alone
- Restrained motion: short entrance and feedback transitions that respect the operating system's
  reduced-motion preference, a count-up on dashboard figures that starts from the value already on
  screen, and progress bars that grow from zero once per data change

**Robustness**

- Every request is validated on the server, and field errors come back on the fields they belong to
- Loading, empty, error and no-match states are distinct: a failed request is never rendered as an
  empty register, and a failed dashboard read never becomes a row of zeros
- Form values survive a rejected submission, so nobody retypes a form after a server-side error
- Errors the user sees are plain sentences; stacks, driver messages and connection strings stay on the
  server

---

## Technology stack

**Client** — React 19, Vite 8, Tailwind CSS 4, React Router 7, Motion (interface animation), GSAP
(the landing hero sequence and the dashboard bars, both in one place each), Lucide (icons).

**Server** — Node.js, Express 5, Mongoose 9, express-validator (request validation), helmet (security
headers), cors (origin allowlist), compression, morgan (request logging), express-rate-limit, JSON Web
Tokens (sessions), bcrypt (password hashing), dotenv (configuration).

**Database** — MongoDB.

`mongodb-memory-server-core` is a development dependency: the database verification suite uses it to
start a throwaway MongoDB when no other server is configured.

---

## Project structure

```
CampusDesk/
├── client/                     React single-page application
│   ├── public/                 static assets (favicon)
│   └── src/
│       ├── components/
│       │   ├── branding/       logo mark and wordmark
│       │   ├── layout/         the shells: app shell, public shell, top bar, sidebar
│       │   ├── motion/         shared page-transition wrapper
│       │   ├── routing/        route guard, error boundary, not-found route, scroll restoration
│       │   ├── students/       register toolbar, active filter chips, student table
│       │   └── ui/             reusable primitives (buttons, cards, table, modal, toasts…)
│       ├── config/             app configuration, navigation and the public panel copy
│       ├── constants/          student domain options
│       ├── context/            authentication and notification providers
│       ├── hooks/              data hooks, form helper and the register controller
│       ├── pages/              one file per route
│       ├── routes/             route table, route metadata and path constants
│       ├── services/           API client and endpoint wrappers
│       └── utils/              formatting, validation, query-state and class helpers
├── server/                     Express REST API
│   ├── scripts/                verification suites (offline and database-backed)
│   └── src/
│       ├── config/             environment and database connections
│       ├── constants/          shared domain constants
│       ├── controllers/        request handlers
│       ├── middleware/         auth guard, validation, error handling, 404
│       ├── models/             Mongoose schemas
│       ├── routes/             versioned route table
│       ├── services/           business logic
│       ├── utils/              errors, responses, logging, ID generation
│       └── validators/         request validation chains
├── LICENSE
├── package.json                workspace scripts
└── README.md
```

---

## Prerequisites

- **Node.js 20.19 or newer** (declared in `engines` in all three package manifests)
- **npm** — the workspaces in this repository are an npm feature
- **MongoDB** — either a local server or an Atlas cluster
- **Git**

---

## Installation

```bash
git clone https://github.com/ashish231309/CampusDesk---Student-Management-System.git
cd CampusDesk---Student-Management-System
npm install
```

`npm install` at the root installs both workspaces.

---

## Environment variables

Copy the templates and fill in your own values. Neither `.env` file is committed.

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env.local     # optional — the defaults work as-is
```

### `server/.env`

| Variable | Purpose | Default |
| --- | --- | --- |
| `NODE_ENV` | runtime mode (`development` / `production` / `test`) | `development` |
| `PORT` | API port | `5000` |
| `API_PREFIX` | base path for every route | `/api` |
| `LOG_LEVEL` | log verbosity (`error`, `warn`, `info`, `debug`) | `debug` in development, `info` in production |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/campusdesk` |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | how long to wait for a MongoDB server | `5000` |
| `MONGODB_BUFFER_TIMEOUT_MS` | how long a query may wait for a connection before failing | `2000` |
| `JWT_SECRET` | signing key for session tokens — **required in production** | development-only fallback |
| `JWT_EXPIRES_IN` | session lifetime | `7d` |
| `BCRYPT_SALT_ROUNDS` | password hashing cost | `10` |
| `CLIENT_ORIGIN` | comma-separated browser origins allowed to call the API | `http://localhost:5173` |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | the broad request limiter | `900000` / `500` |
| `AUTH_RATE_LIMIT_WINDOW_MS` / `AUTH_RATE_LIMIT_MAX` | the tighter limiter on register and sign-in | `900000` / `30` |

In production, `JWT_SECRET` must be set to a strong unique value: the server refuses to start if the
development fallback is still in place. Generate one with `openssl rand -hex 32`.

### `client/.env.local`

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | base URL the browser calls | `/api` |
| `VITE_API_PROXY_TARGET` | where the Vite dev server forwards `/api` | `http://localhost:5000` |
| `VITE_API_TIMEOUT_MS` | client-side request timeout | `15000` |

Only `VITE_`-prefixed variables reach the browser, so a secret must never be placed here. The
session is a bearer token the client stores and sends as `Authorization: Bearer <token>`; there is
no client-side switch that can fake a signed-in state.

---

## Database

CampusDesk needs MongoDB. Point `MONGODB_URI` at a server and start it:

```bash
# local install
mongod --dbpath ~/data/campusdesk

# or with Docker
docker run --name campusdesk-mongo -p 27017:27017 -d mongo:7
```

Mongoose creates the collections and indexes on first use; the `students` and `users` collections and
the `counters` collection that allocates student IDs come into being the first time they are written
to.

**Behaviour when MongoDB is unavailable**

- In development the API still starts, so the rest of the application can be worked on.
- `GET /api/health/ready` answers `503` with `status: "degraded"` and the connection state.
- Requests that need data fail fast — within the configured buffer timeout — with
  `503 DATABASE_UNAVAILABLE` and a plain sentence, instead of hanging.
- In production the server refuses to boot without a database connection.
- The connection is closed cleanly on `SIGINT`/`SIGTERM`; there is no retry loop.

---

## Running locally

```bash
npm run dev          # API on :5000 and client on :5173 together
npm run dev:server   # API only (node --watch)
npm run dev:client   # client only (Vite)
```

The browser only ever talks to Vite: `/api/*` is proxied to the backend, so there is no CORS
configuration to think about while developing.

Other scripts:

```bash
npm run build        # production client build → client/dist
npm start            # run the API without the file watcher
npm run lint         # ESLint for both workspaces
```

---

## API

All routes live under `/api` and answer with the same envelope.

```jsonc
// success
{ "success": true, "data": { … }, "meta": { "page": 1, "limit": 10, "total": 42 } }

// failure
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": { "email": "…" } } }
```

`details` is present only when there is something field-level to report: validation errors and
conflicts carry it, plain failures do not.

### Endpoints

| Method | Endpoint | Auth | Notes |
| --- | --- | --- | --- |
| `GET` | `/api` | — | endpoint index |
| `GET` | `/api/health` | — | liveness: status, environment, uptime |
| `GET` | `/api/health/ready` | — | readiness, including database state (`200`, or `503` when degraded) |
| `POST` | `/api/auth/register` | — | create an account — always with the `staff` role |
| `POST` | `/api/auth/login` | — | exchange credentials for a session token |
| `POST` | `/api/auth/logout` | — | acknowledged by the API; the client discards its token |
| `GET` | `/api/auth/me` | token | the signed-in account |
| `GET` | `/api/students` | token | search, filter, sort and paginate the register |
| `GET` | `/api/students/stats` | token | dashboard figures |
| `GET` | `/api/students/filters` | token | course and department values in use, for the filter controls |
| `POST` | `/api/students` | token | create; the student ID is generated server-side |
| `GET` | `/api/students/:id` | token | one student |
| `PATCH` | `/api/students/:id` | token | update |
| `DELETE` | `/api/students/:id` | token | remove, answering `200` with the removed student |

Register and sign-in also carry a much tighter rate limit than the rest of the API.

### Authentication

Signing in returns a JSON Web Token whose payload carries the account id, its role and an expiry.
The client sends it as `Authorization: Bearer <token>` on every request; the API verifies the
signature and then loads the account, so **the role always comes from the database** — a token that
claims `role: "admin"` cannot grant administrator rights to a staff account.

Passwords are hashed with bcrypt before they are stored (cost 10 by default) and are never returned,
logged or echoed back. Registration requires 8–72 characters with at least one letter and one number.
A failed sign-in answers one generic `401` naming neither the email nor the password, so the endpoint
cannot be used to discover which addresses are registered.

Tokens are stateless: the API can verify one but cannot revoke an individual token before it expires.
`POST /api/auth/logout` says so explicitly (`revokedOnServer: false`) and the client clears its token
and cached user, which makes the token worthless to it. Requiring a shorter `JWT_EXPIRES_IN` is the
simplest way to tighten that.

Roles are checked on the server. Today one rule uses them: only an `admin` may change an existing
student's `dateOfRegistration`. Everyone signed in can read the register and add, edit or remove
students.

### The register query

`GET /api/students` accepts `?search=`, `?status=`, `?year=`, `?department=`, `?course=`, `?sort=`,
`?order=`, `?page=` and `?limit=`, and they combine freely:

```
/api/students?department=Computer%20Science&year=2nd%20Year&status=active&sort=name&page=2&limit=25
```

- **Page size** — `limit` is 1–100 and defaults to 10; `page` starts at 1.
- **Sorting** — `sort` is one of `name`, `studentId`, `email`, `course`, `year`, `department`,
  `dateOfRegistration` or `createdAt`, optionally prefixed with `-` for descending. The default is
  `-dateOfRegistration`.
- **Search** — case-insensitive substring matching across name, student ID, email, phone, course and
  department. Input is split on whitespace and every term must match something, though not necessarily
  the same field, so `ashish kumar` finds a student whose name is recorded in either order. Terms are
  regex-escaped, capped at six terms and 120 characters, and no field outside that list is searched.
- **Filters** — `status` is `active` or `inactive`, `year` is one of the four year values, and
  `department` and `course` match the stored value case-insensitively.

The response carries the page of students plus metadata (`page`, `limit`, `total`, `totalPages`,
`hasNextPage`, `hasPreviousPage`, `sort`), so a client never has to count rows itself.

Every one of these parameters is a single value. A repeated parameter, an unsupported sort field, an
unknown status, a page size outside the range or a page beyond the register are all refused with
`422` rather than being coerced into something else.

### Status codes

`200` reads and updates · `201` creation · `400` malformed input or a bad identifier ·
`401` not signed in, or a token that is invalid, expired or refers to a deleted account ·
`403` a role that may not perform the action · `404` no such record · `409` a duplicate email or
student ID · `422` validation errors · `429` rate limited · `500` an unexpected server fault ·
`503` the database is unreachable.

---

## Validation and security

- **Password storage** — bcrypt with a per-user salt; the hash is excluded from queries by default and
  stripped from every serialised response.
- **Sessions** — signed JWTs verified on every request, with the account and its role reloaded from
  the database; an expired, forged or malformed token is a `401`.
- **Authorization** — the student router is mounted behind the authentication guard, so every student
  endpoint and `/api/auth/me` require a session. Roles are enforced in the service layer, not in the
  client.
- **Mass-assignment protection** — create and update payloads are validated against a fixed field
  list and then narrowed again before the write. `studentId`, `id`, `_id`, `createdAt`, `updatedAt`
  and `__v` are refused with a field-level error, and anything else unrecognised is dropped.
- **Query safety** — every list parameter is validated as a single value against an allowlist before
  use, so query parameters cannot become MongoDB operators, and search input is regex-escaped rather
  than compiled raw.
- **Bounded queries** — page size is capped at 100, the deepest page the register will read is
  capped, and search is limited to six terms and 120 characters.
- **Security headers** — helmet, with the two adjustments a JSON API needs: the content security
  policy is left to whatever serves the client, and responses are readable cross-origin so the client
  can fetch them.
- **CORS** — an explicit origin allowlist with credentials enabled; no wildcard.
- **Rate limiting** — a broad limiter across the API and a much tighter one on registration and
  sign-in, both configurable through the environment.
- **Request size** — JSON bodies are limited to 1 MB.
- **Error responses** — user-facing errors are plain sentences. Stack traces, driver messages,
  connection strings and hashes never reach a response, and a stack is attached only outside
  production, never for an operational `503`.
- **Environment** — `.env` files are git-ignored, the templates hold placeholders only, and the
  server refuses to start in production with the development JWT secret.

The authoritative rules live in `server/src/validators/` and `server/src/constants/`.

---

## Verification

```bash
npm run lint        # ESLint, both workspaces
npm run build       # production client build
npm run verify      # full offline suite (no database or browser needed)
npm run verify:db   # the student API against a real MongoDB
npm run verify:db   # (self-skips with exit code 2 when no server can be reached)
```

`npm run verify` is the fast suite and needs neither MongoDB nor a browser. It checks configuration,
the query builder, the student ID formatter, the Mongoose schemas, the validation contract, then
exercises the whole request pipeline over real HTTP with the models stubbed: registration, sign-in,
token verification, expired and forged tokens, the role rules, student CRUD, search, filters, sorting,
pagination, statistics, hostile query parameters and error sanitisation. It goes on to bundle the
client's own data layer — with the same bundler Vite uses — and run it against that API, so the checks
cover the requests the browser actually sends: their query string, session header and error handling.
Finally it renders the real page components in Node and asserts what each URL produces, including
that an anonymous visitor never sees a signed-in screen.

`npm run verify:db` is the suite that proves database behaviour: accounts and hashed passwords,
sign-in against a stored hash, student creation, generated IDs under concurrent writes, search,
filters, sorting, pagination, statistics, deletion, duplicates and the error paths. It uses
`VERIFY_MONGODB_URI` if you set one, otherwise your `MONGODB_URI` with the database name changed to
`campusdesk_verify`, otherwise a throwaway server started by `mongodb-memory-server`. Whichever it
uses, it only ever drops the verify database it created. If no server can be reached it prints a
skip notice and exits with code 2 rather than reporting a pass it did not earn.

Neither suite needs a browser, and neither claims to be one: layout and animation are verified at the
source and structure level, not visually.

---

## Deployment

1. Build the client with `npm run build` and serve `client/dist` from a static host — or from Express
   if you prefer a single origin.
2. Run the API with `npm start` and `NODE_ENV=production`, with a real `MONGODB_URI` and a strong,
   unique `JWT_SECRET`.
3. Point the client at the API with `VITE_API_BASE_URL` (it is baked in at build time) and add the
   client's origin to `CLIENT_ORIGIN`.

In production the server refuses to boot without a database connection, and it refuses to boot with
the development JWT secret still in place.

---

## License

[MIT](LICENSE) © 2026 Ashish Kumar
