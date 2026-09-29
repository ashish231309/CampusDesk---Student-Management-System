# CampusDesk

**Student Management System** — a web application for recording students, keeping their details
current and watching enrolment across a campus.

CampusDesk is built as an npm workspace monorepo: a React client and an Express/MongoDB API that
share one repository and one set of scripts at the root.

> **Build status:** the application works end to end — project structure, design system, API
> layering, database models, validation, security middleware, registration and sign-in, and the
> student register itself: listing, search, filters, sorting, paging, creation, editing, deletion and
> dashboard statistics all read and write through the API. What remains is presentation work:
> the visual and interaction polish of the later stages.

---

## Features

| Area | Status |
| --- | --- |
| Design system (tokens, type scale, panels, controls) | done — one system across every screen |
| Student registration and sign-in | done — JWT sessions, expiry explained on the sign-in screen |
| Automatic student IDs (`CDS-YYYY-NNNN`) | done — generated server-side |
| Add, edit, view and delete students | done — through the API |
| Search, filtering, sorting and pagination | done — server-side |
| Interactive dashboard with enrolment summary | done |
| Responsive layout (mobile → desktop) | done |
| Animations and micro-interactions | done |
| Server-side validation and error handling | done |
| Student workflows (create, view, edit, delete, return) | done — return to the register you left |
| MongoDB integration | done — models, indexes and the student API |

## Technology stack

**Client** — React 19, Vite 8, Tailwind CSS 4, React Router 7, Motion (animation), GSAP (hero
sequence), Lucide (icons).

**Server** — Node.js, Express 5, Mongoose 9, express-validator, helmet, CORS, compression,
rate limiting, JSON Web Tokens, bcrypt.

**Database** — MongoDB.

## Project structure

```
CampusDesk/
├── client/                     React single-page application
│   ├── public/                 static assets (favicon)
│   └── src/
│       ├── components/
│       │   ├── branding/       logo mark and wordmark
│       │   ├── layout/         the shells: app shell, public/auth shell, top bar, sidebar
│       │   ├── motion/         shared page-transition wrapper
│       │   ├── routing/        route guard, error boundary, not-found route, scroll
│       │   ├── students/       register toolbar, active filters, student table
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

### Design system

The interface is composed from tokens rather than from per-page choices. `client/src/index.css` holds the
whole system: the approved palette (beige `#DDD0C8` and dark grey `#323232` carry the identity, with a
small set for enrolment status and feedback), a type scale from `text-display` to `text-micro`, a spacing
rhythm (`px-gutter`, `px-panel`, `mt-section`), three radii and three levels of elevation. Two derived
shades exist and are declared there, not invented in a component: a warmer grey for quiet strips, and a
darker warning for small text that has to stay readable on white.

A handful of composite classes keep the screens consistent — `panel`, `panel-header`, `panel-body`,
`panel-footer`, `eyebrow`, `field-label` — and everything else is built from the same primitives in
`client/src/components/ui/`: six button variants (primary, secondary, soft, ghost, danger,
destructive-ghost), one field system with shared hover, focus, disabled and error states, a panel
component with four tones, badges and status pills, a table that becomes cards on small screens,
pagination, dialogs, toasts and skeletons.

### Frontend routing

The client is one router with three groups, and every URL in it is described once, in
`client/src/routes/routeMeta.js` — its path, its document title, whether it is public, and the label the
interface shows for it. Titles, the top bar and the breadcrumb trails all read from there, so a new
screen is added in two places: the metadata and the router.

| Group | Routes | Shell |
| --- | --- | --- |
| Public | `/`, `/login`, `/register` | landing page has its own marketing shell; the two account pages share `PublicLayout` |
| Signed in | `/dashboard`, `/students`, `/students/new`, `/students/:studentId`, `/students/:studentId/edit` | `ProtectedRoute` → `AppLayout` (sidebar, top bar, content area, footer) |
| Anything else | any unmatched URL | the not-found page, on its own for a visitor and inside the shell for a signed-in user |

Pages are only their own content: the shell owns the frame, the skip link, the entry transition and the
wait for a code-split page, and the register page composes a controller hook with three presentational
components. `ProtectedRoute` waits for the session to be resolved before it redirects, so a refresh
never flashes the wrong screen, and a render-time crash anywhere below is caught by an error boundary
that explains itself without showing internals. API failures stay separate — they are reported beside
whatever failed, through `utils/apiErrors.js`.

### Workflows

The screens are built around the jobs people do rather than around the API calls behind them.

Creating a student ends on the new record, so the generated ID is visible immediately; editing saves and
returns to the same record; deleting asks first, says what will be removed and only then calls the API,
and lands back in the register. Every link that leaves the register carries the register's own URL, so
**search, filters, sorting and the current page are still there when you come back** — after opening a
student, after cancelling a form, and after a delete. That trail is validated before it is followed: only
paths inside the application are honoured.

Authentication is the same shape. The intended destination travels through the sign-in screen — query
string included, so a filtered link survives — and the session is restored before any protected screen is
drawn. When the API stops accepting a token the session ends and the sign-in screen says the session
expired, rather than appearing for no reason.

Forms have one lifecycle: values, per-field errors, a submit that cannot be fired twice, and a failure
that keeps everything typed. A rejected form moves focus to the first field that needs attention, and
server-side field errors land on the inputs they belong to. A form with uncommitted edits warns before
the browser discards them, and Cancel confirms before throwing them away. In-app navigation is not
blocked, because the application renders `BrowserRouter` and cannot veto a navigation from outside the
router — the guard covers reloads, closed tabs and the form's own exit.

---

## Installation

Requirements: **Node.js 20.19+** and a **MongoDB** instance (Atlas or local).

```bash
git clone https://github.com/ashish231309/CampusDesk---Student-Management-System.git
cd CampusDesk---Student-Management-System
npm install
```

## Environment variables

Copy the templates and fill in your own values. Neither `.env` file is committed.

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env.local     # optional — the defaults work as-is
```

**`server/.env`**

| Variable | Purpose | Default |
| --- | --- | --- |
| `NODE_ENV` | runtime mode | `development` |
| `PORT` | API port | `5000` |
| `API_PREFIX` | base path for all routes | `/api` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/campusdesk` |
| `JWT_SECRET` | signing key for sessions — **required in production** | development fallback |
| `JWT_EXPIRES_IN` | session lifetime | `7d` |
| `BCRYPT_SALT_ROUNDS` | password hashing cost | `10` |
| `CLIENT_ORIGIN` | comma-separated allowed browser origins | `http://localhost:5173` |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | request throttling | `900000` / `500` |
| `AUTH_RATE_LIMIT_WINDOW_MS` / `AUTH_RATE_LIMIT_MAX` | stricter budget for register and login | `900000` / `30` |
| `LOG_LEVEL` | log verbosity (`error`…`debug`) | `debug` in development |

Generate a secret with `openssl rand -hex 32`.

**`client/.env.local`** — `VITE_API_BASE_URL` (default `/api`, proxied by Vite),
`VITE_API_PROXY_TARGET` (default `http://localhost:5000`), `VITE_API_TIMEOUT_MS`.
Only `VITE_`-prefixed values reach the browser, so never put a secret here. There is no
client-side switch that can fake a session.

## Local development

```bash
npm run dev          # API on :5000 and client on :5173 together
npm run dev:server   # API only
npm run dev:client   # client only
```

The browser talks to Vite only: `/api/*` is proxied to the backend, so there is no CORS
configuration to think about while developing.

### Database setup

Point `MONGODB_URI` at a MongoDB instance and start it:

```bash
# local install
mongod --dbpath ~/data/campusdesk

# or with Docker
docker run --name campusdesk-mongo -p 27017:27017 -d mongo:7
```

Mongoose creates the collections and indexes on first use. The API still starts without a database
in development — `GET /api/health/ready` answers `503` with `status: "degraded"`, and requests that
need data fail within a couple of seconds with `503 DATABASE_UNAVAILABLE` instead of hanging — but
production refuses to boot without a connection.

## API

All routes live under `/api` and answer with the same envelope:

```jsonc
// success
{ "success": true,  "data": { … }, "meta": { "page": 1, "total": 42 } }

// failure
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": { "email": "…" } } }
```

| Method | Endpoint | Notes |
| --- | --- | --- |
| `GET` | `/api` | endpoint index |
| `GET` | `/api/health` | liveness |
| `GET` | `/api/health/ready` | readiness, including database state |
| `POST` | `/api/auth/register` | create an account — always with the `staff` role |
| `POST` | `/api/auth/login` | exchange credentials for a session token |
| `POST` | `/api/auth/logout` | acknowledged by the API; the client discards its token |
| `GET` | `/api/auth/me` | returns the signed-in user (requires a token) |
| `GET` | `/api/students` | search, filter, sort, paginate (guarded) |
| `GET` | `/api/students/stats` | dashboard counts (guarded) |
| `GET` | `/api/students/filters` | course and department values in use, for the filter controls (guarded) |
| `POST` | `/api/students` | create — the student ID is generated server-side (guarded) |
| `GET` | `/api/students/:id` | one student (guarded) |
| `PATCH` | `/api/students/:id` | update (guarded) |
| `DELETE` | `/api/students/:id` | remove (guarded) |

### Authentication

Signing in returns a JSON Web Token; the client stores it and sends it as
`Authorization: Bearer <token>` on every request. The API verifies the signature and then loads the
account, so **the role always comes from the database** — a token that claims `role: "admin"` cannot
grant administrator rights to a staff account.

Accounts are created through `/api/auth/register` as `staff`. That role is assigned by the server and
cannot be requested: a registration that sends `role` is rejected with a field-level `422`, and no
public route can create an administrator. Passwords are hashed with bcrypt before they are stored and
are never returned, logged or echoed back.

Tokens are stateless, so signing out cannot invalidate one on the server; `/api/auth/logout` says so
explicitly (`revokedOnServer: false`) and the client clears its token and cached user. Requiring a
shorter `JWT_EXPIRES_IN`, or adding a revocation list, are the ways to tighten that later. A request
carrying an expired, malformed or wrongly-signed token gets the usual `401` envelope.

The student area requires that token; without one every student endpoint answers `401`.

### The register

`GET /api/students` takes `?search=`, `?status=`, `?year=`, `?department=`, `?course=`, `?sort=`,
`?order=`, `?page=` and `?limit=` (1–100), and they combine freely — for example
`/api/students?department=Computer%20Science&year=2nd%20Year&status=active&sort=name&page=2&limit=25`.
The response carries pagination metadata in `meta` (`page`, `limit`, `total`, `totalPages`,
`hasNextPage`, `hasPreviousPage`, `sort`), so a client never counts rows itself.

**Search** is case-insensitive substring matching across name, student ID, email, phone, course and
department. It is split on spaces and **every word must match something, though not necessarily the
same field** — so `ashish kumar` finds a student whose name is recorded in either order, and
`cse 2026` can match a department in one term and a student ID in the other. Digits are matched
loosely against the stored phone number, so `9822012345`, `98220 12345` and `+91 98220 12345` all
find the same record. Input is regex-escaped, capped at 120 characters and at six terms, and no
field outside the list above is ever searched.

The register's URL is its state: `search`, `status`, `year`, `department`, `course`, `sort`, `page`
and `limit` live in the address, so a filtered register can be shared or reloaded, and outdated or
hand-edited values are quietly dropped rather than sent to the API.

```bash
curl http://localhost:5000/api/health

# create an account, then use the token it returns
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ananya Sharma","email":"ananya@campusdesk.edu","password":"passw0rd123"}'

curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ananya@campusdesk.edu","password":"passw0rd123"}'

curl http://localhost:5000/api/students -H "Authorization: Bearer <token>"
```

## Verification

```bash
npm run verify      # configuration, helpers, validation and the API itself (no database needed)
npm run verify:db   # the same student API against a real MongoDB, then drops the verify database
npm run lint        # ESLint for both workspaces
npm run build       # production client build
```

`npm run verify` is the fast suite: it exercises the request pipeline over HTTP with the models
stubbed, so it runs anywhere — including registration, sign-in, token verification, expired and
forged tokens, the role rules and the removal of the old preview sign-in. It also bundles the
client's own data layer (the same bundler Vite uses) and runs it against that API, so the checks
cover the request the browser actually sends: its search, filters, sort, page, session header and
error handling. The route tree is rendered as well — the real components, server-rendered in Node, so
the suite can show which screen each URL produces and that an anonymous visitor never sees a signed-in
one. `npm run verify:db` is the
one that proves the database behaviour — accounts and hashed passwords, sign-in against a stored
hash, student creation, generated IDs under concurrent writes, search, filters, sorting, pagination,
statistics and deletion. It uses `VERIFY_MONGODB_URI` if you set one, otherwise your `MONGODB_URI` with the
database name changed to `campusdesk_verify`, otherwise an ephemeral server started by
`mongodb-memory-server`. If none can be reached it prints a skip notice and exits with code 2
rather than reporting a pass it did not earn.

## Deployment

1. Build the client with `npm run build` and serve `client/dist` from any static host, or from
   Express if you prefer a single origin.
2. Run the API with `npm start` (set `NODE_ENV=production`, a real `MONGODB_URI` and a strong
   `JWT_SECRET`).
3. Point the client at the API with `VITE_API_BASE_URL` and add the client's origin to
   `CLIENT_ORIGIN`.

## Screenshots

To be added once the authenticated flows are complete.

## License

[MIT](LICENSE) © 2026 Ashish Kumar
