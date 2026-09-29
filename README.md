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
| Student registration and sign-in | done — JWT sessions |
| Automatic student IDs (`CDS-YYYY-NNNN`) | done — generated server-side |
| Add, edit, view and delete students | done — through the API |
| Search, filtering, sorting and pagination | done — server-side |
| Interactive dashboard with enrolment summary | done |
| Responsive layout (mobile → desktop) | done |
| Animations and micro-interactions | done |
| Server-side validation and error handling | done |
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
│       │   ├── layout/         app shell: sidebar, top bar, page header
│       │   ├── motion/         shared page-transition wrapper
│       │   ├── routing/        protected routes, scroll restoration
│       │   └── ui/             reusable primitives (buttons, cards, table, modal, toasts…)
│       ├── config/             app configuration and navigation
│       ├── constants/          student domain options
│       ├── context/            authentication and notification providers
│       ├── hooks/              form, search, count-up and data hooks
│       ├── pages/              one file per route
│       ├── routes/             route table and path constants
│       ├── services/           API client and endpoint wrappers
│       └── utils/              formatting, validation and class helpers
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

List queries combine: `?search=`, `?status=`, `?year=`, `?department=`, `?course=`, `?sort=`,
`?order=`, `?page=` and `?limit=` — for example
`/api/students?department=Computer%20Science&year=2nd%20Year&status=active&sort=name&order=asc`.

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
error handling. `npm run verify:db` is the
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
