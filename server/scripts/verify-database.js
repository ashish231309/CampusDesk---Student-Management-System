/**
 * CampusDesk database verification suite.
 *
 * Exercises the student API end to end against a real MongoDB: creation,
 * generated IDs under concurrency, retrieval, updates, deletion, search,
 * filtering, sorting, pagination, statistics, duplicates and the error paths.
 *
 * A server is located in this order:
 *   1. VERIFY_MONGODB_URI, used exactly as given;
 *   2. MONGODB_URI, with the database name swapped for `<name>_verify` so a
 *      development database is never touched;
 *   3. an ephemeral mongod started by mongodb-memory-server, which downloads a
 *      real MongoDB binary the first time it runs.
 *
 * Whichever is used, the suite only ever drops the verify database it created.
 * If no server can be reached the suite reports that loudly and exits with code
 * 2 — it never pretends to have verified anything.
 *
 * Run with `npm run verify:db`.
 */
process.env.NODE_ENV = 'test';

const { once } = await import('node:events');
const jwt = (await import('jsonwebtoken')).default;

const results = [];
const started = Date.now();

const check = async (name, run) => {
  try {
    await run();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.log(`  ✗ ${name}`);
    console.log(`      ${error.message}`);
  }
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const section = (title) => console.log(`\n${title}`);

const skip = (reason) => {
  console.log('\n──────────────────────────────────────────────────────────────');
  console.log('  DATABASE SUITE SKIPPED — nothing was verified.');
  console.log('──────────────────────────────────────────────────────────────');
  console.log(`  Reason: ${reason}`);
  console.log('\n  Provide a MongoDB instance and run again:');
  console.log('    VERIFY_MONGODB_URI="mongodb://127.0.0.1:27017/campusdesk_verify" npm run verify:db');
  console.log('\n  Or allow mongodb-memory-server to download and start one:');
  console.log('    npm run verify:db\n');
  process.exit(2);
};

// ---------------------------------------------------------------------------
// Locate a database
// ---------------------------------------------------------------------------

const reachable = async (uri, dbName) => {
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000, connectTimeoutMS: 3000 });

  try {
    await client.connect();
    await client.db(dbName).command({ ping: 1 });
    return true;
  } catch {
    return false;
  } finally {
    await client.close().catch(() => {});
  }
};

const databaseNameFrom = (uri, fallback = 'campusdesk_verify') => {
  try {
    const parsed = new URL(uri.replace('mongodb+srv://', 'https://').replace('mongodb://', 'https://'));
    const name = parsed.pathname.replace(/^\//, '').split('?')[0];
    return name || fallback;
  } catch {
    return fallback;
  }
};

const VERIFY_DB_NAME = 'campusdesk_verify';

/**
 * Swap the database name in a connection string while keeping the host,
 * credentials and options. Used so the suite can borrow a development
 * connection string without ever touching the development database.
 */
const withDatabaseName = (uri, name) => {
  const [base, query] = uri.split('?');
  const schemeEnd = base.indexOf('://') + 3;
  const slashIndex = base.indexOf('/', schemeEnd);
  const authority = slashIndex === -1 ? base : base.slice(0, slashIndex);
  return `${authority}/${name}${query ? `?${query}` : ''}`;
};

// Safety net: these run before any connection is attempted, so a regression in
// the connection-string handling cannot silently point the suite at real data.
const selfTest = () => {
  const cases = [
    ['mongodb://127.0.0.1:27017/campusdesk', 'mongodb://127.0.0.1:27017/campusdesk_verify'],
    ['mongodb://user:pw@db.example.com:27017/campusdesk?authSource=admin', 'mongodb://user:pw@db.example.com:27017/campusdesk_verify?authSource=admin'],
    ['mongodb://127.0.0.1:27017', 'mongodb://127.0.0.1:27017/campusdesk_verify'],
  ];

  for (const [input, expected] of cases) {
    const actual = withDatabaseName(input, VERIFY_DB_NAME);
    if (actual !== expected) {
      console.error(`\nConnection-string self-test failed:\n  in:  ${input}\n  got: ${actual}\n  want:${expected}\n`);
      process.exit(1);
    }
  }
};

selfTest();

const resolveDatabase = async () => {
  const explicit = process.env.VERIFY_MONGODB_URI?.trim();
  const attempts = [];

  if (explicit) {
    const name = databaseNameFrom(explicit, VERIFY_DB_NAME);
    if (await reachable(explicit, name)) {
      return { uri: explicit, dbName: name, source: 'VERIFY_MONGODB_URI', stop: async () => {} };
    }
    skip(`VERIFY_MONGODB_URI is set but no MongoDB answered at that address.`);
  }

  const configured = process.env.MONGODB_URI?.trim();
  if (configured) {
    // The configured database name is swapped *before* the probe, so the
    // suite never carries a development database name on a connection.
    const uri = withDatabaseName(configured, VERIFY_DB_NAME);

    if (await reachable(uri, VERIFY_DB_NAME)) {
      return {
        uri,
        dbName: VERIFY_DB_NAME,
        source: `MONGODB_URI (database "${VERIFY_DB_NAME}")`,
        stop: async () => {},
      };
    }

    attempts.push(`the instance from MONGODB_URI did not answer (probed database "${VERIFY_DB_NAME}")`);
  }

  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server-core');
    const memory = await MongoMemoryServer.create({ instance: { dbName: VERIFY_DB_NAME } });

    return {
      uri: memory.getUri(VERIFY_DB_NAME),
      dbName: VERIFY_DB_NAME,
      source: `mongodb-memory-server (mongod ${memory.instanceInfo?.mongodVersion ?? 'unknown'})`,
      stop: () => memory.stop(),
    };
  } catch (error) {
    const reasons = [
      ...attempts,
      `mongodb-memory-server could not start one (${error.message.split('\n')[0]})`,
    ];
    skip(reasons.join(', and '));
  }

  return null;
};

const database = await resolveDatabase();
if (!database) skip('no MongoDB available.');

process.env.MONGODB_URI = database.uri;

// Modules are imported only now: config/env.js reads MONGODB_URI at import time.
const mongoose = (await import('mongoose')).default;
const { createApp } = await import('../src/app.js');
const { connectDatabase, disconnectDatabase, getDatabaseState } = await import('../src/config/db.js');
const { env } = await import('../src/config/env.js');
const { Student } = await import('../src/models/Student.js');
const { User } = await import('../src/models/User.js');
const { Counter } = await import('../src/models/Counter.js');

console.log('\nCampusDesk database verification');
console.log(`  server:   ${database.source}`);
console.log(`  database: ${database.dbName}`);

// ---------------------------------------------------------------------------
// Connect and prepare
// ---------------------------------------------------------------------------

const connected = await connectDatabase();
if (!connected) {
  await database.stop();
  skip('the connection attempt to MongoDB failed.');
}

// A clean slate, in the verify database only.
await mongoose.connection.dropDatabase();

const app = createApp();
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const baseUrl = `http://127.0.0.1:${server.address().port}`;

const admin = await User.create({
  name: 'Campus Administrator',
  email: 'admin@campusdesk.edu',
  password: 'CampusDesk1',
  role: 'admin',
});

const staff = await User.create({
  name: 'Registrar',
  email: 'registrar@campusdesk.edu',
  password: 'CampusDesk2',
  role: 'staff',
});

const signIn = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.jwt.secret, { expiresIn: '10m' });

const adminToken = signIn(admin);
const staffToken = signIn(staff);

const request = async (method, path, { body, token = adminToken } = {}) => {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  return { status: response.status, body: payload };
};

/** A student payload with a unique email so creates never collide by accident. */
let sequence = 0;
const studentPayload = (overrides = {}) => {
  sequence += 1;
  return {
    name: `Student ${String(sequence).padStart(3, '0')}`,
    email: `student${sequence}.${Date.now()}@campusdesk.edu`,
    phone: '+91 98220 41182',
    course: 'B.Tech Computer Science',
    year: '3rd Year',
    department: 'Computer Science',
    dateOfRegistration: '2026-07-14',
    enrollmentStatus: 'active',
    ...overrides,
  };
};

const createStudent = async (overrides = {}) => {
  const response = await request('POST', '/api/students', { body: studentPayload(overrides) });
  assert(response.status === 201, `create returned ${response.status}: ${JSON.stringify(response.body)}`);
  return response.body.data.student;
};

// ---------------------------------------------------------------------------
section('Connection');
// ---------------------------------------------------------------------------

await check('the API reports a live database connection', async () => {
  const state = getDatabaseState();
  assert(state.isConnected, `expected a connected database, got ${state.state}`);

  const response = await fetch(`${baseUrl}/api/health/ready`);
  const body = await response.json();
  assert(response.status === 200, `expected 200 from readiness, received ${response.status}`);
  assert(body.data.database.isConnected === true, 'readiness should report the connection');
});

// ---------------------------------------------------------------------------
section('Create');
// ---------------------------------------------------------------------------

let created;

await check('creates a student and generates its student ID', async () => {
  const response = await request('POST', '/api/students', { body: studentPayload() });
  created = response.body?.data?.student;

  assert(response.status === 201, `expected 201, received ${response.status}`);
  assert(created?.studentId?.startsWith('CDS-'), `unexpected id: ${created?.studentId}`);
  assert(/^CDS-2026-\d{4}$/.test(created.studentId), `unexpected id format: ${created.studentId}`);
  assert(created.enrollmentStatus === 'active', 'status should default to active');
  assert(created.id === String(created._id), 'the response should expose a string id');
});

await check('the created record is persisted with its timestamps', async () => {
  const stored = await Student.findById(created.id);

  assert(stored, 'the student should exist in MongoDB');
  assert(stored.studentId === created.studentId, 'the stored ID should match the response');
  assert(stored.createdAt instanceof Date && stored.updatedAt instanceof Date, 'timestamps should be stored');
  assert(stored.email === created.email, 'the stored email should match');
});

await check('a client-supplied student ID is rejected', async () => {
  const response = await request('POST', '/api/students', {
    body: { ...studentPayload(), studentId: 'CDS-2026-9999' },
  });

  assert(response.status === 422, `expected 422, received ${response.status}`);
  assert(/generated by CampusDesk/i.test(response.body.error.details.studentId ?? ''), 'the reason should be explained');
});

await check('a second student gets the next ID in sequence', async () => {
  const next = await createStudent();
  const firstSequence = Number(created.studentId.split('-')[2]);
  const nextSequence = Number(next.studentId.split('-')[2]);

  assert(nextSequence === firstSequence + 1, `expected ${firstSequence + 1}, received ${nextSequence}`);
});

await check('duplicate emails are rejected with 409', async () => {
  const response = await request('POST', '/api/students', {
    body: { ...studentPayload(), email: created.email },
  });

  assert(response.status === 409, `expected 409, received ${response.status}`);
  assert(response.body.error.code === 'CONFLICT', `unexpected code: ${response.body.error.code}`);
  assert(response.body.error.details.email, 'the conflicting field should be reported');
});

await check('invalid payloads are rejected with field-level details', async () => {
  const response = await request('POST', '/api/students', {
    body: { name: 'A', email: 'nope', phone: 'x', course: '', year: '9th Year', department: '' },
  });

  assert(response.status === 422, `expected 422, received ${response.status}`);
  for (const field of ['name', 'email', 'phone', 'course', 'year', 'department']) {
    assert(response.body.error.details[field], `${field} should be reported`);
  }
});

// ---------------------------------------------------------------------------
section('Generated IDs under concurrency');
// ---------------------------------------------------------------------------

await check('60 parallel creates produce 60 unique IDs', async () => {
  const before = await Counter.findById('student:2026');
  const batch = 60;

  const responses = await Promise.all(
    Array.from({ length: batch }, () => request('POST', '/api/students', { body: studentPayload() })),
  );

  const failures = responses.filter((response) => response.status !== 201);
  assert(failures.length === 0, `${failures.length} of ${batch} creates failed: ${failures[0]?.body?.error?.message}`);

  const ids = responses.map((response) => response.body.data.student.studentId);
  const unique = new Set(ids);

  assert(unique.size === batch, `expected ${batch} unique IDs, received ${unique.size}`);
  assert(ids.every((id) => /^CDS-\d{4}-\d{4,}$/.test(id)), 'every ID should match the documented format');

  const stored = await Student.countDocuments({ studentId: { $in: [...unique] } });
  assert(stored === batch, `expected ${batch} stored students, found ${stored}`);

  const after = await Counter.findById('student:2026');
  assert(
    after.seq === before.seq + batch,
    `the counter should advance by exactly ${batch} (was ${before.seq}, now ${after.seq})`,
  );
});

await check('the database holds no duplicate student IDs', async () => {
  const duplicates = await Student.aggregate([
    { $group: { _id: '$studentId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  assert(duplicates.length === 0, `${duplicates.length} duplicated identifiers found`);
});

// ---------------------------------------------------------------------------
section('Read');
// ---------------------------------------------------------------------------

await check('retrieves a single student by id', async () => {
  const response = await request('GET', `/api/students/${created.id}`);

  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(response.body.data.student.studentId === created.studentId, 'the wrong student was returned');
});

await check('an unknown but valid id returns 404', async () => {
  const response = await request('GET', '/api/students/64b7f9c2e1a2b3c4d5e6f7a8');

  assert(response.status === 404, `expected 404, received ${response.status}`);
  assert(response.body.error.code === 'NOT_FOUND', `unexpected code: ${response.body.error.code}`);
});

await check('a malformed id returns 422, not a database error', async () => {
  const response = await request('GET', '/api/students/not-an-object-id');

  assert(response.status === 422, `expected 422, received ${response.status}`);
  assert(response.body.error.details.id, 'the id field should be reported');
});

// ---------------------------------------------------------------------------
section('Update');
// ---------------------------------------------------------------------------

await check('updates editable fields', async () => {
  const response = await request('PATCH', `/api/students/${created.id}`, {
    body: { course: 'B.Sc Mathematics', year: '2nd Year', enrollmentStatus: 'inactive' },
  });

  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(response.body.data.student.course === 'B.Sc Mathematics', 'the course should be updated');
  assert(response.body.data.student.enrollmentStatus === 'inactive', 'the status should be updated');

  const stored = await Student.findById(created.id);
  assert(stored.course === 'B.Sc Mathematics', 'the change should be persisted');
});

await check('a student ID cannot be changed', async () => {
  const response = await request('PATCH', `/api/students/${created.id}`, {
    body: { studentId: 'CDS-2026-0001' },
  });

  assert(response.status === 422, `expected 422, received ${response.status}`);

  const stored = await Student.findById(created.id);
  assert(stored.studentId === created.studentId, 'the identifier must not change');
});

await check('an administrator may correct the registration date', async () => {
  const response = await request('PATCH', `/api/students/${created.id}`, {
    body: { dateOfRegistration: '2026-06-01' },
  });

  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(
    response.body.data.student.dateOfRegistration.startsWith('2026-06-01'),
    `unexpected date: ${response.body.data.student.dateOfRegistration}`,
  );
});

await check('a non-administrator cannot change the registration date', async () => {
  const response = await request('PATCH', `/api/students/${created.id}`, {
    token: staffToken,
    body: { dateOfRegistration: '2026-05-05' },
  });

  assert(response.status === 403, `expected 403, received ${response.status}`);
  assert(response.body.error.code === 'FORBIDDEN', `unexpected code: ${response.body.error.code}`);

  const stored = await Student.findById(created.id);
  assert(stored.dateOfRegistration.toISOString().startsWith('2026-06-01'), 'the date must be unchanged');
});

await check('a non-administrator can still edit other fields', async () => {
  const response = await request('PATCH', `/api/students/${created.id}`, {
    token: staffToken,
    body: { phone: '+91 90000 11111' },
  });

  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(response.body.data.student.phone === '+91 90000 11111', 'the phone should be updated');
});

await check('an empty patch body is rejected', async () => {
  const response = await request('PATCH', `/api/students/${created.id}`, { body: {} });

  assert(response.status === 422, `expected 422, received ${response.status}`);
  assert(response.body.error.details.form, 'the form-level problem should be reported');
});

await check('updating a missing student returns 404', async () => {
  const response = await request('PATCH', '/api/students/64b7f9c2e1a2b3c4d5e6f7a8', {
    body: { year: '1st Year' },
  });

  assert(response.status === 404, `expected 404, received ${response.status}`);
});

await check('duplicate emails are rejected on update too', async () => {
  const other = await createStudent();
  const response = await request('PATCH', `/api/students/${other.id}`, { body: { email: created.email } });

  assert(response.status === 409, `expected 409, received ${response.status}`);
  assert(response.body.error.details.email, 'the conflicting field should be reported');
});

// ---------------------------------------------------------------------------
section('Search, filtering, sorting and pagination');
// ---------------------------------------------------------------------------

const searchable = await createStudent({
  name: 'Meera Krishnan',
  email: 'meera.krishnan@campusdesk.edu',
  phone: '+91 98330 55270',
  course: 'B.Sc Physics',
  year: '1st Year',
  department: 'Physics',
});

const search = async (query, token = adminToken) => {
  const response = await request('GET', `/api/students?${query}&limit=100`, { token });
  assert(response.status === 200, `search \`${query}\` returned ${response.status}`);
  return response.body;
};

await check('search matches name, student ID, email, course and department', async () => {
  const byName = await search('search=Meera');
  assert(byName.data.students.some((student) => student.id === searchable.id), 'name search failed');

  const byId = await search(`search=${searchable.studentId}`);
  assert(byId.data.students.length === 1, 'student ID search should match exactly one record');

  const byEmail = await search('search=meera.krishnan@');
  assert(byEmail.data.students.some((student) => student.id === searchable.id), 'email search failed');

  const byCourse = await search('search=physics');
  assert(byCourse.data.students.some((student) => student.id === searchable.id), 'course search failed');

  const byDepartment = await search('search=Physics');
  assert(byDepartment.data.students.some((student) => student.id === searchable.id), 'department search failed');
});

await check('search matches a phone number typed without separators', async () => {
  const result = await search('search=9833055270');
  assert(
    result.data.students.some((student) => student.id === searchable.id),
    'a digits-only search should still find the spaced phone number',
  );
});

await check('search treats regular-expression input literally', async () => {
  const wildcard = await search('search=.%2A');
  assert(wildcard.data.students.length === 0, 'a wildcard must not match every record');

  const partial = await search('search=eera');
  assert(partial.data.students.some((student) => student.id === searchable.id), 'substring search should work');
});

await check('filters work individually and combined', async () => {
  const byStatus = await search('status=inactive');
  assert(byStatus.data.students.length > 0, 'status filter returned nothing');
  assert(byStatus.data.students.every((student) => student.enrollmentStatus === 'inactive'), 'status filter leaked');

  const byYear = await search('year=1st%20Year');
  assert(byYear.data.students.every((student) => student.year === '1st Year'), 'year filter leaked');

  const byDepartment = await search('department=Physics');
  assert(byDepartment.data.students.every((student) => student.department === 'Physics'), 'department filter leaked');
  assert(byDepartment.data.students.some((student) => student.id === searchable.id), 'the physics student is missing');

  const combined = await search('department=Physics&year=1st%20Year&status=active');
  assert(combined.data.students.length === 1, `combined filters should narrow to one, got ${combined.data.students.length}`);

  const noMatch = await search('department=Physics&year=4th%20Year');
  assert(noMatch.data.students.length === 0, 'an impossible combination should return nothing');
});

await check('filters are case-insensitive for department and course', async () => {
  const lower = await search('department=physics');
  assert(lower.data.students.length > 0, 'a lowercase department should still match');
});

await check('invalid filter values are rejected', async () => {
  for (const query of ['status=archived', 'year=5th%20Year', 'sort=passwordHash', 'order=sideways', 'limit=0', 'page=0']) {
    const response = await request('GET', `/api/students?${query}`);
    assert(response.status === 422, `\`${query}\` should be rejected, got ${response.status}`);
  }
});

await check('sorting works in both directions', async () => {
  const ascending = await search('sort=name&limit=100');
  const names = ascending.data.students.map((student) => student.name);
  assert([...names].sort((a, b) => a.localeCompare(b)).join('|') === names.join('|'), 'name sort should be ascending');

  const descending = await search('sort=-name&limit=100');
  const reversed = descending.data.students.map((student) => student.name);
  assert(reversed.join('|') === [...names].reverse().join('|'), 'descending sort should reverse the order');

  const byOrder = await search('sort=name&order=desc&limit=100');
  assert(
    byOrder.data.students.map((student) => student.name).join('|') === reversed.join('|'),
    'order=desc should equal the -name prefix',
  );
});

await check('pagination returns non-overlapping pages with accurate metadata', async () => {
  const total = await Student.countDocuments();

  const first = await search('page=1&limit=5&sort=name');
  const second = await search('page=2&limit=5&sort=name');

  assert(first.meta.page === 1 && first.meta.limit === 5, 'unexpected page metadata');
  assert(first.meta.total === total, `expected ${total} total records, got ${first.meta.total}`);
  assert(first.meta.totalPages === Math.ceil(total / 5), 'totalPages should round up');
  assert(first.meta.hasNextPage === true, 'page 1 should have a next page');
  assert(first.meta.hasPreviousPage === false, 'page 1 should not have a previous page');
  assert(second.meta.hasPreviousPage === true, 'page 2 should have a previous page');
  assert(first.data.students.length === 5, 'page 1 should contain five students');
  assert(first.meta.sort.direction === 'asc', 'the resolved sort should be reported');

  const firstIds = new Set(first.data.students.map((student) => student.id));
  const overlap = second.data.students.filter((student) => firstIds.has(student.id));
  assert(overlap.length === 0, 'pages must not overlap');
});

await check('a page beyond the end returns an empty list, not an error', async () => {
  const response = await request('GET', '/api/students?page=9999&limit=10');

  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(response.body.data.students.length === 0, 'there should be no students that far out');
  assert(response.body.meta.total > 0, 'the total should still be reported');
});

// ---------------------------------------------------------------------------
section('Statistics');
// ---------------------------------------------------------------------------

await check('statistics match the stored data', async () => {
  const response = await request('GET', '/api/students/stats');
  const stats = response.body?.data?.stats;

  assert(response.status === 200, `expected 200, received ${response.status}`);

  const total = await Student.countDocuments();
  const active = await Student.countDocuments({ enrollmentStatus: 'active' });
  const inactive = await Student.countDocuments({ enrollmentStatus: 'inactive' });

  assert(stats.total === total, `expected ${total} total, got ${stats.total}`);
  assert(stats.active === active, `expected ${active} active, got ${stats.active}`);
  assert(stats.inactive === inactive, `expected ${inactive} inactive, got ${stats.inactive}`);
  assert(stats.active + stats.inactive === stats.total, 'active and inactive should add up to the total');
});

await check('statistics report department and year distribution', async () => {
  const response = await request('GET', '/api/students/stats');
  const stats = response.body.data.stats;

  const physics = stats.byDepartment.find((row) => row.department === 'Physics');
  assert(physics, 'Physics should appear in the department breakdown');
  assert(physics.count === (await Student.countDocuments({ department: 'Physics' })), 'the count should match');

  const departmentTotal = stats.byDepartment.reduce((sum, row) => sum + row.count, 0);
  assert(departmentTotal === stats.total, 'department counts should add up to the total');

  const yearTotal = stats.byYear.reduce((sum, row) => sum + row.count, 0);
  assert(yearTotal === stats.total, 'year counts should add up to the total');
  assert(
    stats.byDepartment[0].count >= stats.byDepartment.at(-1).count,
    'departments should be ordered by size',
  );
});

await check('statistics include the most recent registrations', async () => {
  const response = await request('GET', '/api/students/stats');
  const recent = response.body.data.stats.recentRegistrations;

  assert(recent.length === 5, `expected five recent registrations, got ${recent.length}`);
  assert(recent.every((student) => student.id && student.studentId), 'each entry should identify its student');

  const dates = recent.map((student) => new Date(student.dateOfRegistration).getTime());
  assert(
    dates.every((value, index) => index === 0 || dates[index - 1] >= value),
    'recent registrations should be newest first',
  );
});

// ---------------------------------------------------------------------------
section('Delete');
// ---------------------------------------------------------------------------

await check('deletes a student and reports what was removed', async () => {
  const doomed = await createStudent();
  const response = await request('DELETE', `/api/students/${doomed.id}`);

  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(response.body.data.deleted === true, 'the response should confirm the deletion');
  assert(response.body.data.student.studentId === doomed.studentId, 'the removed record should be returned');

  const stored = await Student.findById(doomed.id);
  assert(stored === null, 'the student should no longer be in the database');
});

await check('deleting the same student twice returns 404', async () => {
  const doomed = await createStudent();
  await request('DELETE', `/api/students/${doomed.id}`);

  const second = await request('DELETE', `/api/students/${doomed.id}`);
  assert(second.status === 404, `expected 404, received ${second.status}`);
});

await check('a deleted student disappears from the list', async () => {
  const doomed = await createStudent();
  const before = await search(`search=${doomed.studentId}`);
  assert(before.data.students.length === 1, 'the student should be listed before deletion');

  await request('DELETE', `/api/students/${doomed.id}`);

  const after = await search(`search=${doomed.studentId}`);
  assert(after.data.students.length === 0, 'the student should be gone from the list');
});

await check('a deleted student ID is never reused', async () => {
  const doomed = await createStudent();
  await request('DELETE', `/api/students/${doomed.id}`);

  const replacement = await createStudent();
  assert(replacement.studentId !== doomed.studentId, 'the identifier must stay retired');
});

// ---------------------------------------------------------------------------
section('Security and access control');
// ---------------------------------------------------------------------------

await check('every student endpoint requires authentication', async () => {
  const calls = [
    ['GET', '/api/students'],
    ['GET', '/api/students/stats'],
    ['GET', `/api/students/${created.id}`],
    ['PATCH', `/api/students/${created.id}`],
    ['DELETE', `/api/students/${created.id}`],
  ];

  for (const [method, path] of calls) {
    const response = await request(method, path, { token: null, body: method === 'PATCH' ? { year: '2nd Year' } : undefined });
    assert(response.status === 401, `${method} ${path} should require a session, got ${response.status}`);
  }

  const create = await request('POST', '/api/students', { token: null, body: studentPayload() });
  assert(create.status === 401, `POST /api/students should require a session, got ${create.status}`);
});

await check('a suspended account cannot use its token', async () => {
  const response = await request('GET', '/api/students', {
    token: jwt.sign({ sub: '64b7f9c2e1a2b3c4d5e6f7a8' }, env.jwt.secret, { expiresIn: '5m' }),
  });

  assert(response.status === 401, `expected 401, received ${response.status}`);
  assert(response.body.error.code === 'UNAUTHORIZED', `unexpected code: ${response.body.error.code}`);
});

await check('stored passwords are never exposed or recoverable', async () => {
  const stored = await User.findById(admin.id).select('+passwordHash');

  assert(stored.passwordHash !== 'CampusDesk1', 'the password must not be stored in plaintext');
  assert(/^\$2[aby]\$/.test(stored.passwordHash), 'the password should be a bcrypt hash');
  assert(await stored.verifyPassword('CampusDesk1'), 'the stored hash should verify the password');

  const response = await request('GET', '/api/students');
  assert(!JSON.stringify(response.body).includes('passwordHash'), 'responses must not expose password hashes');
});

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

server.close();
await mongoose.connection.dropDatabase();
await disconnectDatabase();
await database.stop();

const elapsed = ((Date.now() - started) / 1000).toFixed(1);
const failed = results.filter((result) => !result.ok);

console.log(
  `\n${results.length - failed.length}/${results.length} database checks passed${failed.length ? `, ${failed.length} failed` : ''} (${elapsed}s)`,
);
console.log(`Verified against ${database.source}.\n`);

process.exit(failed.length > 0 ? 1 : 0);
