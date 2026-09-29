/**
 * CampusDesk verification suite — everything that must pass without a database.
 *
 * Boots the real Express application on an ephemeral port and exercises the API
 * surface, the validation chains, the Mongoose schemas and the pure service
 * helpers. Anything that needs live data belongs in `verify-database.js`, which
 * runs against a real MongoDB (`npm run verify:db`).
 *
 * Run with `npm run verify`.
 */
process.env.NODE_ENV = 'test';

const { once } = await import('node:events');
const express = (await import('express')).default;
const jwt = (await import('jsonwebtoken')).default;

const { createApp } = await import('../src/app.js');
const { env } = await import('../src/config/env.js');
// Side-effect import: applies the same Mongoose settings (query buffering
// budget) that src/server.js sets before serving requests.
await import('../src/config/db.js');
const {
  buildPageMeta,
  buildPhonePatterns,
  buildStudentQuery,
  escapeRegExp,
  resolvePagination,
  resolveSort,
} = await import('../src/services/studentService.js');
const { formatStudentId, generateStudentId } = await import('../src/utils/generateStudentId.js');
const { Counter } = await import('../src/models/Counter.js');
const { Student } = await import('../src/models/Student.js');
const { User } = await import('../src/models/User.js');
const {
  createStudentRules,
  listStudentRules,
  updateStudentRules,
} = await import('../src/validators/studentValidators.js');
const { validate } = await import('../src/middleware/validate.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');
const { STUDENT_ID_PREFIX } = await import('../src/constants/student.js');

const results = [];

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

// ---------------------------------------------------------------------------
// HTTP harnesses
// ---------------------------------------------------------------------------

/** The real application, so routing, middleware and error handling are covered. */
const app = createApp();
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const baseUrl = `http://127.0.0.1:${server.address().port}`;

/**
 * A second app exposing only the validator chains, so field-level rules can be
 * checked without a database or an authenticated session in the way.
 */
const validationApp = express();
validationApp.use(express.json());

const { matchedData } = await import('express-validator');

/**
 * Mirrors what the controllers actually consume. `req.query` is re-parsed by
 * Express 5 on each access, so the sanitised values only exist in matchedData —
 * asserting against `req.query` would test something production never reads.
 */
const echoValidated = (req, res) => {
  const body = matchedData(req, { locations: ['body'] });
  return res.json({
    success: true,
    data: {
      body,
      query: matchedData(req, { locations: ['query'] }),
      types: Object.fromEntries(Object.entries(body).map(([field, value]) => [field, value?.constructor?.name])),
    },
  });
};

validationApp.post('/students', createStudentRules, validate, echoValidated);
validationApp.post('/students/:id', updateStudentRules, validate, echoValidated);
validationApp.get('/students', listStudentRules, validate, echoValidated);

validationApp.use((error, _req, res, _next) => errorHandler(error, _req, res, _next));

const validationServer = validationApp.listen(0, '127.0.0.1');
await once(validationServer, 'listening');
const validationUrl = `http://127.0.0.1:${validationServer.address().port}`;

/** Every request carries a deadline: a stalled chain must fail a check, not hang the suite. */
const REQUEST_TIMEOUT_MS = 10000;

const get = (path, options = {}) =>
  fetch(`${baseUrl}${path}`, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

const post = (path, body, options = {}) =>
  fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

const postTo = (url, path, body) =>
  fetch(`${url}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

/** Every student endpoint a signed-in administrator can reach. */
const VALID_STUDENT = {
  name: 'Ananya Sharma',
  email: 'ananya.sharma@campusdesk.edu',
  phone: '+91 98220 41182',
  course: 'B.Tech Computer Science',
  year: '3rd Year',
  department: 'Computer Science',
  dateOfRegistration: '2026-07-14',
  enrollmentStatus: 'active',
};

console.log(`\nCampusDesk verification — API on ${baseUrl}`);

// ---------------------------------------------------------------------------
section('Configuration');
// ---------------------------------------------------------------------------

await check('environment loads with sane defaults', () => {
  assert(env.isTest, 'NODE_ENV should be test during verification');
  assert(env.port > 0, 'port should be a positive number');
  assert(env.apiPrefix === '/api', `unexpected API prefix: ${env.apiPrefix}`);
  assert(env.database.uri.startsWith('mongodb'), 'database URI should be a MongoDB connection string');
  assert(env.security.allowedOrigins.length > 0, 'at least one client origin must be allowed');
  assert(env.security.bcryptSaltRounds >= 10, 'bcrypt cost should be at least 10');
});

// ---------------------------------------------------------------------------
section('Query building (pure)');
// ---------------------------------------------------------------------------

await check('search spans name, student ID, email, course and department', () => {
  const query = buildStudentQuery({ search: 'ananya' });
  const fields = query.$or.map((clause) => Object.keys(clause)[0]);

  for (const field of ['name', 'studentId', 'email', 'course', 'department']) {
    assert(fields.includes(field), `search should cover ${field}`);
  }
});

await check('search escapes regular-expression metacharacters', () => {
  const query = buildStudentQuery({ search: 'a+b(c)*' });
  const pattern = query.$or[0].name.source;

  assert(pattern.includes('\\+'), 'plus should be escaped');
  assert(pattern.includes('\\('), 'parenthesis should be escaped');
  assert(pattern.includes('\\*'), 'asterisk should be escaped');
  assert(escapeRegExp('.*') === '\\.\\*', 'escapeRegExp should escape wildcards');
});

await check('search handles a digits-only phone number', () => {
  const patterns = buildPhonePatterns('9822041182');
  assert(patterns.length === 1, 'a ten digit term should produce a phone pattern');
  assert(patterns[0].test('+91 98220 41182'), 'spaced phone number should match');
  assert(patterns[0].test('9822041182'), 'unspaced phone number should match');
  assert(buildPhonePatterns('an').length === 0, 'short terms should not build phone patterns');
});

await check('filters combine into one query', () => {
  const query = buildStudentQuery({
    status: 'active',
    year: '3rd Year',
    department: 'computer science',
    course: 'b.tech computer science',
  });

  assert(query.enrollmentStatus === 'active', 'status filter missing');
  assert(query.year === '3rd Year', 'year filter missing');
  assert(query.department instanceof RegExp && query.department.test('Computer Science'), 'department should match case-insensitively');
  assert(query.course instanceof RegExp && query.course.test('B.Tech Computer Science'), 'course should match case-insensitively');
});

await check('an empty filter set produces an empty query', () => {
  assert(Object.keys(buildStudentQuery()).length === 0, 'no input should produce no filter');
  assert(Object.keys(buildStudentQuery({ search: '   ' })).length === 0, 'blank search should be ignored');
});

await check('pagination is clamped to sensible bounds', () => {
  assert(resolvePagination({ page: -3, limit: 5000 }).limit === 100, 'limit should cap at 100');
  assert(resolvePagination({ page: 0 }).page === 1, 'page should floor at 1');
  assert(resolvePagination({ page: 3, limit: 10 }).skip === 20, 'skip should derive from page and limit');
  assert(resolvePagination({}).limit === 10, 'default page size should apply');
});

await check('sort accepts a whitelisted field with a direction', () => {
  assert(resolveSort('name').clause === 'name', 'name without a prefix should be ascending');
  assert(resolveSort('-name').clause === '-name', '-name should be descending');
  assert(resolveSort('name', 'desc').clause === '-name', 'order=desc should reverse the field');
  assert(resolveSort('name', 'asc').clause === 'name', 'order=asc should keep ascending');
  assert(resolveSort('studentId').clause === 'studentId', 'student ID sorts ascending');
  assert(resolveSort('createdAt', 'desc').direction === 'desc', 'direction should be reported');
});

await check('sort falls back for unknown or dangerous fields', () => {
  for (const attempt of ['passwordHash', '$where', 'name; db.dropDatabase()', 'studentId-']) {
    const sort = resolveSort(attempt);
    assert(sort.field === 'dateOfRegistration', `\`${attempt}\` must not be sortable`);
    assert(sort.clause === '-dateOfRegistration', `\`${attempt}\` should fall back to newest first`);
  }
  assert(resolveSort('', 'desc').clause === '-dateOfRegistration', 'order alone should still sort sensibly');
});

await check('pagination metadata reports the page window', () => {
  const meta = buildPageMeta(2, 10, 25, { field: 'name', direction: 'asc' });

  assert(meta.totalPages === 3, 'total pages should round up');
  assert(meta.hasNextPage === true, 'page 2 of 3 has a next page');
  assert(meta.hasPreviousPage === true, 'page 2 of 3 has a previous page');
  assert(buildPageMeta(1, 10, 0).totalPages === 1, 'an empty register still has one page');
  assert(buildPageMeta(1, 10, 0).hasNextPage === false, 'an empty register has no next page');
});

// ---------------------------------------------------------------------------
section('Student IDs');
// ---------------------------------------------------------------------------

await check('formats identifiers as CDS-YYYY-NNNN', () => {
  assert(formatStudentId(2026, 1) === 'CDS-2026-0001', 'sequence should be padded to four digits');
  assert(formatStudentId(2026, 42) === 'CDS-2026-0042', 'sequence should be padded to four digits');
  assert(formatStudentId(2026, 10000) === 'CDS-2026-10000', 'long sequences should not be truncated');
  assert(formatStudentId(2030, 7).startsWith(`${STUDENT_ID_PREFIX}-2030-`), 'year should be taken from the argument');
});

await check('the counter is incremented atomically per year', async () => {
  const calls = [];
  const original = Counter.findByIdAndUpdate;

  Counter.findByIdAndUpdate = async (key, update, options) => {
    calls.push({ key, update, options });
    return { seq: calls.length };
  };

  try {
    const first = await generateStudentId(new Date('2026-01-05'));
    const second = await generateStudentId(new Date('2026-03-19'));
    const nextYear = await generateStudentId(new Date('2027-02-01'));

    assert(first === 'CDS-2026-0001', `unexpected first id: ${first}`);
    assert(second === 'CDS-2026-0002', `unexpected second id: ${second}`);
    assert(nextYear === 'CDS-2027-0003', `unexpected rollover id: ${nextYear}`);
    assert(calls[0].key === 'student:2026' && calls[2].key === 'student:2027', 'counter keys should be per year');
    assert(calls[0].update.$inc.seq === 1, 'the counter must be incremented, never read-then-written');
    assert(calls[0].options.upsert === true, 'the counter should be created on first use');
  } finally {
    Counter.findByIdAndUpdate = original;
  }
});

await check('a duplicated counter document is retried', async () => {
  const original = Counter.findByIdAndUpdate;
  let attempts = 0;

  Counter.findByIdAndUpdate = async () => {
    attempts += 1;
    if (attempts === 1) {
      const error = new Error('E11000 duplicate key error');
      error.code = 11000;
      throw error;
    }
    return { seq: 9 };
  };

  try {
    const id = await generateStudentId(new Date('2026-08-08'));
    assert(attempts === 2, 'the upsert should be retried once');
    assert(id === 'CDS-2026-0009', `unexpected id after retry: ${id}`);
  } finally {
    Counter.findByIdAndUpdate = original;
  }
});

// ---------------------------------------------------------------------------
section('Student schema (no database required)');
// ---------------------------------------------------------------------------

/** Run validation with the counter stubbed, so the ID hook resolves offline. */
const withStubbedCounter = async (run, seq = 1) => {
  const original = Counter.findByIdAndUpdate;
  Counter.findByIdAndUpdate = async () => ({ seq });

  try {
    return await run();
  } finally {
    Counter.findByIdAndUpdate = original;
  }
};

/** Field-level validation messages for a document, or {} when it is valid. */
const schemaErrors = async (doc) => {
  try {
    await doc.validate();
    return {};
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return Object.fromEntries(
        Object.entries(error.errors).map(([field, issue]) => [field, issue.message]),
      );
    }
    return { __unexpected: `${error.name}: ${error.message}` };
  }
};

await check('required student fields are enforced', async () => {
  const errors = await withStubbedCounter(() => schemaErrors(new Student({})));

  for (const field of ['name', 'email', 'phone', 'course', 'year', 'department']) {
    assert(errors[field], `${field} should be required`);
  }
  assert(
    Student.schema.path('dateOfRegistration').isRequired,
    'the registration date should be required (it has a default, so it is never missing)',
  );
});

await check('field formats and lengths are enforced', async () => {
  const invalid = await withStubbedCounter(() =>
    schemaErrors(
      new Student({
        ...VALID_STUDENT,
        email: 'not-an-email',
        phone: 'call me',
        name: 'A',
        course: 'x'.repeat(121),
        department: 'y'.repeat(121),
      }),
    ),
  );

  assert(invalid.email, 'invalid email should be rejected');
  assert(invalid.phone, 'invalid phone should be rejected');
  assert(invalid.name, 'one character names should be rejected');
  assert(invalid.course, 'over-long course should be rejected');
  assert(invalid.department, 'over-long department should be rejected');
});

await check('enums are enforced for year and enrollment status', async () => {
  const errors = await withStubbedCounter(() =>
    schemaErrors(new Student({ ...VALID_STUDENT, year: '5th Year', enrollmentStatus: 'pending' })),
  );

  assert(errors.year, 'unknown year should be rejected');
  assert(errors.enrollmentStatus, 'unknown enrollment status should be rejected');
});

await check('a valid record passes schema validation', async () => {
  const student = await withStubbedCounter(async () => {
    const doc = new Student(VALID_STUDENT);
    const errors = await schemaErrors(doc);
    return { doc, errors };
  });

  assert(
    Object.keys(student.errors).length === 0,
    `a valid student should validate, got ${JSON.stringify(student.errors)}`,
  );
  assert(student.doc.studentId === 'CDS-2026-0001', 'the hook should assign an id during validation');
});

await check('values are normalised and defaults applied', () => {
  const student = new Student({
    ...VALID_STUDENT,
    name: '  Ananya Sharma  ',
    email: '  ANANYA.Sharma@CampusDesk.edu  ',
    enrollmentStatus: undefined,
    avatarUrl: undefined,
  });

  assert(student.name === 'Ananya Sharma', 'name should be trimmed');
  assert(student.email === 'ananya.sharma@campusdesk.edu', `email should be lowercased, got ${student.email}`);
  assert(student.enrollmentStatus === 'active', 'new students default to active');
  assert(student.avatarUrl === '', 'avatar should default to an empty string');
  assert(student.dateOfRegistration instanceof Date, 'registration date should default to now');
});

await check('student IDs are assigned by the schema hook', async () => {
  const original = Counter.findByIdAndUpdate;
  Counter.findByIdAndUpdate = async () => ({ seq: 7 });

  try {
    const student = new Student({ ...VALID_STUDENT, dateOfRegistration: new Date('2026-07-14') });
    await student.validate();

    assert(student.studentId === 'CDS-2026-0007', `unexpected generated id: ${student.studentId}`);
    assert(Student.schema.path('studentId').options.immutable === true, 'student IDs must be immutable');
  } finally {
    Counter.findByIdAndUpdate = original;
  }
});

await check('generated IDs must match the documented format', async () => {
  const errors = await withStubbedCounter(() =>
    schemaErrors(new Student({ ...VALID_STUDENT, studentId: 'STUDENT-1' })),
  );
  assert(errors.studentId, 'a hand-written identifier should be rejected');
});

await check('useful indexes are declared', () => {
  const indexes = Student.schema.indexes().map(([fields, options]) => ({ fields, options }));
  const has = (predicate) => indexes.some(predicate);

  assert(has(({ fields, options }) => fields.email === 1 && options?.unique), 'email should be uniquely indexed');
  assert(has(({ fields, options }) => fields.studentId === 1 && options?.unique), 'studentId should be uniquely indexed');
  assert(
    has(({ fields }) => fields.enrollmentStatus === 1 && fields.dateOfRegistration === -1),
    'the default register view should be indexed',
  );
  assert(has(({ fields }) => fields.department === 1 && fields.year === 1), 'the combinable filters should be indexed');
  assert(Student.schema.options.timestamps === true, 'timestamps should be enabled');
});

await check('serialised students drop internal fields', () => {
  const student = new Student({ ...VALID_STUDENT, studentId: 'CDS-2026-0001' });
  const json = student.toJSON();

  assert(json.id === String(student._id), 'a string id should be exposed');
  assert(json.isActive === true, 'the isActive virtual should be exposed');
  assert(json.__v === undefined, '__v should never be serialised');
  assert(json.studentId === 'CDS-2026-0001', 'the student ID should be serialised');
});

// ---------------------------------------------------------------------------
section('User schema (no database required)');
// ---------------------------------------------------------------------------

await check('passwords are hashed and never stored as plaintext', async () => {
  const user = new User({ name: 'Campus Admin', email: 'admin@campusdesk.edu' });
  user.password = 'CampusDesk1';

  await user.validate();

  assert(user.passwordHash && user.passwordHash !== 'CampusDesk1', 'the hash must not be the password');
  assert(/^\$2[aby]\$/.test(user.passwordHash), 'bcrypt hashes start with $2a/$2b/$2y');
  assert(await user.verifyPassword('CampusDesk1'), 'the correct password should verify');
  assert((await user.verifyPassword('wrong-password')) === false, 'a wrong password should not verify');
});

await check('the hash is hidden by default and stripped from JSON', () => {
  assert(User.schema.path('passwordHash').options.select === false, 'passwordHash should be select:false');

  const user = new User({ name: 'Campus Admin', email: 'admin@campusdesk.edu' });
  user.passwordHash = '$2y$10$abcdefghijklmnopqrstuv';

  const json = user.toJSON();
  assert(json.passwordHash === undefined, 'the hash must never leave the API');
  assert(json.role === 'admin', 'a role should default to admin');
});

await check('user email is unique and normalised', () => {
  const user = new User({ name: 'Campus Admin', email: '  ADMIN@CampusDesk.edu ' });
  assert(user.email === 'admin@campusdesk.edu', `email should be normalised, got ${user.email}`);

  const indexes = User.schema.indexes();
  assert(
    indexes.some(([fields, options]) => fields.email === 1 && options?.unique),
    'email should be uniquely indexed so duplicates cannot be stored',
  );
});

// ---------------------------------------------------------------------------
section('Validation chains (422 contract)');
// ---------------------------------------------------------------------------

await check('create rejects a payload with missing fields', async () => {
  const response = await postTo(validationUrl, '/students', {});
  const body = await response.json();

  assert(response.status === 422, `expected 422, received ${response.status}`);
  assert(body.error.code === 'VALIDATION_ERROR', 'expected VALIDATION_ERROR');
  for (const field of ['name', 'email', 'phone', 'course', 'year', 'department']) {
    assert(body.error.details[field], `${field} should be reported`);
  }
});

await check('create rejects malformed values', async () => {
  const response = await postTo(validationUrl, '/students', {
    ...VALID_STUDENT,
    email: 'nope',
    phone: 'no',
    year: '6th Year',
    enrollmentStatus: 'archived',
    avatarUrl: 'not-a-url',
    name: 'A',
  });
  const body = await response.json();

  assert(response.status === 422, `expected 422, received ${response.status}`);
  for (const field of ['email', 'phone', 'year', 'enrollmentStatus', 'avatarUrl', 'name']) {
    assert(body.error.details[field], `${field} should be reported`);
  }
});

await check('create refuses a client-supplied student ID', async () => {
  const response = await postTo(validationUrl, '/students', { ...VALID_STUDENT, studentId: 'CDS-2026-9999' });
  const body = await response.json();

  assert(response.status === 422, `expected 422, received ${response.status}`);
  assert(/generated by CampusDesk/i.test(body.error.details.studentId ?? ''), 'the reason should be explained');
});

await check('create accepts and sanitises a valid payload', async () => {
  const response = await postTo(validationUrl, '/students', {
    ...VALID_STUDENT,
    name: '  Ananya Sharma  ',
    email: '  ANANYA@CampusDesk.edu ',
    dateOfRegistration: '2026-07-14T00:00:00.000Z',
  });
  const body = await response.json();

  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(body.data.body.name === 'Ananya Sharma', 'name should be trimmed');
  assert(body.data.body.email === 'ananya@campusdesk.edu', 'email should be normalised');
  assert(body.data.types.dateOfRegistration === 'Date', 'valid ISO dates should be cast to Date');
  assert(body.data.body.studentId === undefined, 'no student ID should be accepted from the client');
});

await check('create allows a student without an optional avatar', async () => {
  const response = await postTo(validationUrl, '/students', VALID_STUDENT);
  const body = await response.json();

  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(body.data.body.avatarUrl === undefined, 'an absent avatar should not be invented');
});

await check('create rejects an avatar that is neither a URL nor a path', async () => {
  const response = await postTo(validationUrl, '/students', { ...VALID_STUDENT, avatarUrl: 'javascript:alert(1)' });
  const body = await response.json();

  assert(response.status === 422, `expected 422, received ${response.status}`);
  assert(body.error.details.avatarUrl, 'the avatar should be reported');
});

await check('update requires at least one field', async () => {
  const response = await postTo(validationUrl, '/students/64b7f9c2e1a2b3c4d5e6f7a8', {});
  const body = await response.json();

  assert(response.status === 422, `expected 422, received ${response.status}`);
  assert(
    /at least one field/i.test(body.error.details.form ?? ''),
    `unexpected details: ${JSON.stringify(body.error.details)}`,
  );
});

await check('update accepts a single field and an emptied avatar', async () => {
  const response = await postTo(validationUrl, '/students/64b7f9c2e1a2b3c4d5e6f7a8', {
    enrollmentStatus: 'inactive',
    avatarUrl: '',
  });
  const body = await response.json();

  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(body.data.body.enrollmentStatus === 'inactive', 'the status should be accepted');
  assert(body.data.body.avatarUrl === '', 'an empty avatar should reach the service so it can be cleared');
  assert(body.data.body.name === undefined, 'untouched fields should not be sent');
});

await check('update refuses protected fields and malformed ids', async () => {
  const protectedResponse = await postTo(validationUrl, '/students/64b7f9c2e1a2b3c4d5e6f7a8', {
    studentId: 'CDS-2026-0002',
  });
  assert(protectedResponse.status === 422, 'a supplied student ID should be rejected');

  const idResponse = await postTo(validationUrl, '/students/not-an-object-id', { name: 'Ananya Sharma' });
  const idBody = await idResponse.json();
  assert(idResponse.status === 422, `expected 422, received ${idResponse.status}`);
  assert(idBody.error.details.id, 'the invalid id should be reported on the id field');
});

await check('list rejects unsupported sort, order, page and limit values', async () => {
  const cases = [
    'sort=passwordHash',
    'order=sideways',
    'limit=5000',
    'page=0',
    `search=${'x'.repeat(130)}`,
    'status=archived',
    'year=5th Year',
  ];

  for (const queryString of cases) {
    const response = await fetch(`${validationUrl}/students?${queryString}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    assert(response.status === 422, `\`${queryString}\` should be rejected, got ${response.status}`);
  }
});

await check('list accepts combinable filters and coerces numbers', async () => {
  const response = await fetch(
    `${validationUrl}/students?status=active&year=3rd%20Year&department=Computer%20Science&sort=name&order=desc&page=2&limit=25`,
    { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
  );
  const body = await response.json();

  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(body.data.query.page === 2, 'page should be coerced to a number');
  assert(body.data.query.limit === 25, 'limit should be coerced to a number');
  assert(body.data.query.order === 'desc', 'order should be preserved');
});

// ---------------------------------------------------------------------------
section('API integration (MongoDB stubbed, no database)');
// ---------------------------------------------------------------------------

/**
 * Drives the real application over HTTP — routing, validation chains, the auth
 * guard, controllers, services and the response envelope — with the Mongoose
 * models replaced by recording stubs. MongoDB itself is not exercised here;
 * `npm run verify:db` is the suite that does that.
 */
const stubApp = createApp();
const stubServer = stubApp.listen(0, '127.0.0.1');
await once(stubServer, 'listening');
const stubUrl = `http://127.0.0.1:${stubServer.address().port}`;

const adminToken = jwt.sign({ sub: '64b7f9c2e1a2b3c4d5e6f7a8', role: 'admin' }, env.jwt.secret, {
  expiresIn: '5m',
});
const staffToken = jwt.sign({ sub: '64b7f9c2e1a2b3c4d5e6f7a8', role: 'staff' }, env.jwt.secret, {
  expiresIn: '5m',
});

const fakeUser = { id: '64b7f9c2e1a2b3c4d5e6f7a8', name: 'Campus Administrator', role: 'admin' };

const MODELS = { Student, User };

/** Patches model statics for one test, restoring them afterwards. */
const withModelStubs = async (stubs, run) => {
  const restore = [];

  for (const [name, overrides] of Object.entries(stubs)) {
    const model = MODELS[name];
    if (!model) throw new Error(`Unknown model in stub: ${name}`);

    for (const [key, value] of Object.entries(overrides)) {
      restore.push([model, key, model[key]]);
      model[key] = value;
    }
  }

  try {
    return await run();
  } finally {
    for (const [model, key, original] of restore.reverse()) model[key] = original;
  }
};

const fakeDocument = (overrides = {}) => ({
  ...VALID_STUDENT,
  _id: '64b7f9c2e1a2b3c4d5e6f7a8',
  id: '64b7f9c2e1a2b3c4d5e6f7a8',
  studentId: 'CDS-2026-0042',
  dateOfRegistration: new Date('2026-07-14'),
  async save() {
    this.saved = true;
    return this;
  },
  async deleteOne() {
    this.removed = true;
  },
  ...overrides,
});

const chainableQuery = (documents) => {
  const query = {
    sortCalls: [],
    sort(clause) {
      query.sortCalls.push(clause);
      return query;
    },
    skip(value) {
      query.skipped = value;
      return query;
    },
    limit(value) {
      query.limited = value;
      return query;
    },
    then(resolve, reject) {
      return Promise.resolve(documents).then(resolve, reject);
    },
  };
  return query;
};

const stubRequest = (method, path, { body, token = adminToken } = {}) =>
  fetch(`${stubUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }).then(async (response) => ({ status: response.status, body: await response.json().catch(() => null) }));

// The auth guard looks the account up on every request; the stub stands in for
// that collection so the student routes can be reached without MongoDB.
const userStubs = { User: { findById: async () => fakeUser } };
const fakeStaff = { ...fakeUser, name: 'Records Officer', role: 'staff' };
const staffUserStubs = { User: { findById: async () => fakeStaff } };

await check('a signed-in request reaches the register', async () => {
  const query = chainableQuery([fakeDocument()]);
  let filter;
  let counted;

  const response = await withModelStubs(
    {
      ...userStubs,
      Student: {
        find: (value) => {
          filter = value;
          return query;
        },
        countDocuments: async (value) => {
          counted = value;
          return 12;
        },
      },
    },
    () => stubRequest('GET', '/api/students?status=active&year=1st%20Year&page=2&limit=5&sort=name'),
  );

  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(response.body.success === true, 'the envelope should report success');
  assert(Array.isArray(response.body.data.students), 'students should be returned under `students`');
  assert(response.body.meta.total === 12, 'the total should come from countDocuments');
  assert(response.body.meta.page === 2 && response.body.meta.limit === 5, 'unexpected page metadata');
  assert(response.body.meta.hasNextPage === true, 'a next page should be advertised');
  assert(filter.enrollmentStatus === 'active', 'the status filter should reach the query');
  assert(filter.year === '1st Year', 'the year filter should reach the query');
  assert(counted.enrollmentStatus === 'active', 'the count must use the same filter as the page');
  assert(query.sortCalls[0] === 'name', `expected an ascending name sort, got ${query.sortCalls[0]}`);
  assert(query.skipped === 5 && query.limited === 5, 'skip and limit should follow from page and limit');
});

await check('search input reaches the query escaped', async () => {
  let filter;

  await withModelStubs(
    {
      ...userStubs,
      Student: {
        find: (value) => {
          filter = value;
          return chainableQuery([]);
        },
        countDocuments: async () => 0,
      },
    },
    () => stubRequest('GET', '/api/students?search=a%2Bb%28c'),
  );

  assert(Array.isArray(filter.$or), 'search should build an $or clause');
  assert(filter.$or[0].name.source.includes('\\+'), 'metacharacters must be escaped in the query');
});

await check('the stats endpoint shapes the dashboard payload', async () => {
  const facetRows = [
    {
      byStatus: [
        { _id: 'active', count: 7 },
        { _id: 'inactive', count: 2 },
      ],
      byDepartment: [
        { _id: 'Computer Science', count: 5 },
        { _id: 'Physics', count: 4 },
      ],
      byYear: [{ _id: '1st Year', count: 9 }],
      total: [{ value: 9 }],
      recentRegistrations: [
        { _id: 'a', studentId: 'CDS-2026-0009', name: 'Meera', dateOfRegistration: new Date('2026-08-01') },
      ],
    },
  ];

  const response = await withModelStubs(
    { ...userStubs, Student: { aggregate: async () => facetRows } },
    () => stubRequest('GET', '/api/students/stats'),
  );

  const stats = response.body?.data?.stats;
  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(stats.total === 9, `unexpected total: ${stats.total}`);
  assert(stats.active === 7 && stats.inactive === 2, 'the status split should be read from the facet');
  assert(stats.byDepartment[0].department === 'Computer Science', 'department rows should be mapped');
  assert(stats.byYear[0].year === '1st Year', 'year rows should be mapped');
  assert(stats.recentRegistrations[0].id === 'a', 'recent registrations should carry a string id');
  assert(stats.recentRegistrations[0]._id === undefined, 'the raw _id should not be exposed');
});

await check('creating a student answers 201 with the created record', async () => {
  const document = fakeDocument();
  let payload;

  const response = await withModelStubs(
    {
      ...userStubs,
      Student: {
        create: async (value) => {
          payload = value;
          return document;
        },
      },
    },
    () => stubRequest('POST', '/api/students', { body: VALID_STUDENT }),
  );

  assert(response.status === 201, `expected 201, received ${response.status}`);
  assert(response.body.data.student.studentId === 'CDS-2026-0042', 'the created student should be returned');
  assert(payload.studentId === undefined, 'the service must never pass a client student ID through');
  assert(payload.name === 'Ananya Sharma', 'the payload should be trimmed by the validators');
  assert(Object.keys(payload).sort().join(',') === Object.keys(VALID_STUDENT).sort().join(','), 'only editable fields should be written');
});

await check('a colliding student ID is generated again instead of failing', async () => {
  const document = fakeDocument();
  let attempts = 0;

  const response = await withModelStubs(
    {
      ...userStubs,
      Student: {
        create: async () => {
          attempts += 1;
          if (attempts === 1) {
            // What MongoDB raises when two requests race for the same sequence.
            const collision = new Error('E11000 duplicate key error');
            collision.code = 11000;
            collision.keyPattern = { studentId: 1 };
            throw collision;
          }
          return document;
        },
      },
    },
    () => stubRequest('POST', '/api/students', { body: VALID_STUDENT }),
  );

  assert(response.status === 201, `expected 201, received ${response.status}`);
  assert(attempts === 2, `the create should be retried once, attempts: ${attempts}`);
});

await check('a permanent student ID collision answers 409, not 500', async () => {
  let attempts = 0;

  const response = await withModelStubs(
    {
      ...userStubs,
      Student: {
        create: async () => {
          attempts += 1;
          const collision = new Error('E11000 duplicate key error');
          collision.code = 11000;
          collision.keyPattern = { studentId: 1 };
          throw collision;
        },
      },
    },
    () => stubRequest('POST', '/api/students', { body: VALID_STUDENT }),
  );

  assert(response.status === 409, `expected 409, received ${response.status}`);
  assert(attempts === 5, `the create should stop after its retry budget, attempts: ${attempts}`);
});

await check('a duplicate email answers 409', async () => {
  const duplicate = Object.assign(new Error('E11000 duplicate key error'), {
    code: 11000,
    keyPattern: { email: 1 },
  });

  const response = await withModelStubs(
    { ...userStubs, Student: { create: async () => { throw duplicate; } } },
    () => stubRequest('POST', '/api/students', { body: VALID_STUDENT }),
  );

  assert(response.status === 409, `expected 409, received ${response.status}`);
  assert(response.body.error.code === 'CONFLICT', `unexpected code: ${response.body.error.code}`);
  assert(response.body.error.details.email, 'the conflicting field should be reported');
});

await check('an unknown student answers 404', async () => {
  const response = await withModelStubs(
    { ...userStubs, Student: { findById: async () => null } },
    () => stubRequest('GET', '/api/students/64b7f9c2e1a2b3c4d5e6f7a8'),
  );

  assert(response.status === 404, `expected 404, received ${response.status}`);
  assert(response.body.error.code === 'NOT_FOUND', `unexpected code: ${response.body.error.code}`);
});

await check('a malformed student id answers 422 before any query', async () => {
  let queried = false;

  const response = await withModelStubs(
    {
      ...userStubs,
      Student: {
        findById: async () => {
          queried = true;
          return null;
        },
      },
    },
    () => stubRequest('GET', '/api/students/not-an-id'),
  );

  assert(response.status === 422, `expected 422, received ${response.status}`);
  assert(response.body.error.details.id, 'the id field should be reported');
  assert(queried === false, 'the database should not be queried for an invalid id');
});

await check('update applies the change and answers 200', async () => {
  const document = fakeDocument();

  const response = await withModelStubs(
    { ...userStubs, Student: { findById: async () => document } },
    () => stubRequest('PATCH', `/api/students/${document.id}`, { body: { year: '4th Year' } }),
  );

  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(document.year === '4th Year', 'the change should be applied');
  assert(document.saved === true, 'the document should be saved');
  assert(response.body.data.student.year === '4th Year', 'the updated student should be returned');
});

await check('a staff account cannot move the registration date', async () => {
  const document = fakeDocument();

  const response = await withModelStubs(
    { ...staffUserStubs, Student: { findById: async () => document } },
    () =>
      stubRequest('PATCH', `/api/students/${document.id}`, {
        token: staffToken,
        body: { dateOfRegistration: '2020-01-01' },
      }),
  );

  assert(response.status === 403, `expected 403, received ${response.status}`);
  assert(response.body.error.code === 'FORBIDDEN', `unexpected code: ${response.body.error.code}`);
  assert(document.saved !== true, 'the document must not be saved when the change is refused');
  assert(document.dateOfRegistration.getFullYear() === 2026, 'the stored date must be unchanged');
});

await check('a staff account cannot escalate through its own token', async () => {
  const document = fakeDocument();
  const forgedToken = jwt.sign({ sub: fakeStaff.id, role: 'admin' }, env.jwt.secret, {
    expiresIn: '5m',
  });

  const response = await withModelStubs(
    { ...staffUserStubs, Student: { findById: async () => document } },
    () =>
      stubRequest('PATCH', `/api/students/${document.id}`, {
        token: forgedToken,
        body: { dateOfRegistration: '2020-01-01' },
      }),
  );

  assert(response.status === 403, `expected 403, received ${response.status}`);
  assert(document.saved !== true, 'a claim in the token must not grant administrator rights');
});

await check('an admin account may correct the registration date', async () => {
  const document = fakeDocument();

  const response = await withModelStubs(
    { ...userStubs, Student: { findById: async () => document } },
    () => stubRequest('PATCH', `/api/students/${document.id}`, { body: { dateOfRegistration: '2026-06-01' } }),
  );

  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(document.dateOfRegistration.toISOString().startsWith('2026-06-01'), 'the date should be corrected');
});

await check('deleting a student answers with the removed record', async () => {
  const document = fakeDocument();

  const response = await withModelStubs(
    { ...userStubs, Student: { findById: async () => document } },
    () => stubRequest('DELETE', `/api/students/${document.id}`),
  );

  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(response.body.data.deleted === true, 'the response should confirm the deletion');
  assert(document.removed === true, 'the document should be deleted');
});

await check('a token for an account that no longer exists answers 401', async () => {
  const response = await withModelStubs({ User: { findById: async () => null } }, () =>
    stubRequest('GET', '/api/students'),
  );

  assert(response.status === 401, `expected 401, received ${response.status}`);
  assert(response.body.error.code === 'UNAUTHORIZED', `unexpected code: ${response.body.error.code}`);
});

await check('database errors map to the documented envelopes', async () => {
  const errorApp = express();
  errorApp.get('/:kind', (req, _res, next) => {
    const duplicates = Object.assign(new Error('E11000 duplicate key error'), {
      code: 11000,
      keyPattern: { email: 1 },
    });
    const cast = Object.assign(new Error('Cast to ObjectId failed'), {
      name: 'CastError',
      path: '_id',
      value: 'abc',
    });
    const offline = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:27017'), {
      name: 'MongoServerSelectionError',
    });
    const version = Object.assign(new Error('No matching document found for id'), { name: 'VersionError' });

    const kinds = { duplicate: duplicates, cast, offline, version, unknown: new Error('boom') };
    return next(kinds[req.params.kind] ?? kinds.unknown);
  });
  errorApp.use((error, req, res, next) => errorHandler(error, req, res, next));

  const errorServer = errorApp.listen(0, '127.0.0.1');
  await once(errorServer, 'listening');
  const errorUrl = `http://127.0.0.1:${errorServer.address().port}`;

  const expectations = [
    ['duplicate', 409, 'CONFLICT'],
    ['cast', 400, 'BAD_REQUEST'],
    ['offline', 503, 'DATABASE_UNAVAILABLE'],
    ['version', 409, 'CONFLICT'],
    ['unknown', 500, 'INTERNAL_ERROR'],
  ];

  try {
    for (const [kind, status, code] of expectations) {
      const response = await fetch(`${errorUrl}/${kind}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      const body = await response.json();

      assert(response.status === status, `${kind} should map to ${status}, received ${response.status}`);
      assert(body.error.code === code, `${kind} should report ${code}, received ${body.error.code}`);
      assert(
        !/ECONNREFUSED|ObjectId|E11000/.test(body.error.message),
        `${kind} leaked internals: ${body.error.message}`,
      );
    }
  } finally {
    errorServer.close();
  }
});

// ---------------------------------------------------------------------------
section('HTTP surface');
// ---------------------------------------------------------------------------

const readiness = await get('/api/health/ready');
const readinessBody = await readiness.json();
const databaseConnected = readinessBody.data?.database?.isConnected === true;

await check('GET /api returns the endpoint index', async () => {
  const response = await get('/api');
  const body = await response.json();

  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(body.success === true, 'response envelope should report success');
  assert(body.data.endpoints.students.length === 6, 'six student endpoints should be advertised');
});

await check('GET /api/health reports the service as ok', async () => {
  const response = await get('/api/health');
  const body = await response.json();

  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(body.data.service === 'campusdesk-api', 'service name mismatch');
  assert(body.data.status === 'ok', 'health status should be ok');
});

await check('GET /api/health/ready reports the database state honestly', () => {
  assert([200, 503].includes(readiness.status), `unexpected status: ${readiness.status}`);
  assert(typeof readinessBody.data.database.isConnected === 'boolean', 'database flags missing');
  assert(
    readiness.status === (databaseConnected ? 200 : 503),
    'the status code should match the connection state',
  );
  console.log(`      database: ${readinessBody.data.database.state}`);
});

await check('security headers are present', async () => {
  const response = await get('/api/health');
  assert(response.headers.get('x-content-type-options') === 'nosniff', 'helmet header missing');
  assert(!response.headers.get('x-powered-by'), 'x-powered-by should be disabled');
});

await check('an unknown route returns a 404 envelope', async () => {
  const response = await get('/api/does-not-exist');
  const body = await response.json();

  assert(response.status === 404, `expected 404, received ${response.status}`);
  assert(body.success === false && body.error.code === 'NOT_FOUND', 'unexpected error body');
});

await check('malformed JSON is rejected with 400', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"email": ',
  });
  const body = await response.json();

  assert(response.status === 400, `expected 400, received ${response.status}`);
  assert(body.error.code === 'BAD_REQUEST', `unexpected code: ${body.error.code}`);
});

await check('login validation returns field-level details', async () => {
  const response = await post('/api/auth/login', { email: 'not-an-email', password: 'short' });
  const body = await response.json();

  assert(response.status === 422, `expected 422, received ${response.status}`);
  assert(body.error.details.email && body.error.details.password, 'both fields should be reported');
});

await check('signup validation rejects a weak password', async () => {
  const response = await post('/api/auth/register', {
    name: 'Campus Admin',
    email: 'admin@campusdesk.edu',
    password: 'passwordonly',
  });
  const body = await response.json();

  assert(response.status === 422, `expected 422, received ${response.status}`);
  assert(body.error.details.password, 'weak password should be reported');
});

await check('the student area is protected', async () => {
  for (const path of ['/api/students', '/api/students/stats', '/api/students/64b7f9c2e1a2b3c4d5e6f7a8']) {
    const response = await get(path);
    const body = await response.json();

    assert(response.status === 401, `${path} should require authentication, got ${response.status}`);
    assert(body.error.code === 'UNAUTHORIZED', `${path} should report UNAUTHORIZED`);
  }
});

await check('the student area rejects writes without a session', async () => {
  const create = await post('/api/students', VALID_STUDENT);
  assert(create.status === 401, `create should require authentication, got ${create.status}`);

  const remove = await fetch(`${baseUrl}/api/students/64b7f9c2e1a2b3c4d5e6f7a8`, { method: 'DELETE' });
  assert(remove.status === 401, `delete should require authentication, got ${remove.status}`);
});

await check('an invalid bearer token is rejected', async () => {
  const response = await get('/api/students/stats', {
    headers: { Authorization: 'Bearer not.a.real.token' },
  });
  const body = await response.json();

  assert(response.status === 401, `expected 401, received ${response.status}`);
  assert(body.error.code === 'UNAUTHORIZED', `unexpected code: ${body.error.code}`);
});

await check('a well-formed token for an unknown account cannot reach data', async () => {
  // Signed with the configured secret, but there is no such user (and, with the
  // database down, the lookup cannot even be attempted).
  const token = jwt.sign({ sub: '64b7f9c2e1a2b3c4d5e6f7a8', role: 'admin' }, env.jwt.secret, {
    expiresIn: '5m',
  });

  const response = await get('/api/students', { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json();

  if (databaseConnected) {
    assert(response.status === 401, `expected 401 for an unknown account, received ${response.status}`);
  } else {
    assert(response.status === 503, `expected 503 while the database is down, received ${response.status}`);
    assert(body.error.code === 'DATABASE_UNAVAILABLE', `unexpected code: ${body.error.code}`);
  }
});

await check('queries against an unavailable database fail within a bounded time', async () => {
  if (databaseConnected) return; // the connection makes this check meaningless

  const budget = env.database.bufferTimeoutMS + 2000;
  const outcome = await Promise.race([
    Student.find({}).limit(1).then(
      () => 'resolved',
      (error) => `rejected:${error.name}`,
    ),
    new Promise((resolve) => setTimeout(() => resolve('hung'), budget + 4000)),
  ]);

  assert(outcome !== 'hung', 'a query must never hang when the database is unreachable');
  assert(outcome === 'rejected:MongooseError', `unexpected outcome: ${outcome}`);
});

await check('the database suite is loadable', async () => {
  // The database suite cannot run without a MongoDB, but a syntax error in it
  // must never go unnoticed. `--check` parses without executing.
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, ['--check', new URL('./verify-database.js', import.meta.url).pathname], {
    stdio: 'pipe',
  });
});

await check('a database failure never leaks internals', async () => {
  if (databaseConnected) return;

  const token = jwt.sign({ sub: '64b7f9c2e1a2b3c4d5e6f7a8' }, env.jwt.secret, { expiresIn: '5m' });
  const response = await get('/api/students', { headers: { Authorization: `Bearer ${token}` } });
  const raw = JSON.stringify(await response.json());

  assert(!/mongodb(\+srv)?:\/\//i.test(raw), 'the connection string must never appear in a response');
  assert(!/MongoServerSelectionError|MongooseError|ECONNREFUSED/i.test(raw), 'driver internals must not leak');
  assert(!/"stack"/.test(raw), 'operational failures should not include a stack trace');
  assert(response.status === 503, 'the caller should receive a 503');
});

// ---------------------------------------------------------------------------
stubServer.close();
validationServer.close();
server.close();

const failed = results.filter((result) => !result.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed${failed.length ? `, ${failed.length} failed` : ''}`,
);
console.log(
  databaseConnected
    ? 'Database-backed behaviour: run `npm run verify:db`.\n'
    : 'Database-backed behaviour was NOT verified — no MongoDB connection was available.\n' +
        'Run `npm run verify:db` against a MongoDB instance for the CRUD suite.\n',
);

process.exit(failed.length > 0 ? 1 : 0);
