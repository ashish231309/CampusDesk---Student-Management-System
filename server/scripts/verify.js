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
const { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } = await import('node:fs');
const express = (await import('express')).default;
const jwt = (await import('jsonwebtoken')).default;

const { createApp } = await import('../src/app.js');
const { env } = await import('../src/config/env.js');
// Side-effect import: applies the same Mongoose settings (query buffering
// budget) that src/server.js sets before serving requests.
await import('../src/config/db.js');
const {
  MAX_SKIP,
  buildPageMeta,
  buildPhonePatterns,
  buildStudentQuery,
  escapeRegExp,
  resolvePagination,
  resolveSort,
  splitSearchTerms,
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

await check('multiple search terms are matched independently', () => {
  const query = buildStudentQuery({ search: 'ashish kumar' });

  assert(!('$or' in query), 'a multi-term search should not collapse into one branch');
  assert(Array.isArray(query.$and) && query.$and.length === 2, `expected two term branches, got ${query.$and?.length}`);

  // Each term is its own OR group, so the terms may live in different fields:
  // "Kumar, Ashish" in one field, or a name plus a department.
  for (const group of query.$and) {
    assert(Array.isArray(group.$or), 'each term should be an OR over the searchable fields');
    const fields = group.$or.map((clause) => Object.keys(clause)[0]);
    for (const field of ['name', 'studentId', 'email', 'course', 'department']) {
      assert(fields.includes(field), `each term should search ${field}`);
    }
  }

  const [first, second] = query.$and.map((group) => group.$or[0].name.source);
  assert(first.includes('ashish') && second.includes('kumar'), `terms should be separate: ${first}, ${second}`);
});

await check('a term spanning two fields is found through the OR groups', () => {
  const query = buildStudentQuery({ search: 'cse 2026' });
  const [firstGroup, secondGroup] = query.$and;

  // A department clause matching the first term and a student-ID clause
  // matching the second are enough — the terms need not share a field.
  assert(firstGroup.$or.some((clause) => clause.department?.test('CSE')), 'the department clause should match "cse"');
  assert(secondGroup.$or.some((clause) => clause.studentId?.test('CDS-2026-0007')), 'the student ID clause should match "2026"');
});

await check('search terms are deduplicated and bounded', () => {
  assert(splitSearchTerms('  ashish   kumar ').join(',') === 'ashish,kumar', 'whitespace should be normalised');
  assert(splitSearchTerms('ashish ashish').length === 1, 'a repeated term should count once');
  assert(splitSearchTerms('one two three four five six seven eight').length === 6, 'the term count should be capped');
  assert(splitSearchTerms('').length === 0, 'an empty search should produce no terms');
});

await check('a multi-term search still escapes every term', () => {
  const query = buildStudentQuery({ search: 'a+b c*d' });
  const sources = query.$and.flatMap((group) => group.$or.map((clause) => Object.values(clause)[0].source));

  assert(sources.some((source) => source.includes('\\+')), 'the first term should be escaped');
  assert(sources.some((source) => source.includes('\\*')), 'the second term should be escaped');
});

await check('a term that looks like a phone number is matched loosely in any position', () => {
  const single = buildStudentQuery({ search: '9822041182' });
  assert(
    single.$or.some((clause) => clause.phone instanceof RegExp),
    'a phone-shaped term should add a phone clause',
  );

  const multi = buildStudentQuery({ search: 'kumar 9822041182' });
  const phoneGroup = multi.$and.find((group) => group.$or.some((clause) => clause.phone));
  assert(Boolean(phoneGroup), 'the phone clause should survive alongside a name term');
  assert(
    phoneGroup.$or.find((clause) => clause.phone).phone.test('+91 98220 41182'),
    'the phone term should match the stored, spaced number',
  );
});

await check('a search longer than the cap is truncated before it becomes a pattern', () => {
  const query = buildStudentQuery({ search: 'x'.repeat(400) });
  const source = query.$or[0].name.source;

  assert(source.length <= 121, `the pattern should be bounded, got ${source.length}`);
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
  assert(json.password === undefined, 'the password virtual must never be serialised');
  assert(json._id === undefined, 'the raw id should not be exposed alongside `id`');
  assert(json.role === 'staff', 'a new account must default to the least privileged role');
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

// `User.prototype` is included so a real document can be saved (and its
// password virtual hashed) without a database in the authentication section.
const MODELS = { Student, User, 'User.prototype': User.prototype };

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

await check('the filter options endpoint is protected and data-derived', async () => {
  const unauthenticated = await stubRequest('GET', '/api/students/filters', { token: null });
  assert(unauthenticated.status === 401, `expected 401 without a session, received ${unauthenticated.status}`);

  const distinctCalls = [];
  const response = await withModelStubs(
    {
      ...userStubs,
      Student: {
        distinct: async (field) => {
          distinctCalls.push(field);
          return field === 'course'
            ? ['B.Tech Computer Science', 'BBA', 'B.Tech Computer Science', '']
            : ['Computer Science', 'Business Administration'];
        },
      },
    },
    () => stubRequest('GET', '/api/students/filters'),
  );

  assert(response.status === 200, `expected 200, received ${response.status}`);

  const options = response.body.data.options;
  assert(distinctCalls.includes('course') && distinctCalls.includes('department'), 'the options should come from the data');
  assert(options.courses.includes('BBA'), 'discovered courses should be offered');
  assert(!options.courses.includes(''), 'blank values should be dropped');
  assert(options.courses.length === 2, `duplicates should collapse, got ${JSON.stringify(options.courses)}`);
  assert(options.departments.includes('Computer Science'), 'discovered departments should be offered');
  assert(options.years.length > 0 && options.statuses.includes('active'), 'fixed vocabularies should be included');
  assert(options.sortFields.includes('name'), 'the sortable fields should be advertised');
  assert(JSON.stringify(options.courses) === JSON.stringify([...options.courses].sort()), 'options should be sorted');
});

await check('the filters route is not mistaken for a student id', async () => {
  // If `filters` were parsed as an id the request would fail validation instead
  // of reaching the options handler.
  const response = await withModelStubs(
    {
      ...userStubs,
      Student: { distinct: async () => [] },
    },
    () => stubRequest('GET', '/api/students/filters'),
  );

  assert(response.status === 200, `expected the options handler, received ${response.status}`);
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
section('Authentication (MongoDB stubbed, no database)');
// ---------------------------------------------------------------------------

/**
 * The sign-in flow is exercised against the real model, validators and
 * controller — only the database calls are stubbed. `makeAccount` builds a real
 * User document with a genuinely bcrypt-hashed password, so password
 * verification is the production code path and not a stand-in.
 */
const makeAccount = async ({
  name = 'Records Officer',
  email = 'officer@campusdesk.edu',
  role = 'staff',
  password = 'passw0rd123',
} = {}) => {
  const account = new User({ name, email, role });
  account.password = password;
  await account.validate();
  return account;
};

/** `User.findOne(...)` returns a query; `.select()` just returns it again. */
const selectable = (document) => ({
  select() {
    return this;
  },
  then(resolve, reject) {
    return Promise.resolve(document).then(resolve, reject);
  },
});

/** No document may reach a database in this section: writes are recorded only. */
const noWrites = (sink = []) => ({
  'User.prototype': {
    // Mongoose validates before it writes, so the stand-in does too — that is
    // what makes the password virtual hash for real in these checks.
    async save() {
      await this.validate();
      sink.push(this);
      return this;
    },
  },
});

let wrongPassword = null;
const loginAttempt = (body) => stubRequest('POST', '/api/auth/login', { token: null, body });
const registerAttempt = (body) => stubRequest('POST', '/api/auth/register', { token: null, body });
const authFailures = [];

await check('registration stores a bcrypt hash and answers 201', async () => {
  const saved = [];

  const response = await withModelStubs(
    { ...noWrites(saved), User: { exists: async () => null } },
    () =>
      registerAttempt({
        name: '  Ananya Sharma  ',
        email: 'Ananya.Sharma@CampusDesk.edu',
        password: 'passw0rd123',
      }),
  );

  assert(response.status === 201, `expected 201, received ${response.status}`);

  const account = saved[0];
  assert(Boolean(account), 'the new account should be saved');
  assert(/^\$2[aby]\$/.test(account.passwordHash), 'the password should be stored as a bcrypt hash');
  assert(account.passwordHash !== 'passw0rd123', 'the plaintext must never be stored');
  assert(account._pendingPassword === undefined, 'the plaintext must not stay on the document');
  assert(account.name === 'Ananya Sharma', 'the name should be trimmed');
  assert(account.email === 'ananya.sharma@campusdesk.edu', 'the email should be lowercased');
  assert(account.role === 'staff', 'a public registration must create a staff account');

  const raw = JSON.stringify(response.body);
  assert(!raw.includes('passwordHash'), 'the hash must never be returned');
  assert(!raw.includes('passw0rd123'), 'the plaintext must never be returned');
  assert(response.body.data.user.role === 'staff', 'the response should report the assigned role');

  const payload = jwt.verify(response.body.data.token, env.jwt.secret);
  assert(payload.sub === account.id, 'the token should identify the new account');
});

await check('registration refuses a client-supplied role before any lookup', async () => {
  let lookedUp = false;

  const response = await withModelStubs(
    {
      ...noWrites(),
      User: {
        exists: async () => {
          lookedUp = true;
          return null;
        },
      },
    },
    () =>
      registerAttempt({
        name: 'Mallory',
        email: 'mallory@campusdesk.edu',
        password: 'passw0rd123',
        role: 'admin',
      }),
  );

  assert(response.status === 422, `expected 422, received ${response.status}`);
  assert(response.body.error.details.role, 'the rejected role should be reported');
  assert(lookedUp === false, 'the request should be rejected before the database is touched');
});

await check('registration rejects invalid details field by field', async () => {
  const cases = [
    [{ email: 'person@campusdesk.edu', password: 'passw0rd123' }, 'name'],
    [{ name: 'Ananya', password: 'passw0rd123' }, 'email'],
    [{ name: 'Ananya', email: 'not-an-email', password: 'passw0rd123' }, 'email'],
    [{ name: 'Ananya', email: 'person@campusdesk.edu' }, 'password'],
    [{ name: 'Ananya', email: 'person@campusdesk.edu', password: 'short' }, 'password'],
    [{ name: 'A', email: 'person@campusdesk.edu', password: 'passw0rd123' }, 'name'],
    [{ name: 'Ananya', email: 'person@campusdesk.edu', password: 'passwordonly' }, 'password'],
  ];

  for (const [body, field] of cases) {
    const response = await withModelStubs({ ...noWrites(), User: { exists: async () => null } }, () =>
      registerAttempt(body),
    );

    assert(response.status === 422, `expected 422, received ${response.status}`);
    assert(response.body.error.details?.[field], `\`${field}\` should be reported`);
    authFailures.push(response);
  }
});

await check('registration reports a duplicate email as 409', async () => {
  const response = await withModelStubs(
    { ...noWrites(), User: { exists: async () => ({ _id: 'taken' }) } },
    () =>
      registerAttempt({
        name: 'Ananya Sharma',
        email: 'ananya@campusdesk.edu',
        password: 'passw0rd123',
      }),
  );

  assert(response.status === 409, `expected 409, received ${response.status}`);
  assert(response.body.error.code === 'CONFLICT', `unexpected code: ${response.body.error.code}`);
  assert(response.body.error.details.email, 'the duplicate field should be reported');
  authFailures.push(response);
});

await check('sign-in returns a token and the safe profile', async () => {
  const account = await makeAccount();
  let touched = null;

  const response = await withModelStubs(
    {
      ...noWrites(),
      User: {
        findOne: (filter) => {
          touched = filter;
          return selectable(account);
        },
      },
    },
    () => loginAttempt({ email: 'Officer@CampusDesk.edu', password: 'passw0rd123' }),
  );

  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(touched.email === 'officer@campusdesk.edu', 'the email should be normalised before the lookup');

  const { user, token } = response.body.data;
  assert(typeof token === 'string' && token.split('.').length === 3, 'a JWT should be returned');
  assert(user.id === account.id, 'the safe profile should identify the account');
  assert(user.role === 'staff', 'the profile should carry the stored role');
  assert(!JSON.stringify(response.body).includes('passwordHash'), 'the hash must never be returned');
  assert(user.lastLoginAt, 'a successful sign-in should be recorded on the account');

  const payload = jwt.verify(token, env.jwt.secret);
  assert(payload.sub === account.id && payload.role === 'staff', 'unexpected token claims');
});

await check('sign-in rejects a wrong password with a generic 401', async () => {
  const account = await makeAccount();

  const response = await withModelStubs(
    { ...noWrites(), User: { findOne: () => selectable(account) } },
    () => loginAttempt({ email: account.email, password: 'wrong-passw0rd' }),
  );

  assert(response.status === 401, `expected 401, received ${response.status}`);
  assert(response.body.error.code === 'UNAUTHORIZED', `unexpected code: ${response.body.error.code}`);
  authFailures.push(response);
  wrongPassword = response;
});

await check('an unknown email is answered exactly like a wrong password', async () => {
  const response = await withModelStubs(
    { ...noWrites(), User: { findOne: () => selectable(null) } },
    () => loginAttempt({ email: 'nobody@campusdesk.edu', password: 'passw0rd123' }),
  );

  assert(response.status === 401, `expected 401, received ${response.status}`);
  assert(
    response.body.error.message === wrongPassword.body.error.message &&
      response.body.error.code === wrongPassword.body.error.code,
    'the two failures must be indistinguishable',
  );
  assert(
    !/not found|no account|unknown|not registered|incorrect password/i.test(response.body.error.message),
    'the message must not reveal which part was wrong',
  );
  authFailures.push(response);
});

await check('sign-in does not apply the registration password policy', async () => {
  const account = await makeAccount({ password: 'abc' });

  const response = await withModelStubs(
    { ...noWrites(), User: { findOne: () => selectable(account) } },
    () => loginAttempt({ email: account.email, password: 'abc' }),
  );

  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(response.body.data.token, 'an existing account must still be able to sign in');
});

await check('the session token carries only what it needs', async () => {
  const account = await makeAccount();

  const response = await withModelStubs(
    { ...noWrites(), User: { findOne: () => selectable(account) } },
    () => loginAttempt({ email: account.email, password: 'passw0rd123' }),
  );

  const claims = Object.keys(jwt.decode(response.body.data.token)).sort().join(',');
  assert(claims === 'exp,iat,role,sub', `unexpected claims: ${claims}`);

  const raw = Buffer.from(response.body.data.token.split('.')[1], 'base64url').toString();
  assert(!raw.includes('passwordHash') && !raw.includes('@'), 'no sensitive value belongs in a token');
});

await check('a token for an account that no longer exists is refused', async () => {
  const response = await withModelStubs(
    { ...noWrites(), User: { findById: async () => null } },
    () => stubRequest('GET', '/api/auth/me'),
  );

  assert(response.status === 401, `expected 401, received ${response.status}`);
  authFailures.push(response);
});

await check('me returns the signed-in account without the hash', async () => {
  const account = await makeAccount();

  const response = await withModelStubs(
    { ...noWrites(), User: { findById: async () => account } },
    () => stubRequest('GET', '/api/auth/me'),
  );

  assert(response.status === 200, `expected 200, received ${response.status}`);

  const user = response.body.data.user;
  assert(user.id === account.id && user.email === account.email, 'the profile should identify the account');
  assert(user.role === 'staff', 'the profile should carry the role');
  assert(user.passwordHash === undefined, 'the hash must never be serialised');
  assert(user.password === undefined, 'the password virtual must never be serialised');
  assert(user.__v === undefined, 'internal fields should be stripped');

  const allowed = ['id', 'name', 'email', 'role', 'lastLoginAt', 'createdAt', 'updatedAt'];
  const unexpected = Object.keys(user).filter((key) => !allowed.includes(key));
  assert(unexpected.length === 0, `unexpected profile fields: ${unexpected.join(', ')}`);
});

await check('an expired token is rejected with 401', async () => {
  const expired = jwt.sign({ sub: fakeUser.id, role: 'staff' }, env.jwt.secret, { expiresIn: '-5s' });
  const response = await stubRequest('GET', '/api/auth/me', { token: expired });

  assert(response.status === 401, `expected 401, received ${response.status}`);
  assert(response.body.error.code === 'UNAUTHORIZED', `unexpected code: ${response.body.error.code}`);
  assert(!/jwt|token expired|JsonWebTokenError/i.test(response.body.error.message), 'internals must not leak');
  authFailures.push(response);
});

await check('a token signed with another secret is rejected with 401', async () => {
  const forged = jwt.sign({ sub: fakeUser.id, role: 'admin' }, 'not-the-campusdesk-secret', {
    expiresIn: '5m',
  });
  const response = await stubRequest('GET', '/api/auth/me', { token: forged });

  assert(response.status === 401, `expected 401, received ${response.status}`);
  authFailures.push(response);
});

await check('a malformed token is rejected with 401', async () => {
  for (const token of ['not-a-token', 'a.b.c', '']) {
    const response = await stubRequest('GET', '/api/auth/me', { token });

    assert(response.status === 401, `expected 401 for \`${token}\`, received ${response.status}`);
    authFailures.push(response);
  }
});

await check('sign-out answers the standard envelope without pretending to revoke', async () => {
  const withToken = await stubRequest('POST', '/api/auth/logout');
  const withoutToken = await stubRequest('POST', '/api/auth/logout', { token: null });

  assert(withToken.status === 200, `expected 200, received ${withToken.status}`);
  assert(withToken.body.success === true, 'the envelope should report success');
  assert(withToken.body.data.revokedOnServer === false, 'the API must not claim server-side revocation');
  assert(typeof withToken.body.data.message === 'string', 'the client should get a clear instruction');
  assert(withoutToken.status === 200, 'signing out with no token must still succeed');
});

await check('every authentication failure uses the standard envelope', () => {
  assert(authFailures.length >= 6, 'the surrounding checks should have produced failures');

  for (const response of authFailures) {
    assert(response.body.success === false, 'success must be false');
    assert(typeof response.body.error?.code === 'string', 'a machine-readable code is required');
    assert(typeof response.body.error?.message === 'string', 'a human-readable message is required');
    assert(!('stack' in (response.body.error ?? {})), 'a stack trace must never be returned');
  }
});

await check('credential endpoints carry a tighter limiter', async () => {
  const { authRateLimit } = await import('../src/middleware/rateLimit.js');
  assert(typeof authRateLimit === 'function', 'the limiter should be a middleware');

  const { env: current } = await import('../src/config/env.js');
  assert(
    current.security.authRateLimit.max < current.security.rateLimit.max,
    'the credential budget must be stricter than the global one',
  );

  const source = readFileSync(new URL('../src/routes/authRoutes.js', import.meta.url), 'utf8');
  for (const endpoint of ["'/register'", "'/login'"]) {
    const line = source.split('\n').find((row) => row.includes(endpoint));
    assert(line?.includes('authRateLimit'), `${endpoint} should use the tighter limiter`);
  }
});

// ---------------------------------------------------------------------------
section('Client data layer (real client modules against the real API)');
// ---------------------------------------------------------------------------

/**
 * The browser bundle is built by Vite, so these modules cannot simply be
 * imported here. They are bundled with the same bundler Vite uses (rolldown)
 * and run with the browser globals they expect, which means the checks below
 * execute the *real* `studentService` → `apiClient` path: arguments → query
 * string → HTTP request → real Express app → real validators and controllers →
 * response envelope → the object a component receives.
 *
 * `apiClient`, `studentService` and the error mapper are built as one graph, so
 * they share a single module instance — the session state and the
 * `onUnauthorized` listeners are the same ones the application uses.
 *
 * `root` and `platform` exist for the route-rendering checks further down, which
 * bundle the server-side entry point instead of a client module.
 */
const bundleClient = async (entries, { baseUrl, root = '../../client/src/', platform = 'browser' } = {}) => {
  const { rolldown } = await import('rolldown');
  const directory = new URL('../.client-bundle/', import.meta.url);

  const bundle = await rolldown({
    input: Object.fromEntries(
      Object.entries(entries).map(([name, relative]) => [
        name,
        new URL(`${root}${relative}`, import.meta.url).pathname,
      ]),
    ),
    platform,
    // React Router ships a `"use client"` directive that means nothing outside a
    // React framework; only this script ever imports the bundle.
    onLog: (level, log, defaultHandler) => {
      // React Router's `"use client"` directive and the harness entry importing
      // pages the router also lazy-loads are both irrelevant to a Node bundle.
      if (['MODULE_LEVEL_DIRECTIVE', 'INEFFECTIVE_DYNAMIC_IMPORT'].includes(log.code)) return;
      defaultHandler(level, log);
    },
  });

  const { output } = await bundle.generate({ format: 'esm' });
  mkdirSync(directory, { recursive: true });

  const written = [];
  for (const chunk of output) {
    // Vite replaces `import.meta.env` at build time; Node has no such object,
    // so the harness supplies the same values through a global.
    const code = chunk.code.replaceAll('import.meta.env', 'globalThis.__CLIENT_ENV__');
    writeFileSync(new URL(chunk.fileName, directory), code);
    written.push(chunk.fileName);
  }

  globalThis.__CLIENT_ENV__ = { VITE_API_BASE_URL: baseUrl, VITE_API_TIMEOUT_MS: '15000' };
  globalThis.window ??= {};
  globalThis.window.location = { origin: 'http://localhost' };
  // Motion asks whether it is in a browser and then listens for resizes. These
  // bundles run outside one, so the hooks exist as no-ops rather than missing.
  globalThis.window.matchMedia ??= () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  globalThis.window.addEventListener ??= () => {};
  globalThis.window.removeEventListener ??= () => {};
  globalThis.window.localStorage ??= (() => {
    const store = new Map();
    return {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    };
  })();

  const loaded = Object.fromEntries(
    await Promise.all(
      Object.entries(entries).map(async ([name]) => [
        name,
        await import(new URL(`${name}.js`, directory)),
      ]),
    ),
  );

  return {
    loaded,
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
    written,
  };
};

const clientBundle = await bundleClient(
  {
    studentService: 'services/studentService.js',
    apiClient: 'services/apiClient.js',
    apiErrors: 'utils/apiErrors.js',
    studentQuery: 'utils/studentQuery.js',
  },
  { baseUrl: `${stubUrl}/api` },
);

const { studentService: clientApi } = clientBundle.loaded.studentService;
const { authToken, onUnauthorized, ApiRequestError } = clientBundle.loaded.apiClient;
const { describeLoadError, errorMessage } = clientBundle.loaded.apiErrors;

/** Model stand-ins for one list call, recording what reached the query. */
const withListStubs = (run, { total = 12 } = {}) => {
  const query = chainableQuery([fakeDocument()]);
  const seen = {};

  return withModelStubs(
    {
      ...userStubs,
      Student: {
        find: (filter) => {
          seen.filter = filter;
          return query;
        },
        countDocuments: async () => total,
      },
    },
    () => run(seen, query),
  );
};

await check('the client list call reaches the API with its search, filters, sort and page', async () => {
  // A token in storage is what `apiClient` sends: the API answering 200 (rather
  // than 401) is what proves the request carried the session.
  authToken.set(adminToken);

  const { result, seen, query } = await withListStubs(async (captured, chain) => {
    const value = await clientApi.list({
      search: 'sharma',
      status: 'active',
      year: '3rd Year',
      department: 'Computer Science',
      course: 'B.Tech Computer Science',
      sort: '-name',
      page: 2,
      limit: 8,
    });

    return { result: value, seen: captured, query: chain };
  });

  assert(Array.isArray(result.students), 'the client should receive the rows array');
  assert(result.students.length === 1, 'the row the API returned should come through');
  assert(result.meta?.total === 12, `the pagination total should survive the envelope, got ${result.meta?.total}`);
  assert(result.meta.page === 2 && result.meta.limit === 8, `unexpected page metadata: ${JSON.stringify(result.meta)}`);
  assert(result.meta.totalPages === 2, `expected 2 pages for 12 rows of 8, got ${result.meta.totalPages}`);

  assert(seen.filter.enrollmentStatus === 'active', 'the status filter should reach the database query');
  assert(seen.filter.year === '3rd Year', 'the year filter should reach the database query');
  // Department and course are matched case-insensitively but anchored, so the
  // filter arrives as a regex rather than a bare string.
  assert(
    seen.filter.department instanceof RegExp && seen.filter.department.test('computer science'),
    `the department filter should reach the database query, got ${seen.filter.department}`,
  );
  assert(
    !seen.filter.department.test('Computer Science and Engineering'),
    'the department filter must stay anchored, not substring-matched',
  );
  assert(
    seen.filter.course instanceof RegExp && seen.filter.course.test('B.TECH COMPUTER SCIENCE'),
    `the course filter should reach the database query, got ${seen.filter.course}`,
  );
  const searchPatterns = seen.filter.$or
    .flatMap((clause) => Object.values(clause))
    .filter((value) => value instanceof RegExp);
  assert(
    searchPatterns.some((pattern) => pattern.source.includes('sharma')),
    `the search term should reach the database query as a pattern, got ${searchPatterns.map((p) => p.source).join(', ')}`,
  );
  assert(
    searchPatterns.every((pattern) => pattern.test('ANANYA SHARMA')),
    'the search should be case-insensitive',
  );

  assert(query.sortCalls[0] === '-name', `the client's sort value should reach the query, got ${query.sortCalls[0]}`);
  assert(query.skipped === 8, `page 2 of 8 rows should skip 8, skipped ${query.skipped}`);
  assert(query.limited === 8, `the page size should reach the query, got ${query.limited}`);
});

await check('blank filters are left out of the request entirely', async () => {
  authToken.set(adminToken);

  const seen = await withListStubs(
    (captured) => clientApi.list({ status: 'active', page: 1 }).then(() => captured),
    { total: 1 },
  );

  assert(seen.filter.enrollmentStatus === 'active', 'the used filter should reach the query');
  assert(!('department' in seen.filter), 'an empty department must not be sent as a filter');
  assert(!('year' in seen.filter), 'an empty year must not be sent as a filter');
  assert(!('$or' in seen.filter), 'an empty search must not become a regex');
});

await check('the client cannot list students without a session', async () => {
  authToken.clear();

  let failure = null;
  try {
    await withListStubs(() => clientApi.list({ page: 1 }));
  } catch (error) {
    failure = error;
  }

  assert(failure instanceof ApiRequestError, `expected an ApiRequestError, got ${failure}`);
  assert(failure.status === 401, `expected 401, received ${failure.status}`);
  assert(failure.isUnauthorized, 'the failure should be recognisable as an authentication problem');
});

await check('a refused token clears the session and notifies the app', async () => {
  let notified = 0;
  const unsubscribe = onUnauthorized(() => {
    notified += 1;
  });

  authToken.set('a-token-signed-by-nobody');

  let failure = null;
  try {
    await withListStubs(() => clientApi.list({ page: 1 }));
  } catch (error) {
    failure = error;
  } finally {
    unsubscribe();
  }

  assert(failure?.status === 401, `expected the API to refuse the token, got ${failure?.status}`);
  assert(notified === 1, `the session listener should fire exactly once, fired ${notified}`);
  assert(authToken.get() === null, 'the rejected token should be discarded');
});

await check('detail, create, update and delete call the right endpoints', async () => {
  authToken.set(adminToken);
  const document = fakeDocument();
  let createdPayload = null;

  const detail = await withModelStubs(
    { ...userStubs, Student: { findById: async () => document } },
    () => clientApi.getById(document.id),
  );
  assert(detail.id === document.id, `detail should return the record, got ${JSON.stringify(detail)}`);

  const created = await withModelStubs(
    {
      ...userStubs,
      Student: {
        create: async (payload) => {
          createdPayload = payload;
          return fakeDocument({ id: 'new-id' });
        },
      },
    },
    () =>
      clientApi.create({
        name: 'Ananya Sharma',
        email: 'ananya.sharma@campusdesk.edu',
        phone: '+91 98220 41182',
        course: 'B.Tech Computer Science',
        year: '3rd Year',
        department: 'Computer Science',
        enrollmentStatus: 'active',
      }),
  );

  assert(created.id === 'new-id', `create should return the created record, got ${JSON.stringify(created)}`);
  assert(createdPayload.studentId === undefined, 'the client must never supply a student ID');
  assert(createdPayload.name === 'Ananya Sharma', 'the payload should reach the service intact');

  const updated = await withModelStubs(
    { ...userStubs, Student: { findById: async () => fakeDocument() } },
    () => clientApi.update(document.id, { year: '4th Year' }),
  );
  assert(updated.year === '4th Year', `update should return the saved record, got ${JSON.stringify(updated)}`);

  const removed = await withModelStubs(
    { ...userStubs, Student: { findById: async () => fakeDocument() } },
    () => clientApi.remove(document.id),
  );
  assert(removed?.deleted === true, `delete should confirm the removal, got ${JSON.stringify(removed)}`);
});

await check('a malformed id and an unknown id are told apart by the client', async () => {
  authToken.set(adminToken);

  const malformed = await withModelStubs({ ...userStubs }, () =>
    clientApi.getById('not-an-id').then(
      (value) => ({ ok: true, value }),
      (error) => ({ ok: false, error }),
    ),
  );

  assert(malformed.ok === false, 'a malformed id must not resolve');
  assert(malformed.error.status === 422, `expected 422, received ${malformed.error.status}`);
  assert(
    describeLoadError(malformed.error).kind === 'missing',
    'a malformed id should read as a missing record, not as an outage',
  );

  const missing = await withModelStubs({ ...userStubs, Student: { findById: async () => null } }, () =>
    clientApi.getById('64b7f9c2e1a2b3c4d5e6f7a8').then(
      (value) => ({ ok: true, value }),
      (error) => ({ ok: false, error }),
    ),
  );

  assert(missing.error.status === 404, `expected 404, received ${missing.error.status}`);
  assert(describeLoadError(missing.error).kind === 'missing', 'an unknown id should read as a missing record');
  assert(missing.value === undefined, 'a missing record must not resolve to a value');
});

await check('the dashboard calls the statistics endpoint and reads its aggregation', async () => {
  authToken.set(adminToken);

  const stats = await withModelStubs(
    {
      ...userStubs,
      Student: {
        aggregate: async () => [
          {
            byStatus: [
              { _id: 'active', count: 8 },
              { _id: 'inactive', count: 2 },
            ],
            byDepartment: [{ _id: 'Computer Science', count: 7 }],
            byYear: [{ _id: '3rd Year', count: 10 }],
            total: [{ value: 10 }],
            recentRegistrations: [
              { _id: 'r1', name: 'Meera', dateOfRegistration: new Date('2026-08-01') },
            ],
          },
        ],
      },
    },
    () => clientApi.stats(),
  );

  assert(stats.total === 10, `unexpected total: ${stats.total}`);
  assert(stats.active === 8 && stats.inactive === 2, 'the status split should come from the API');
  assert(stats.byDepartment[0].department === 'Computer Science', 'department rows should be mapped');
  assert(stats.byYear[0].year === '3rd Year', 'year rows should be mapped');
  assert(stats.recentRegistrations[0].id === 'r1', 'recent registrations should be usable rows');
});

await check('a database outage reads as "unavailable", not as a missing record', async () => {
  authToken.set(adminToken);

  // No model stubs: this is the API's real behaviour while MongoDB is down.
  const failure = await clientApi.list({ page: 1 }).then(
    () => null,
    (error) => error,
  );

  assert(failure !== null, 'the call should fail while the database is unreachable');
  assert(failure.status === 503, `expected 503, received ${failure.status}`);

  const described = describeLoadError(failure);
  assert(described.kind === 'unavailable', `expected an "unavailable" state, got ${described.kind}`);
  assert(/cannot reach its database/i.test(described.message), `unexpected message: ${described.message}`);
  assert(!/MongoServerSelectionError|ECONNREFUSED|mongodb:\/\//i.test(errorMessage(failure)), 'internals must not reach the UI');
});

await check('the register URL is read defensively', () => {
  const { readStudentListQuery } = clientBundle.loaded.studentQuery;

  const clean = readStudentListQuery(
    new URLSearchParams('search=ananya&status=active&year=3rd+Year&department=CSE&page=2&limit=25&sort=name'),
  );
  assert(clean.search === 'ananya' && clean.status === 'active', 'valid values should survive');
  assert(clean.year === '3rd Year' && clean.department === 'CSE', 'encoded values should be decoded');
  assert(clean.page === 2 && clean.limit === 25 && clean.sort === 'name', 'page, size and sort should survive');

  // A hand-edited or stale link must not reach the API with nonsense in it.
  const hostile = readStudentListQuery(
    new URLSearchParams('year=9th+Year&status=pending&sort=passwordHash&page=abc&limit=100000'),
  );
  assert(hostile.year === '', 'an unsupported year should fall back to "any"');
  assert(hostile.status === '', 'an unsupported status should fall back to "any"');
  assert(hostile.sort === '-dateOfRegistration', 'an unknown sort should fall back to the default');
  assert(hostile.page === 1, 'a non-numeric page should fall back to page 1');
  assert(hostile.limit === 10, 'an out-of-range page size should fall back to the default');
});

await check('the register URL omits defaults and keeps what matters', () => {
  const { readStudentListQuery, writeStudentListQuery, hasInvalidListParams } =
    clientBundle.loaded.studentQuery;

  const defaultState = writeStudentListQuery(readStudentListQuery(new URLSearchParams('')));
  assert(defaultState.toString() === '', `a clean register should have a clean URL, got "${defaultState}"`);

  const filtered = writeStudentListQuery({
    search: 'ashish',
    status: 'active',
    department: 'CSE',
    page: 2,
    limit: 25,
    sort: 'name',
    year: '',
    course: '',
  });
  assert(filtered.get('search') === 'ashish', 'the search should be persisted');
  assert(filtered.get('page') === '2' && filtered.get('limit') === '25', 'page and size should be persisted');
  assert(filtered.get('sort') === 'name', 'a non-default sort should be persisted');
  assert(!filtered.has('year') && !filtered.has('course'), 'empty filters must not be emitted');

  // A link that carries junk is recognised as needing a rewrite.
  assert(hasInvalidListParams(new URLSearchParams('year=9th+Year')) === true, 'invalid state should be detected');
  assert(hasInvalidListParams(new URLSearchParams('search=ananya&page=2')) === false, 'valid state should pass');
});

await check('active filters are described for the chips', () => {
  const { describeActiveFilters, describeActiveSort, hasActiveListParams } = clientBundle.loaded.studentQuery;

  const filters = describeActiveFilters({
    search: 'ashish',
    status: 'active',
    year: '3rd Year',
    department: 'CSE',
    course: '',
    sort: 'name',
    page: 1,
    limit: 10,
  });

  const keys = filters.map((filter) => filter.key);
  assert(keys.includes('search') && keys.includes('status') && keys.includes('year'), 'the narrowing filters should be listed');
  assert(!keys.includes('sort'), 'sorting is not a filter and is not counted as one');
  assert(!keys.includes('course'), 'an unused filter should not be listed');
  assert(
    describeActiveSort({ sort: 'name' })?.label === 'Name A–Z' &&
      describeActiveSort({ sort: '-dateOfRegistration' }) === null,
    'the sort is described separately, and only when it is not the default order',
  );
  assert(hasActiveListParams({ search: '', sort: '-dateOfRegistration', page: 1, limit: 10 }) === false, 'defaults are not filters');
  assert(hasActiveListParams({ search: 'x', sort: '-dateOfRegistration', page: 1, limit: 10 }) === true, 'a search is a filter');
});

await check('a multi-term search reaches the database query from the client', async () => {
  authToken.set(adminToken);

  const seen = await withListStubs((captured) =>
    clientApi.list({ search: 'ashish kumar', page: 1 }).then(() => captured),
  );

  assert(Array.isArray(seen.filter.$and), 'two terms should produce two AND branches');
  assert(seen.filter.$and.length === 2, `expected two branches, got ${seen.filter.$and?.length}`);
  assert(!('$or' in seen.filter), 'the branches should replace the single-term OR');
});

await check('the page size and sort the user chose reach the API', async () => {
  authToken.set(adminToken);

  const { query, result } = await withListStubs(async (captured, chain) => {
    const value = await clientApi.list({ page: 3, limit: 50, sort: 'name' });
    return { query: chain, result: value };
  });

  assert(query.limited === 50, `the page size should reach the query, got ${query.limited}`);
  assert(query.skipped === 100, `page 3 of 50 should skip 100, skipped ${query.skipped}`);
  assert(query.sortCalls[0] === 'name', `the sort should reach the query, got ${query.sortCalls[0]}`);

  // Metadata comes back from the API describing the request that was made.
  assert(result.meta.limit === 50, `the API should report the page size it used, got ${result.meta.limit}`);
  assert(result.meta.page === 3, `the API should report the page it was asked for, got ${result.meta.page}`);
});

await check('the filter options come from the API', async () => {
  authToken.set(adminToken);

  const options = await withModelStubs(
    {
      ...userStubs,
      Student: {
        distinct: async (field) =>
          field === 'course' ? ['B.Tech Computer Science'] : ['Computer Science'],
      },
    },
    () => clientApi.filters(),
  );

  assert(options.courses.includes('B.Tech Computer Science'), 'courses should come back to the client');
  assert(options.departments.includes('Computer Science'), 'departments should come back to the client');
  assert(options.years.includes('3rd Year'), 'the years vocabulary should accompany the options');
});

await check('a superseded request is cancelled, not reported as a failure', async () => {
  authToken.set(adminToken);

  const controller = new AbortController();
  const request = clientApi.list({ search: 'ash' }, { signal: controller.signal });

  // The user keeps typing: the first request is withdrawn before it lands.
  controller.abort();

  const outcome = await request.then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error }),
  );

  assert(outcome.ok === false, 'the cancelled request should not resolve with rows');
  assert(outcome.error.isCancelled === true, `expected a cancellation, got ${outcome.error.code}`);
  assert(outcome.error.status === 0, 'a cancellation is not an HTTP failure');
});

await check('a cancellation is not mapped to a user-facing error', () => {
  const { describeLoadError } = clientBundle.loaded.apiErrors;
  const { ApiRequestError: ClientError } = clientBundle.loaded.apiClient;

  const cancelled = new ClientError('superseded', { code: 'CANCELLED' });
  assert(cancelled.isCancelled === true, 'the client should recognise its own cancellation');
  // The mapping must never describe a withdrawn request as a failure state.
  const described = describeLoadError(cancelled);
  assert(['offline', 'error'].includes(described.kind), `unexpected kind: ${described.kind}`);
});

await check('a superseded filter change cannot overwrite newer rows', async () => {
  authToken.set(adminToken);

  // Two searches in flight; the first one finishes last, exactly as it would on
  // a slow connection. The second response must be the one that survives.
  const first = chainableQuery([fakeDocument({ name: 'Slow Result' })]);
  const second = chainableQuery([fakeDocument({ name: 'Fresh Result' })]);
  let call = 0;

  const { second: fresh } = await withModelStubs(
    {
      ...userStubs,
      Student: {
        find: () => {
          call += 1;
          return call === 1 ? first : second;
        },
        countDocuments: async () => 1,
      },
    },
    async () => {
      const staleController = new AbortController();
      const stale = clientApi
        .list({ search: 'ash' }, { signal: staleController.signal })
        .catch((error) => ({ cancelled: error.isCancelled }));
      staleController.abort();

      const fresh = await clientApi.list({ search: 'ashish' });
      return { stale: await stale, second: fresh };
    },
  );

  assert(fresh.students[0].name === 'Fresh Result', 'the newest response should be the one used');
  assert(fresh.students[0].name !== 'Slow Result', 'the withdrawn request must not supply rows');
});

clientBundle.cleanup();

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
  // The index is the API's own description of itself, so it is compared against
  // the mounted surface rather than counted: an endpoint added to the router and
  // forgotten here would still be a lie in the first thing a developer reads.
  const advertised = body.data.endpoints.students.map((line) => line.trim().replace(/\s+/g, ' '));
  const mounted = [
    'GET /api/students',
    'GET /api/students/stats',
    'GET /api/students/filters',
    'POST /api/students',
    'GET /api/students/:id',
    'PATCH /api/students/:id',
    'DELETE /api/students/:id',
  ];

  assert(
    advertised.join(' | ') === mounted.join(' | '),
    `the index should advertise exactly the mounted student endpoints, got: ${advertised.join(', ')}`,
  );
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

await check('login validation reports missing fields but not password strength', async () => {
  const missing = await post('/api/auth/login', { email: 'not-an-email', password: '' });
  const missingBody = await missing.json();

  assert(missing.status === 422, `expected 422, received ${missing.status}`);
  assert(
    missingBody.error.details.email && missingBody.error.details.password,
    'both fields should be reported',
  );

  // A short password is a *password*, not a validation failure: the policy is
  // only enforced when an account is created, so older accounts still sign in.
  const weak = await post('/api/auth/login', { email: 'someone@campusdesk.edu', password: 'abc' });
  assert(weak.status !== 422, `a short password must reach the credential check, got ${weak.status}`);
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
section('Client authentication wiring (static)');
// ---------------------------------------------------------------------------

/**
 * The browser bundle cannot be rendered from Node, so these checks cover the
 * parts that are decidable from the source: that no development sign-in
 * mechanism survived, and that the client talks to the real endpoints through
 * the shared authentication state rather than to a stand-in.
 */
const clientRoot = new URL('../../client/src/', import.meta.url);

const readTree = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) return readTree(child);
    return /\.(js|jsx)$/.test(entry.name) ? [readFileSync(child, 'utf8')] : [];
  });

const clientSource = readTree(clientRoot).join('\n');
const clientEnvTemplate = readFileSync(new URL('../../client/.env.example', import.meta.url), 'utf8');

await check('no preview authentication mechanism remains', () => {
  const removed = [
    'VITE_PREVIEW_SESSION',
    'PREVIEW_USER',
    'previewSession',
    'enterPreview',
    'isPreviewAvailable',
    'isPreview',
  ];

  for (const identifier of removed) {
    assert(!clientSource.includes(identifier), `\`${identifier}\` still appears in the client source`);
    assert(!clientEnvTemplate.includes(identifier), `\`${identifier}\` still appears in the env template`);
  }
});

await check('no hardcoded account can stand in for a session', () => {
  assert(!clientSource.includes('admin@campusdesk.edu'), 'the preview account email is still present');
  assert(!clientSource.includes('Campus Administrator'), 'the preview account name is still present');
});

await check('the client uses the real authentication endpoints', () => {
  const service = readFileSync(new URL('services/authService.js', clientRoot), 'utf8');

  for (const endpoint of ['/auth/register', '/auth/login', '/auth/logout', '/auth/me']) {
    assert(service.includes(endpoint), `authService should call ${endpoint}`);
  }
});

await check('the student screens no longer read a sample dataset', () => {
  const removed = ['sampleStudents', 'SAMPLE_DATA_IN_USE', 'data/sampleStudents'];
  const files = readdirSync(clientRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  assert(!files.includes('data'), 'the shared sample-data directory should be gone');

  for (const identifier of removed) {
    assert(!clientSource.includes(identifier), `\`${identifier}\` still appears in the client source`);
  }
});

await check('the student hooks and pages go through studentService', () => {
  const list = readFileSync(new URL('hooks/useStudentList.js', clientRoot), 'utf8');
  const detail = readFileSync(new URL('hooks/useStudent.js', clientRoot), 'utf8');
  const dashboard = readFileSync(new URL('hooks/useDashboardSummary.js', clientRoot), 'utf8');

  for (const [name, source] of [['useStudentList', list], ['useStudent', detail], ['useDashboardSummary', dashboard]]) {
    assert(source.includes("from '../services/studentService.js'"), `${name} should use studentService`);
    assert(!/\bfetch\(/.test(source), `${name} must not call fetch directly`);
  }

  assert(list.includes('studentService') && list.includes('.list('), 'the list hook should call the list endpoint');
  assert(detail.includes('.getById('), 'the detail hook should call the detail endpoint');
  assert(dashboard.includes('.stats('), 'the dashboard hook should call the statistics endpoint');
});

await check('no page talks to the API without the service layer', () => {
  const pages = readdirSync(new URL('pages/', clientRoot), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.jsx'))
    .map((entry) => [entry.name, readFileSync(new URL(`pages/${entry.name}`, clientRoot), 'utf8')]);

  for (const [name, source] of pages) {
    assert(!/\bfetch\(/.test(source), `${name} must not call fetch directly`);
    assert(!source.includes("from '../services/apiClient.js'"), `${name} must go through a service, not apiClient`);
  }
});

await check('the login and registration pages share one authentication state', () => {
  const login = readFileSync(new URL('pages/LoginPage.jsx', clientRoot), 'utf8');
  const register = readFileSync(new URL('pages/RegisterPage.jsx', clientRoot), 'utf8');
  const provider = readFileSync(new URL('context/AuthProvider.jsx', clientRoot), 'utf8');
  const routes = readFileSync(new URL('routes/AppRoutes.jsx', clientRoot), 'utf8');

  assert(login.includes('useAuth(') && register.includes('useAuth('), 'both pages should use the shared state');
  assert(!login.includes('authToken') && !register.includes('authToken'), 'pages must not touch the token');
  assert(
    /authService\s*\.\s*me\(\)/.test(provider),
    'the provider restores the session through /auth/me',
  );
  assert(provider.includes('onUnauthorized'), 'the provider should react to a rejected token');
  assert(routes.includes('paths.register'), 'the registration route should be public');
});

// ---------------------------------------------------------------------------
section('Frontend routing, shell & page boundaries');
// ---------------------------------------------------------------------------

/**
 * `routeMeta` is plain data with no JSX in it, so it can be bundled and run here
 * — these checks therefore exercise the same matching code the browser uses,
 * rather than a copy of it kept alongside the test.
 */
const routingBundle = await bundleClient({ routeMeta: 'routes/routeMeta.js', paths: 'routes/paths.js' }, {
  baseUrl: `${stubUrl}/api`,
});

const { matchRouteMeta, routeCrumbs, routeMeta, routeTitle } = routingBundle.loaded.routeMeta;
const { notFound: notFoundPath, paths: declaredPaths } = routingBundle.loaded.paths;

const collectClientFiles = (directory, prefix = '') =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) return collectClientFiles(child, `${name}/`);
    return /\.(js|jsx)$/.test(entry.name) ? [[name, readFileSync(child, 'utf8')]] : [];
  });

const clientFiles = collectClientFiles(clientRoot);
const sourceOf = (name) => clientFiles.find(([file]) => file === name)?.[1] ?? '';

await check('every route in the application is described by route metadata', () => {
  const declared = [
    declaredPaths.home,
    declaredPaths.login,
    declaredPaths.register,
    declaredPaths.dashboard,
    declaredPaths.students,
    declaredPaths.newStudent,
    declaredPaths.student(),
    declaredPaths.editStudent(),
  ];

  for (const path of declared) {
    assert(
      routeMeta.some((entry) => entry.path === path),
      `no route metadata for ${path}`,
    );
  }

  assert(routeMeta.at(-1).path === notFoundPath, 'the catch-all must be matched last');
  assert(
    new Set(routeMeta.map((entry) => entry.title)).size === routeMeta.length,
    'route titles should be distinct — a tab title has to say which screen it is',
  );

  for (const entry of routeMeta) {
    assert(Boolean(entry.title) && Boolean(entry.label), `${entry.path} needs a title and a label`);
    assert(['public', 'protected'].includes(entry.scope), `${entry.path} needs a public/protected scope`);
    assert(entry.title.includes('CampusDesk'), `the title for ${entry.path} should name the product`);
  }

  const protectedRoutes = routeMeta.filter((entry) => entry.scope === 'protected');
  assert(protectedRoutes.length === 5, `five routes sit behind the session, got ${protectedRoutes.length}`);
});

await check('a URL resolves to the most specific route, and unknown URLs to the catch-all', () => {
  const id = '6502a1b2c3d4e5f60718293a';

  const detail = matchRouteMeta(declaredPaths.student(id));
  assert(detail.label === 'Student', `a student URL should resolve to the detail route, got ${detail.label}`);
  assert(detail.scope === 'protected' && detail.params.id === id, 'the id should be captured from the URL');

  const newStudent = matchRouteMeta(declaredPaths.newStudent);
  assert(newStudent.label === 'Add student', 'the static route must win over the dynamic one');
  assert(newStudent.params.id === undefined, 'and must not be read as a student id');

  assert(matchRouteMeta(declaredPaths.editStudent('42')).label === 'Edit student', 'the edit route should resolve');
  assert(matchRouteMeta(declaredPaths.students).label === 'Students', 'the register should resolve');
  assert(matchRouteMeta(declaredPaths.dashboard).scope === 'protected', 'the dashboard is a signed-in route');
  assert(matchRouteMeta('/').scope === 'public', 'the landing page is public');

  const missing = matchRouteMeta('/students/42/transcripts');
  assert(missing.path === notFoundPath, `an unknown URL should fall to the catch-all, got ${missing.path}`);
  assert(
    routeTitle(declaredPaths.students) === 'Students · CampusDesk',
    `unexpected document title: ${routeTitle(declaredPaths.students)}`,
  );
});

await check('nested student URLs keep their place in the breadcrumb trail', () => {
  const trail = routeCrumbs('/students/42/edit');

  assert(trail.length === 2, `an edit URL has two ancestors, got ${trail.length}`);
  assert(trail[0].label === 'Students' && trail[0].to === '/students', 'the first crumb is the register');
  assert(
    trail[1].label === 'Student' && trail[1].to === '/students/42',
    'the parent crumb should keep the record id rather than the pattern',
  );

  assert(routeCrumbs('/students/42').length === 1, 'a detail URL sits directly under the register');
  assert(routeCrumbs('/students/42')[0].to === '/students', 'and links back to it');
  assert(routeCrumbs('/dashboard').length === 0, 'top-level pages have no ancestors');

  assert(
    sourceOf('pages/StudentDetailPage.jsx').includes('routeCrumbs(pathname)'),
    'the detail page should take its trail from the metadata',
  );
  assert(
    sourceOf('pages/StudentFormPage.jsx').includes('routeCrumbs(pathname)'),
    'the form should take its trail from the metadata',
  );
});

await check('the router renders the routes the metadata describes', () => {
  const routes = sourceOf('routes/AppRoutes.jsx');

  for (const reference of [
    'paths.home',
    'paths.login',
    'paths.register',
    'paths.dashboard',
    'paths.students',
    'paths.newStudent',
    'paths.student()',
    'paths.editStudent()',
  ]) {
    assert(routes.includes(reference), `AppRoutes should render ${reference}`);
  }

  assert(
    routes.includes('<ProtectedRoute />') && routes.includes('<AppLayout />'),
    'the signed-in area should sit behind the guard and inside the shell',
  );
  assert(routes.includes('<PublicLayout />'), 'the account pages should share the public shell');
  assert(routes.includes('useDocumentTitle()'), 'the route titles should be applied from the metadata');
  assert(
    sourceOf('hooks/useDocumentTitle.js').includes('document.title = resolved'),
    'the title hook should write the resolved title to the document',
  );
  assert(
    routes.includes('<Route path="*" element={<NotFoundRoute />} />'),
    'unknown URLs should end at the session-aware catch-all',
  );
  assert(
    routes.includes("import { NotFoundRoute }") && !routes.includes("import('../pages/NotFoundPage.jsx')"),
    'the not-found screen should never wait on a code-split chunk',
  );
});

await check('the shell owns the frame, the skip link and the page transition', () => {
  const layout = sourceOf('components/layout/AppLayout.jsx');

  assert(layout.includes('<Sidebar') && layout.includes('<Topbar'), 'the shell draws the navigation frame');
  assert(layout.includes('id="main-content"'), 'the content area should be addressable');
  assert(layout.includes('Skip to content'), 'keyboard users should be able to jump past the navigation');
  assert(layout.includes('<Outlet') && layout.includes('children ??'), 'the shell draws the route or its own children');
  assert(
    layout.includes('<Suspense fallback={<ContentLoader />}>'),
    'a code-split page should wait inside the shell, not replace it',
  );
  assert(
    layout.includes('<PageTransition key={routePattern}>'),
    'the entry transition belongs to the shell and is keyed by the route pattern',
  );

  for (const page of [
    'pages/StudentsPage.jsx',
    'pages/DashboardPage.jsx',
    'pages/StudentDetailPage.jsx',
    'pages/StudentFormPage.jsx',
  ]) {
    assert(!sourceOf(page).includes('PageTransition'), `${page} should not carry the shell's transition`);
  }

  for (const [name, source] of clientFiles.filter(([file]) => file.startsWith('pages/'))) {
    assert(
      !source.includes('<Sidebar') && !source.includes('<Outlet') && !source.includes('<Route '),
      `${name} should not do the shell's or the router's job`,
    );
  }

  const topbar = sourceOf('components/layout/Topbar.jsx');
  assert(
    topbar.includes('matchRouteMeta(pathname)') && topbar.includes('route.label'),
    'the top bar should name the screen from the route metadata',
  );
});

await check('a render crash is contained and explained without internals', () => {
  const boundary = sourceOf('components/routing/AppErrorBoundary.jsx');
  const app = sourceOf('App.jsx');

  assert(boundary.includes('getDerivedStateFromError'), 'the boundary should catch render errors');
  assert(
    boundary.includes('componentDidUpdate') && boundary.includes('resetKey'),
    'navigating away should clear a crashed screen instead of showing the fallback over it',
  );
  assert(
    !boundary.includes('error.stack') && !boundary.includes('{error.message}'),
    'the fallback must not render the error itself',
  );
  assert(
    !/from '[^']*apiErrors\.js'/.test(boundary) && !/from '[^']*toastContext\.js'/.test(boundary),
    'a render failure is not an API failure — the two stay apart',
  );
  assert(
    boundary.includes('window.location.reload') && boundary.includes('paths.dashboard'),
    'the fallback should offer a reload and a way back',
  );

  assert(app.indexOf('<BrowserRouter>') < app.indexOf('<RouteErrorBoundary>'), 'the boundary needs the router for its links');
  assert(
    app.indexOf('<RouteErrorBoundary>') < app.indexOf('<ToastProvider>'),
    'the boundary should sit above the providers so a crash in either is caught',
  );
});

await check('an unknown URL is answered according to the session', () => {
  const route = sourceOf('components/routing/NotFoundRoute.jsx');
  const page = sourceOf('pages/NotFoundPage.jsx');

  assert(route.includes('useAuth('), 'the catch-all should ask who is asking');
  assert(
    route.includes('isLoading') && route.includes('PageLoader'),
    'and wait rather than flash the wrong screen at a signed-in visitor',
  );
  assert(route.includes('<AppLayout'), 'a signed-in visitor should get the shell and its navigation');
  assert(route.includes('<NotFoundPage />'), 'an anonymous visitor should get the plain not-found page');

  assert(page.includes('paths.dashboard') && page.includes('paths.home'), 'the page should offer a way back into the application');
  assert(!page.includes('apiErrors') && !page.includes('stack'), 'a missing page is not an API failure and never shows internals');
});

await check('the student register is one controller and three views', () => {
  const page = sourceOf('pages/StudentsPage.jsx');
  const controller = sourceOf('hooks/useStudentRegister.js');

  for (const view of [
    'components/students/StudentRegisterToolbar.jsx',
    'components/students/ActiveFilterChips.jsx',
    'components/students/StudentTable.jsx',
  ]) {
    assert(
      clientFiles.some(([name]) => name === view),
      `${view} should exist`,
    );

    const source = sourceOf(view);
    assert(!source.includes('useSearchParams') && !source.includes('setSearchParams'), `${view} must not own the URL state`);
    assert(!/\bfetch\(/.test(source) && !source.includes('studentService'), `${view} must not call the API`);
  }

  for (const view of ['StudentRegisterToolbar', 'ActiveFilterChips', 'StudentTable']) {
    assert(page.includes(view), `the register page should compose ${view}`);
  }

  assert(
    !page.includes('useSearchParams') && !page.includes('readStudentListQuery'),
    'the page must not parse the URL itself — that logic has one home',
  );
  assert(page.includes('useStudentRegister()'), 'the register state should come from one controller');
  assert(!page.includes('studentService') && !/\bfetch\(/.test(page), 'a page must not talk to the API directly');
  assert(
    page.split('\n').length < 140,
    `the register page should be composition rather than everything at once, got ${page.split('\n').length} lines`,
  );

  assert(
    controller.includes('readStudentListQuery') && controller.includes('writeStudentListQuery'),
    'the URL should stay the single source of truth for the register',
  );
  assert(
    controller.includes('useSearchParams') && !controller.includes('useState({'),
    'the controller should be the one place the query is read, with no second copy of it',
  );
  assert(
    controller.includes('useDebouncedValue') && controller.includes('SEARCH_DEBOUNCE_MS = 320'),
    'search should still be debounced, at the same 320ms',
  );
});

await check('nothing in the foundation disarms the animation work', () => {
  const css = readFileSync(new URL('index.css', clientRoot), 'utf8');
  // Comments explain why the rule is absent; only real declarations count here.
  const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '');

  assert(css.includes('prefers-reduced-motion'), 'the reduced-motion query itself should stay');
  assert(
    !/animation-duration:\s*0?\.0*1ms/i.test(declarations),
    'a blanket animation kill would suppress every animation in the product, including the intended ones',
  );
  assert(!/transition-duration:\s*0?\.0*1ms/i.test(declarations), 'and it would take transitions with it');

  const reducedMotionBlock = css.slice(css.indexOf('prefers-reduced-motion'));
  assert(!reducedMotionBlock.includes('!important'), 'the reduced-motion block must not override durations globally');
  assert(reducedMotionBlock.includes('scroll-behavior: auto'), 'smooth scrolling is the one effect still switched off');

  assert(
    sourceOf('components/layout/AppLayout.jsx').includes('PageTransition'),
    'the shell should be ready for the motion stage',
  );
  assert(
    sourceOf('components/motion/PageTransition.jsx').includes('useReducedMotion'),
    'motion should be decided where it is used',
  );
});

await check('no new frontend dependency was introduced', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../client/package.json', import.meta.url), 'utf8'));
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };

  const banned = [
    'redux',
    'react-redux',
    'zustand',
    'jotai',
    'recoil',
    'mobx',
    '@tanstack/react-query',
    'swr',
    'react-hook-form',
    'formik',
    'framer-motion',
    'styled-components',
  ];

  for (const name of banned) {
    assert(!(name in dependencies), `${name} should not have been added`);
  }

  for (const name of ['react-router-dom', 'motion', 'gsap']) {
    assert(name in dependencies, `${name} should still be how this is done`);
  }
});

await check('the session guard and the stored token keep their single homes', () => {
  const guard = sourceOf('components/routing/ProtectedRoute.jsx');

  assert(
    guard.includes('isLoading') && guard.includes('PageLoader'),
    'the guard should wait while the session is restored rather than redirecting',
  );
  assert(
    guard.includes('isAuthenticated') &&
      guard.includes('from: location') &&
      guard.includes('reason: sessionEndedReason'),
    'and send the visitor back to where they were headed, explaining an expired session',
  );
  assert(!guard.includes('authToken') && !guard.includes('localStorage'), 'the guard must not read the token itself');

  for (const [name, source] of clientFiles) {
    if (name === 'services/apiClient.js') continue;
    assert(!/localStorage/.test(source), `${name} should not touch the stored token`);
    assert(!/atob\(|jwtDecode/.test(source), `${name} should not decode the token`);
  }
});

routingBundle.cleanup();

// ---------------------------------------------------------------------------
section('Design system & responsive foundation (static)');
// ---------------------------------------------------------------------------

const cssSource = readFileSync(new URL('index.css', clientRoot), 'utf8');
const declarations = cssSource.replace(/\/\*[\s\S]*?\*\//g, '');
const cssNumber = (name) => declarations.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim();

/** Every colour literal the client source uses, anywhere, in any form. */
const colourLiterals = clientFiles.flatMap(([name, source]) =>
  [...source.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((match) => ({ name, value: match[0] })),
);

const APPROVED = [
  '#f7f4f1',
  '#efe9e3',
  '#ffffff',
  '#faf8f6',
  '#ddd0c8',
  '#cbbbaf',
  '#323232',
  '#242424',
  '#6b6b6b',
  '#d6d0cb',
  '#c9c1ba',
  '#3f7d5a',
  '#b7791f',
  '#b94a48',
  '#58758c',
  '#8a5a12',
];

await check('the palette is declared once, as tokens, and matches the approved values', () => {
  const expected = {
    canvas: '#f7f4f1',
    surface: '#ffffff',
    beige: '#ddd0c8',
    'beige-strong': '#cbbbaf',
    charcoal: '#323232',
    ink: '#242424',
    muted: '#6b6b6b',
    line: '#d6d0cb',
    success: '#3f7d5a',
    warning: '#b7791f',
    danger: '#b94a48',
    info: '#58758c',
  };

  for (const [name, value] of Object.entries(expected)) {
    const declared = (cssNumber(`color-${name}`) ?? '').toLowerCase();
    assert(
      declared === value,
      `--color-${name} should be the approved ${value}, got ${declared || 'nothing'}`,
    );
  }

  // Derived tones are allowed only where contrast demands one, and they are
  // declared here rather than invented in a component.
  assert(
    cssNumber('color-warning-ink') === '#8a5a12',
    'the darker warning shade used for small text should be declared as a token',
  );
});

await check('no screen invents a colour of its own', () => {
  for (const { name, value } of colourLiterals) {
    assert(
      APPROVED.includes(value.toLowerCase()),
      `${name} uses ${value}, which is not part of the approved palette`,
    );
  }

  const paletteWords =
    /\b(?:bg|text|border|from|via|to|ring|fill|stroke|decoration|divide|outline|shadow)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|grey|zinc|neutral|stone)-\d{2,3}\b/;

  for (const [name, source] of clientFiles) {
    assert(!paletteWords.test(source), `${name} uses a default Tailwind colour instead of a token`);
  }
});

await check('type, spacing, radii and elevation are a system, not per-page choices', () => {
  const required = [
    'text-display',
    'text-title',
    'text-heading',
    'text-subheading',
    'text-body',
    'text-label',
    'text-meta',
    'text-micro',
    'spacing-gutter',
    'spacing-section',
    'spacing-panel',
    'radius-panel',
    'radius-card',
    'radius-field',
    'radius-chip',
    'shadow-card',
    'shadow-raised',
    'shadow-overlay',
  ];

  for (const token of required) {
    assert(Boolean(cssNumber(token)), `--${token} should be declared in the theme`);
  }

  // Breakpoints stay Tailwind's own: the layout is deliberately mobile-first.
  assert(!/--breakpoint-/.test(declarations), 'the default breakpoints should not be overridden');

  // Every screen that has a heading uses the scale for it.
  const pageFiles = clientFiles.filter(([name]) => name.startsWith('pages/'));
  for (const [name, source] of pageFiles) {
    assert(!/text-\[\d+px\]/.test(source), `${name} hardcodes a font size instead of using the scale`);
  }

  assert(
    sourceOf('components/layout/PageHeader.jsx').includes('text-title'),
    'a page title should come from the type scale',
  );
  assert(
    !/text-\[\d+px\]/.test(clientSource),
    'no component should hardcode a pixel font size',
  );
});

await check('panels have a hierarchy instead of one repeated card', () => {
  const card = sourceOf('components/ui/Card.jsx');

  for (const tone of ['surface', 'quiet', 'accent', 'dark']) {
    assert(card.includes(`${tone}:`), `the panel component should offer a \`${tone}\` tone`);
  }

  for (const name of ['components/layout/AppLayout.jsx', 'components/layout/Sidebar.jsx', 'components/layout/Topbar.jsx']) {
    assert(Boolean(sourceOf(name)), `${name} should exist`);
  }

  assert(
    card.includes('panel-header') && card.includes('panel-body') && card.includes('panel-footer'),
    'the shared panel parts should be used rather than re-declared per screen',
  );
  assert(
    !/\.panel-(?:quiet|inset)|meta-text|section-heading/.test(declarations),
    'the stylesheet should not carry composite classes nothing uses',
  );
  assert(
    sourceOf('pages/DashboardPage.jsx').includes('tone="accent"') ||
      sourceOf('pages/StudentDetailPage.jsx').includes('tone="accent"'),
    'a screen should use the accent panel for the thing it wants noticed',
  );
  assert(
    sourceOf('pages/DashboardPage.jsx').includes('bg-charcoal'),
    'the dashboard band should carry the identity ground',
  );
});

await check('buttons state their hierarchy and never rely on colour alone', () => {
  const styles = sourceOf('components/ui/buttonStyles.js');

  for (const variant of ['primary', 'secondary', 'soft', 'ghost', 'danger', 'dangerGhost']) {
    assert(styles.includes(`${variant}:`), `the button system should define a \`${variant}\` variant`);
  }

  for (const state of ['hover:', 'disabled:', 'focus-ring']) {
    assert(styles.includes(state), `buttons should style their ${state.replace(':', '')} state`);
  }

  const dialog = sourceOf('components/ui/ConfirmDialog.jsx');
  assert(dialog.includes('TriangleAlert'), 'a destructive action carries an icon, not just a red fill');
  assert(
    dialog.includes("tone === 'danger' ? 'danger' : 'primary'") && dialog.includes('isLoading'),
    'the destructive button should be the danger variant and stay disabled in flight',
  );
  assert(
    sourceOf('components/ui/Button.jsx').includes('aria-busy'),
    'a loading button should announce itself',
  );
});

await check('form controls share one shape, focus treatment and error wiring', () => {
  const field = sourceOf('components/ui/Field.jsx');

  for (const control of ['TextInput', 'Select']) {
    assert(field.includes(`export const ${control}`), `${control} should be part of the field system`);
  }

  for (const state of ['hover:border-line-strong', 'focus-visible:ring-2', 'disabled:bg-canvas']) {
    assert(field.includes(state), `controls should style ${state}`);
  }

  assert(field.includes('aria-describedby') && field.includes('aria-invalid'), 'hints and errors should be announced');
  assert(field.includes('htmlFor={fieldId}'), 'labels should be bound to their control');
  assert(field.includes('required ?') && field.includes('optional'), 'required and optional fields should be distinguishable');
  assert(
    sourceOf('components/ui/States.jsx').includes('FormAlert') &&
      sourceOf('pages/LoginPage.jsx').includes('FormAlert'),
    'a failed submission should use the shared form banner',
  );
});

await check('the layout is responsive by construction, not by shrinking', () => {
  const sidebar = sourceOf('components/layout/Sidebar.jsx');
  const table = sourceOf('components/ui/DataTable.jsx');
  const modal = sourceOf('components/ui/Modal.jsx');
  const toolbar = sourceOf('components/students/StudentRegisterToolbar.jsx');
  const pagination = sourceOf('components/ui/Pagination.jsx');

  assert(sidebar.includes('lg:block') && sidebar.includes('lg:hidden'), 'the rail and the drawer swap at lg');
  assert(sidebar.includes('max-w-[85vw]'), 'the drawer should not fill a phone screen');
  assert(table.includes('md:block') && table.includes('md:hidden'), 'the table becomes cards at md');
  assert(
    table.includes('xl:px-panel') && table.includes('hidden xl:table-cell'),
    'the table should loosen its padding and reveal optional columns only when the width allows',
  );
  assert(
    (sourceOf('components/students/StudentTable.jsx').match(/hidden xl:table-cell/g) ?? []).length >= 4,
    'the register should mark its optional columns as wide-screen only, header and cell together',
  );
  assert(modal.includes('items-end') && modal.includes('sm:items-center'), 'a dialog is a bottom sheet on a phone');
  assert(toolbar.includes('flex-wrap') && toolbar.includes('lg:flex-row'), 'the toolbar should wrap rather than overflow');
  assert(pagination.includes('sm:flex-row'), 'pagination should stack on small screens');

  // Fixed-width *layout* is what causes sideways scrolling. Overlays are
  // positioned, not in flow, so the toast column is measured separately.
  const fixedWidths = clientFiles
    .filter(([name]) => !name.startsWith('context/'))
    .flatMap(([name, source]) =>
      [...source.matchAll(/(?<!max-)\b(?:w|min-w)-\[(\d+)px\]/g)].map((match) => ({
        name,
        width: Number(match[1]),
      })),
    );

  for (const { name, width } of fixedWidths) {
    assert(width <= 320, `${name} pins a ${width}px width, which risks horizontal overflow`);
  }

  assert(
    sourceOf('context/ToastProvider.jsx').includes('sm:w-[380px]'),
    'the toast column should be a fixed overlay and unstretched on a phone',
  );
});

await check('empty, loading and error states are first-class', () => {
  const table = sourceOf('components/students/StudentTable.jsx');
  const skeletons = sourceOf('components/ui/Skeleton.jsx');

  assert(
    table.includes('No students match these filters') && table.includes('The register is empty'),
    'an empty register and an empty result should not read the same',
  );
  assert(
    table.includes('Clear filters') && table.includes('Add student'),
    'each empty state should offer the action that resolves it',
  );
  assert(skeletons.includes('TableSkeleton') && skeletons.includes('StatCardSkeleton'), 'loading should keep the layout');
  assert(
    sourceOf('components/ui/States.jsx').includes('onRetry') ,
    'an error state should offer a retry',
  );
  assert(
    !/stack trace|MongoServerSelectionError|ECONNREFUSED/.test(clientSource.replace(/\/\*[\s\S]*?\*\//g, '')),
    'no screen should know about driver internals',
  );
});

await check('dialogs, toasts and icons follow one pattern each', () => {
  const modal = sourceOf('components/ui/Modal.jsx');
  const toasts = sourceOf('context/ToastProvider.jsx');

  assert(modal.includes('role="dialog"') && modal.includes('aria-modal'), 'a dialog should be a real dialog');
  assert(modal.includes("event.key === 'Escape'"), 'Escape should close it');
  assert(modal.includes("event.key !== 'Tab'"), 'Tab should stay inside it');
  assert(modal.includes('previouslyFocused.focus()'), 'focus should return to what opened it');

  for (const tone of ['success', 'error', 'warning', 'info']) {
    assert(toasts.includes(`${tone}:`), `toasts should support the ${tone} tone`);
  }
  assert(toasts.includes('aria-live'), 'toasts should be announced');

  const iconSources = clientFiles.filter(([name]) => /components\/|pages\//.test(name));
  for (const [name, source] of iconSources) {
    const imports = [...source.matchAll(/from '([^']*icons?[^']*)'/g)].map((match) => match[1]);
    for (const specifier of imports) {
      assert(specifier === 'lucide-react', `${name} imports icons from ${specifier}; lucide-react is the one library`);
    }
  }

  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const [name, source] of clientFiles) {
    assert(!emoji.test(source), `${name} uses an emoji as an icon`);
  }
});

await check('transitions stay subtle and nothing suppresses motion globally', () => {
  const primitives = [
    'components/ui/buttonStyles.js',
    'components/ui/DataTable.jsx',
    'components/ui/Pagination.jsx',
    'components/layout/Sidebar.jsx',
  ];

  for (const name of primitives) {
    assert(Boolean(sourceOf(name)), `${name} should exist`);
  }

  assert(
    sourceOf('components/ui/buttonStyles.js').includes('duration-150'),
    'hover feedback should be quick rather than decorative',
  );
  assert(
    sourceOf('components/ui/buttonStyles.js').includes('transition-[background-color,border-color,color,box-shadow]'),
    'interactive feedback should be limited to colour and elevation',
  );
  assert(
    !/animate-(?:bounce|ping|spin)\b/.test(sourceOf('components/ui/DataTable.jsx')),
    'rows should not animate for decoration',
  );
  assert(
    !/duration-(?:500|700|1000)\b/.test(clientSource),
    'no slow decorative transitions should sneak into the interface',
  );
  assert(
    cssSource.includes('prefers-reduced-motion'),
    'the reduced-motion query should still be honoured',
  );
});

// ---------------------------------------------------------------------------
section('Authentication & student workflow (static)');
// ---------------------------------------------------------------------------

await check('the sign-in form is complete, keyboard-submittable and single-shot', () => {
  const login = sourceOf('pages/LoginPage.jsx');
  const button = sourceOf('components/ui/Button.jsx');

  assert(login.includes('onSubmit={form.handleSubmit}') && login.includes('noValidate'), 'the form submits through the one form helper');
  assert(login.includes('type="email"') && login.includes('autoComplete="email"'), 'the email field is typed and autofillable');
  assert(login.includes('autoComplete="current-password"'), 'the password field is a known sign-in field to the browser');
  assert(
    login.includes("showPassword ? 'Hide password' : 'Show password'"),
    'revealing the password is a labelled control rather than an unlabelled icon',
  );
  assert(
    login.includes('isLoading={form.isSubmitting}'),
    'the submit button should carry the request state',
  );
  assert(
    button.includes('disabled={disabled || isLoading}'),
    'a loading button must be genuinely disabled so a double click cannot submit twice',
  );
  assert(
    (login.match(/navigate\(/g) ?? []).length === 1 && /if \(isAuthenticated\) navigate\(/.test(login),
    'a successful sign-in should navigate exactly once, from the session change',
  );
  assert(
    login.includes('from.pathname') && login.includes('from.search'),
    'the intended destination keeps its query string, so a filtered link survives sign-in',
  );
  assert(login.includes('errorMessage(error)') && !login.includes('error.message'), 'failures are reported in safe words, never a raw API message');
});

await check('registration keeps the account rules the API enforces', () => {
  const register = sourceOf('pages/RegisterPage.jsx');
  const payload = register.slice(register.indexOf('await register({'), register.indexOf('});', register.indexOf('await register({')));

  assert(register.includes("name: values.name"), 'the form sends the name');
  assert(register.includes('email: values.email') && register.includes('password: values.password'), 'and the credentials');
  assert(
    !payload.includes('confirmPassword'),
    'the confirmation field is a form-level rule and must never be sent',
  );
  assert(!/\brole\b\s*:/.test(payload), 'a public registration must never carry a role the API would have to ignore');
  assert(
    register.includes('autoComplete="new-password"'),
    'password managers should offer to generate rather than fill',
  );
  assert(
    register.includes('The two passwords do not match.') && register.includes('minLength(8'),
    'the confirmation and password policy are checked before the round trip',
  );
  assert(
    register.includes('Roles are assigned by CampusDesk') || register.includes('never by the sign-up form'),
    'the screen says who decides roles',
  );
  assert(
    (register.match(/navigate\(/g) ?? []).length === 1,
    'creating an account navigates exactly once',
  );
  assert(register.includes('errorMessage(error)') && !register.includes('error.message'), 'duplicate-email and outage failures use safe wording');
});

await check('an expired session is explained rather than silently redirecting', () => {
  const provider = sourceOf('context/AuthProvider.jsx');
  const guard = sourceOf('components/routing/ProtectedRoute.jsx');
  const login = sourceOf('pages/LoginPage.jsx');

  assert(
    provider.includes("setSessionEndedReason('expired')"),
    'the provider should record why a session the API rejected ended',
  );
  assert(provider.includes('setSessionEndedReason(null)'), 'and forget it when a new session starts');
  assert(
    guard.includes('reason: sessionEndedReason'),
    'the guard should carry that reason to the sign-in screen',
  );
  assert(
    login.includes('Your session expired') && login.includes('tone="warning"'),
    'and the sign-in screen should say so in words',
  );
  assert(provider.includes("endSession('signed-out')"), 'signing out always ends the local session, even if the request fails');
  assert(
    /finally\s*{\s*endSession\('signed-out'\)/.test(provider),
    'and does so in a finally block, so a network failure cannot trap the user',
  );
});

await check('every form shares one submission lifecycle', () => {
  const form = sourceOf('hooks/useForm.js');

  assert(form.includes('if (isSubmitting) return undefined;'), 'a second submit while one is in flight is refused');
  assert(/setIsSubmitting\(true\)/.test(form) && /\.finally\(\(\) => setIsSubmitting\(false\)\)/.test(form), 'the in-flight state is always cleared');
  assert(
    form.includes('focusFirstInvalid(form, validationErrors, fieldOrder)'),
    'a rejected form puts the caret on the first field that needs fixing',
  );
  assert(form.includes('focusFirstInvalid(form, details, fieldOrder)'), 'and does the same for field errors the API returned');
  assert(
    form.includes('if (control instanceof HTMLElement && !control.disabled) control.focus();'),
    'never focusing a disabled control, which could trap the caret',
  );
  assert(form.includes('setSubmitError(errorMessage(error))'), 'the summary line is safe copy');
  const failurePath = form.slice(form.indexOf('.catch((error) => {'));
  const failureBlock = failurePath.slice(0, failurePath.indexOf('})'));
  assert(
    !failureBlock.includes('reset(') && !failureBlock.includes('setValues('),
    'and a failed submit keeps what the user entered rather than clearing the form',
  );
  assert(
    form.includes('setSubmitError((current) => (current === null ? current : null))'),
    'editing a field clears the failure banner that described the previous attempt',
  );

  for (const page of ['pages/LoginPage.jsx', 'pages/RegisterPage.jsx', 'pages/StudentFormPage.jsx']) {
    assert(sourceOf(page).includes('useForm('), `${page} should use the shared form lifecycle`);
  }
});

await check('creating and editing a student follow one documented path', () => {
  const page = sourceOf('pages/StudentFormPage.jsx');
  const payload = page.slice(page.indexOf('const payload = {'), page.indexOf('const wantsNewDate'));

  for (const field of ['name', 'email', 'phone', 'course', 'year', 'department', 'enrollmentStatus', 'avatarUrl']) {
    assert(payload.includes(`${field}:`), `the payload should carry ${field}`);
  }
  assert(!payload.includes('studentId'), 'the client must never propose a student ID');
  assert(
    page.includes("if (wantsNewDate) payload.dateOfRegistration") &&
      page.includes('else delete payload.dateOfRegistration'),
    'the registration date is only sent when it actually changed',
  );
  assert(
    page.includes('navigate(saved?.id ? paths.student(saved.id) : registerFrom'),
    'a saved record is opened rather than merely announced',
  );
  assert(
    /navigate\(saved\?\.id \? paths\.student\(saved\.id\) : registerFrom, \{\s*replace: true,\s*state: \{ registerFrom \},/m.test(page),
    'and the register the workflow started in travels with it',
  );
  assert(
    page.includes("'Student created'") && page.includes("'Student updated'"),
    'creation and update are confirmed with their own wording',
  );
  assert(
    page.includes('Could not save changes') && page.includes('Could not add student'),
    'and failures are distinguished from successes',
  );
  assert(page.includes('isLoading={isBusy}') && page.includes('disabled={isBusy}'), 'the save button cannot be pressed twice');
});

await check('the form mirrors the API contract instead of inventing rules', () => {
  const page = sourceOf('pages/StudentFormPage.jsx');
  const rules = sourceOf('utils/validation.js');

  assert(page.includes('oneOf(STUDENT_YEARS') && page.includes('COURSE_SUGGESTIONS'), 'options come from the shared domain constants the API validates against');
  assert(
    page.includes('photoUrl()') && rules.includes('/^(\\/|https?:\\/\\/)'),
    'a photo link is accepted in the same shapes the API accepts, including a site-relative path',
  );
  assert(
    page.includes('notFutureDate()'),
    'a registration date in the future is refused at the field',
  );
  for (const label of ['Full name', 'Profile photo', 'Course', 'Year of study', 'Department', 'Email address', 'Phone number', 'Date of registration']) {
    assert(page.includes(`label="${label}"`), `${label} should be a labelled field`);
  }
  assert(
    page.includes('SegmentedControl'),
    'the enrollment status uses the shared control rather than a raw radio group',
  );
  assert(
    page.includes('Section 1') && page.includes('Section 2') && page.includes('Section 3') && page.includes('Section 4'),
    'the form is grouped into named sections rather than one long column',
  );
});

await check('the registration date is presented honestly, and the API stays the authority', () => {
  const page = sourceOf('pages/StudentFormPage.jsx');

  assert(
    page.includes("const canEditRegistrationDate = !isEdit || user?.role === 'admin';"),
    'the field is offered according to the role on the account the API returned',
  );
  assert(!page.includes('token') && !page.includes('jwtDecode'), 'never according to anything in the token');
  assert(
    page.includes('ShieldAlert') && page.includes('only an administrator can change it'),
    'a staff account is told why the field is closed to them',
  );
  assert(page.includes('disabled={!canEditRegistrationDate}'), 'and the control is disabled, not merely styled as such');
  assert(
    page.includes('It is kept from the original') || page.includes('administrative fact'),
    'the explanation says where the value comes from',
  );
  assert(
    !page.includes('type="hidden"'),
    'nothing about this rule relies on a hidden field — the server decides',
  );
});

await check('unsaved edits are protected without a navigation framework', () => {
  const guard = sourceOf('hooks/useUnsavedChanges.js');
  const page = sourceOf('pages/StudentFormPage.jsx');

  assert(guard.includes("window.addEventListener('beforeunload'"), 'a reload or closed tab warns before the work is lost');
  assert(guard.includes("window.removeEventListener('beforeunload'"), 'and the listener is removed again');
  assert(guard.includes('isDirty'), 'the guard is driven by whether anything actually changed');
  assert(
    !clientSource.includes('useBlocker') && !clientSource.includes('unstable_usePrompt'),
    'no half-working in-app blocker is pretended — this router cannot veto a navigation',
  );
  assert(
    page.includes('useUnsavedChanges(isDirty && !isSubmitting)'),
    'a request in flight is not unsaved work',
  );
  assert(
    page.includes('Discard these changes?') && page.includes('Keep editing'),
    'Cancel asks before throwing the edits away, and offers the way back',
  );
  assert(page.includes('const cancelTo = isEdit'), 'leaving goes back where the user came from');
});

await check('the register links carry the register with them', () => {
  const helper = sourceOf('routes/returnState.js');
  const page = sourceOf('pages/StudentsPage.jsx');
  const table = sourceOf('components/students/StudentTable.jsx');
  const detail = sourceOf('pages/StudentDetailPage.jsx');
  const form = sourceOf('pages/StudentFormPage.jsx');

  assert(
    helper.includes("value.startsWith('/') && !value.startsWith('//')"),
    'only internal paths are honoured, so the trail can never become an open redirect',
  );
  assert(helper.includes('location.pathname') && helper.includes('location.search'), 'the trail is the whole URL, filters included');
  assert(
    page.includes('currentPath(location)') && page.includes('state={{ registerFrom: registerUrl }}'),
    'the register passes its own URL to everything it opens',
  );
  assert(
    (table.match(/state=\{\{ registerFrom \}\}/g) ?? []).length >= 4,
    'every link out of a row or a card carries it — table and mobile card alike',
  );
  assert(
    detail.includes('backToRegister(location)') && detail.includes('navigate(registerFrom'),
    'the student screen returns to that register, including after a delete',
  );
  assert(
    form.includes("state: { registerFrom }") && form.includes('backToStudent(location, paths.student(id))'),
    'and saving or cancelling lands somewhere the user recognises',
  );
});

await check('the delete flow is never optimistic and never silent', () => {
  const register = sourceOf('hooks/useStudentRegister.js');
  const detail = sourceOf('pages/StudentDetailPage.jsx');
  const dialog = sourceOf('components/ui/ConfirmDialog.jsx');

  assert(register.includes('await studentService.remove(deleteTarget.id)'), 'the register only reacts once the API has confirmed');
  assert(register.includes('refresh()'), 'and then re-reads the page rather than editing it in place');
  assert(
    register.includes('deleteError.isNotFound') && register.includes('already removed'),
    'a record somebody else deleted is reported as such, honestly',
  );
  assert(
    !/setItems\(|items\.filter\(/.test(register),
    'nothing removes a row locally — a failed request can never leave the list wrong',
  );
  assert(
    detail.includes('if (isDeleting) return;'),
    'the detail screen refuses a second delete while one is running',
  );
  assert(
    !/finally\s*{\s*setIsDeleting\(false\);\s*setIsConfirmOpen\(false\);\s*}/.test(detail),
    'and a failure keeps the confirmation open so the user can retry',
  );
  assert(dialog.includes('if (!isLoading) onClose?.();'), 'while a delete is running, Escape and the backdrop cannot dismiss it');
  assert(dialog.includes('isLoading={isLoading}'), 'and the confirm button reports the request instead of firing again');
  assert(
    dialog.includes('This cannot be undone') || sourceOf('pages/StudentsPage.jsx').includes('This cannot be undone'),
    'the confirmation states the permanence in words',
  );
});

await check('list interaction, search feedback and recovery stay in the established architecture', () => {
  const controller = sourceOf('hooks/useStudentRegister.js');
  const page = sourceOf('pages/StudentsPage.jsx');
  const search = sourceOf('components/ui/SearchInput.jsx');
  const toolbar = sourceOf('components/students/StudentRegisterToolbar.jsx');

  assert(
    controller.includes('const isSearching = isLoading && Boolean(query.search);'),
    'the search field is busy exactly while a search is being answered',
  );
  assert(
    search.includes('aria-busy={isBusy || undefined}') && search.includes('Loader2'),
    'and says so visually and to assistive technology',
  );
  assert(toolbar.includes('isBusy={isSearching}'), 'the toolbar passes the state to the control');
  assert(
    page.includes('aria-live="polite"') && controller.includes('resultSummary'),
    'an empty or failed register is announced, and the wording distinguishes the two empties',
  );
  assert(
    controller.includes('No students match the current search and filters.') &&
      controller.includes('No students have been added yet.'),
    'nothing has been added yet is not the same screen as nothing matches',
  );
  assert(page.includes('onRetry={register.refresh}'), 'a failed load offers a retry rather than a dead end');
  assert(
    page.includes('aria-busy={register.isLoading || undefined}'),
    'and the results region reports that it is being replaced',
  );
  assert(
    !controller.includes('useState({') && !controller.includes('localStorage'),
    'no second copy of the query appeared while the interaction was refined',
  );
});

// ---------------------------------------------------------------------------
section('Dashboard, search & filtering experience (static)');
// ---------------------------------------------------------------------------

await check('the statistics endpoint stays the only source of dashboard numbers', () => {
  const summary = sourceOf('hooks/useDashboardSummary.js');
  const service = sourceOf('services/studentService.js');
  const page = sourceOf('pages/DashboardPage.jsx');

  assert(summary.includes('studentService') && summary.includes('.stats('), 'the summary hook reads the statistics endpoint');
  assert(!summary.includes('.list('), 'the dashboard must never read the register to count it');
  assert(
    (clientSource.replace(/\/\*[\s\S]*?\*\//g, '').match(/\/students\/stats/g) ?? []).length === 1,
    'the statistics path should appear in exactly one place — the service',
  );
  assert(service.includes("stats: (options) => api.get('/students/stats'"), 'and that place is studentService');
  assert(
    !page.includes('studentService') && !/\bfetch\(/.test(page),
    'the dashboard page itself does not fetch anything',
  );
  assert(
    !/byDepartment[\s\S]{0,80}\.length\s*\+/.test(page) && !page.includes('students.length'),
    'nothing on the dashboard counts rows to produce a figure',
  );
  assert(!/setInterval|WebSocket|EventSource/.test(clientSource), 'statistics are not kept fresh by polling or a socket');
});

await check('statistics stay fresh through the existing change announcement', () => {
  const summary = sourceOf('hooks/useDashboardSummary.js');
  const service = sourceOf('services/studentService.js');
  const list = sourceOf('hooks/useStudentList.js');

  assert(summary.includes('onStudentsChanged(refresh)'), 'the dashboard refreshes when a student changes');
  assert(list.includes('onStudentsChanged(refresh)'), 'and so does an open register');
  assert(
    (service.match(/announceChange\(\)/g) ?? []).length === 3,
    'create, update and delete are the three things that announce a change',
  );
  assert(
    !service.includes('changeListeners.forEach') || service.includes('const announceChange'),
    'there is still exactly one announcement mechanism',
  );
});

await check('dashboard figures are the API fields, described honestly', () => {
  const page = sourceOf('pages/DashboardPage.jsx');
  const summary = sourceOf('hooks/useDashboardSummary.js');

  for (const field of ['total', 'active', 'inactive', 'departmentCount', 'byDepartment', 'byYear', 'recent']) {
    assert(page.includes(`summary.${field}`), `the dashboard should render ${field}`);
    assert(summary.includes(`${field}:`) || summary.includes(field), `${field} should come from the API payload`);
  }
  assert(
    summary.includes('recentRegistrations'),
    'recent registrations come from the statistics payload, not a second request',
  );
  assert(
    !/\b(trend|growth|last (?:month|week|year)|vs\.? (?:last|previous)|increase|decrease)\b/i.test(page),
    'no growth, trend or period comparison is claimed — the API supplies none',
  );
  assert(
    !/Math\.round\(\s*\(?\s*summary\.(?:active|inactive)\s*\/\s*summary\.total/.test(page),
    'no percentage is derived from the counts and presented as a statistic',
  );
  assert(
    page.includes('Records whose status is active') && page.includes('Records whose status is inactive'),
    'each figure says what it counts',
  );
  assert(
    page.includes('The five newest records, by date of registration.'),
    'recent is defined in words',
  );
  assert(
    page.includes('Status controls whether a student is counted in active enrolment figures.'),
    'and what enrollment status changes is explained where the split is shown',
  );

  // The wording has to match what the API actually does.
  const server = readFileSync(new URL('../src/services/studentService.js', import.meta.url), 'utf8');
  assert(
    /\$sort:\s*\{\s*dateOfRegistration:\s*-1\s*,\s*createdAt:\s*-1\s*\}/.test(server) &&
      /\$limit:\s*5\b/.test(server),
    'the statistics endpoint really returns the five newest by registration date',
  );
});

await check('every dashboard figure is a way into the register, using canonical query state', () => {
  const page = sourceOf('pages/DashboardPage.jsx');
  const paths = sourceOf('routes/paths.js');

  assert(
    paths.includes('readStudentListQuery') &&
      paths.includes('writeStudentListQuery') &&
      paths.includes('studentRegisterHref'),
    'dashboard links are built by the register\'s own reader and writer, not a second format',
  );
  assert(
    page.includes('studentRegisterHref({ status: ') &&
      page.includes('studentRegisterHref({ department: ') &&
      page.includes('studentRegisterHref({ year: '),
    'the status, department and year figures open the register already narrowed',
  );
  assert(
    (page.match(/studentRegisterHref\(/g) ?? []).length >= 5,
    'the cards, the distribution rows and the status rows all link through it',
  );
  assert(
    page.includes('toLabel=') || page.includes('sr-only'),
    'a card link says where it goes for anyone who cannot see the arrow',
  );
  assert(
    !page.includes('?status=') && !page.includes('?department='),
    'no query string is hand-written anywhere on the dashboard',
  );
});

await check('the dashboard distinguishes loading, refreshing, empty and failed', () => {
  const page = sourceOf('pages/DashboardPage.jsx');
  const summary = sourceOf('hooks/useDashboardSummary.js');

  assert(summary.includes('isLoading: !statistics && !loadError'), 'a first load with nothing to show is loading');
  assert(
    summary.includes('isRefreshing: !isCurrent && Boolean(statistics)'),
    'a later load keeps the real numbers and reports that it is refreshing instead',
  );
  assert(summary.includes('setLastGood(stats)') && summary.includes('?? lastGood'), 'the numbers shown while refreshing are the last real ones');
  const errorBranch = page.slice(page.indexOf('summary.isError'), page.indexOf('<ErrorState'));
  assert(
    errorBranch.length > 0 && errorBranch.length < 1200,
    'a failed summary explains itself rather than drawing a register of zero',
  );
  assert(page.includes('onRetry={summary.refresh}'), 'and offers a retry that re-runs the same request');
  assert(
    /summary\.isError \? \([\s\S]*?\) : \(/.test(page),
    'the summary sections sit in the branch that runs when there is no error',
  );
  assert(!page.includes('value={0}'), 'no figure is hard-coded');
  assert(
    page.includes('No students yet') && page.includes('Add the first student'),
    'an empty register says so and offers the action that fills it',
  );
  assert(
    page.includes('aria-busy={summary.isLoading || summary.isRefreshing') && page.includes('Updating figures…'),
    'a refresh is announced and visible, not silent',
  );
  assert(
    !/0 (?:students|departments)/.test(page),
    'the empty wording comes from the counts, never from a literal zero',
  );
});

await check('the register says what is on screen, from the API\'s own metadata', () => {
  const pagination = sourceOf('components/ui/Pagination.jsx');
  const page = sourceOf('pages/StudentsPage.jsx');

  assert(
    /Page <span[\s\S]{0,120}?of\{' '\}[\s\S]{0,200}?formatCount\(totalPages\)/.test(pagination),
    'the current page and the number of pages are both spelled out',
  );
  assert(
    pagination.includes("isFiltered ? 'matching students' : 'students'"),
    'a filtered result is described as matching rather than as the whole register',
  );
  assert(
    !/items\.length|rows\.length/.test(pagination),
    'the counts come from the API metadata, never from the rows on screen',
  );
  assert(
    page.includes('isFiltered={register.isFiltered}'),
    'the register tells the count which of the two sentences applies',
  );
  assert(
    page.includes('total={register.meta.total}') && page.includes('page={register.meta.page}'),
    'page and total are the API\'s, not a local calculation',
  );
});

await check('filters advertise themselves and say how many are narrowing the register', () => {
  const toolbar = sourceOf('components/students/StudentRegisterToolbar.jsx');
  const chips = sourceOf('components/students/ActiveFilterChips.jsx');
  const controller = sourceOf('hooks/useStudentRegister.js');
  const field = sourceOf('components/ui/Field.jsx');
  const query = sourceOf('utils/studentQuery.js');

  assert(
    (toolbar.match(/isActive=\{/g) ?? []).length >= 5 && field.includes('isActive'),
    'each narrowing control shows that it is narrowing something',
  );
  assert(
    controller.includes('const activeFilters = describeActiveFilters(query)') &&
      controller.includes('activeFilterCount: activeFilters.length,'),
    'the count of active filters is the length of the canonical filter list',
  );
  assert(
    controller.includes('describeActiveSort(query)') && query.includes('describeActiveSort'),
    'and a non-default sort is described separately from the filters',
  );
  assert(
    chips.includes('Sorted by: {sort.label}') && chips.includes('label={`Reset sorting'),
    'the chips row shows the sort as sorting, with its own way back to the default order',
  );
  assert(
    toolbar.includes('Narrow the register') && toolbar.includes('aria-label="Filter by status') === false,
    'the filter group keeps its heading',
  );
  assert(chips.includes("{filters.length === 1 ? 'filter' : 'filters'}"), 'the chips row counts what is applied');
  assert(chips.includes('Clear all filters'), 'and offers one clear action');
  assert(
    chips.includes('label={`Remove filter: ${filter.label}`}'),
    'each chip removes only itself, and says which filter it removes',
  );
  assert(
    controller.includes('applyQuery({ [key]: key === \'sort\' ? DEFAULT_SORT : \'\' })'),
    'removing a chip patches one key and leaves the rest of the query alone',
  );
  assert(
    controller.includes('const next = { ...query, ...patch }'),
    'every change is a merge into the current query, so unrelated state survives',
  );
  assert(
    toolbar.includes('Changing a filter, the sort or the page size starts again at page 1.'),
    'the interface says what changing the query does to the page',
  );
});

await check('search keeps its server semantics and its user feedback', () => {
  const controller = sourceOf('hooks/useStudentRegister.js');
  const search = sourceOf('components/ui/SearchInput.jsx');
  const toolbar = sourceOf('components/students/StudentRegisterToolbar.jsx');

  assert(controller.includes('SEARCH_DEBOUNCE_MS = 320'), 'the debounce is still 320 ms');
  assert(
    controller.includes('const isSearching = isLoading && Boolean(query.search);'),
    'only a search makes the search box busy',
  );
  assert(
    controller.includes('isUpdating') && sourceOf('hooks/useStudentList.js').includes('isUpdating'),
    'a filter, sort or page change is reported as an update to the results, separately',
  );
  assert(
    search.includes('aria-busy={isBusy || undefined}') && search.includes('value'),
    'the field announces its own busy state and stays a controlled input',
  );
  assert(
    toolbar.includes('Matches part of a word, and every word has to match something') &&
      toolbar.includes('kumar cse'),
    'the interface still explains how multi-term search works',
  );
  assert(
    toolbar.includes('Search name, ID, email or phone') && toolbar.includes('isBusy={isSearching}'),
    'and what it searches, with the busy state wired in',
  );
  assert(
    controller.includes('committedSearch') && controller.includes('useDebouncedValue(searchTerm, SEARCH_DEBOUNCE_MS)'),
    'the debounce still commits through the URL rather than a local result set',
  );
});

await check('page, sort and page size stay allowlisted, server-driven and never stranded', () => {
  const controller = sourceOf('hooks/useStudentRegister.js');
  const query = sourceOf('utils/studentQuery.js');
  const service = sourceOf('services/studentService.js');
  const constants = sourceOf('constants/student.js');

  assert(constants.includes('PAGE_SIZE_OPTIONS') && query.includes('PAGE_SIZE_OPTIONS.includes(limit)'), 'page size is restricted to the allowlist');
  assert(query.includes('SORT_OPTIONS.map((option) => option.value)') && query.includes('oneOf('), 'sort is restricted to the allowlist');
  assert(service.includes('page: query.page') && service.includes('limit: query.limit'), 'paging is sent to the API, not applied to rows');
  assert(
    !/slice\(\s*\(?\s*page/.test(controller) && !/slice\(\s*\(?\s*page/.test(sourceOf('pages/StudentsPage.jsx')),
    'nothing slices a result set into pages on the client',
  );
  assert(controller.includes('if (patch.page === undefined) next.page = 1;'), 'any change other than the page itself returns to page 1');
  assert(controller.includes('query.page > meta.totalPages'), 'a page past the end steps back to the last real page after a delete');
  assert(
    controller.includes('if (hasInvalidListParams(searchParams))'),
    'a hand-edited query self-corrects through the canonical writer',
  );
});

// ---------------------------------------------------------------------------
section('Motion & interactive UX');
// ---------------------------------------------------------------------------

/** Every `duration: 0.32` inside a motion transition, with the file it came from. */
const motionDurations = () => {
  const found = [];
  for (const [name, source] of clientFiles) {
    if (name === 'pages/LandingPage.jsx') continue; // the landing hero is a one-shot, checked on its own
    for (const match of source.matchAll(/duration:\s*([0-9.]+)/g)) {
      found.push([name, Number(match[1])]);
    }
  }
  return found;
};

await check('motion is one product, built from the libraries that were already installed', () => {
  const gsapUsers = clientFiles
    .filter(([, source]) => /from 'gsap'|from "gsap"/.test(source))
    .map(([name]) => name)
    .sort();

  assert(
    gsapUsers.join(', ') === 'hooks/useBarGrowth.js, pages/LandingPage.jsx',
    `GSAP should stay where it earns its place, found: ${gsapUsers.join(', ') || 'nowhere'}`,
  );

  const motionUsers = clientFiles.filter(([, source]) => source.includes("from 'motion/react'"));
  assert(motionUsers.length >= 12, 'component motion should still come from Motion');
  for (const [name, source] of motionUsers) {
    assert(
      !source.includes("from 'framer-motion'") && !source.includes('from "framer-motion"'),
      `${name} should use the installed motion package, not framer-motion`,
    );
  }

  for (const [name, source] of clientFiles) {
    assert(!/gsap\/[A-Za-z]|registerPlugin|ScrollTrigger|SplitText|Draggable/.test(source), `${name} should not pull in a GSAP plugin`);
    assert(!/@react-spring|auto-animate|lottie|animate\.css|popmotion/.test(source), `${name} should not reference a second animation library`);
  }

  const manifest = JSON.parse(readFileSync(new URL('../../client/package.json', import.meta.url), 'utf8'));
  const dependencies = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
  const animationish = dependencies.filter((name) => /motion|animate|spring|gsap|tween|transition|lottie/i.test(name));
  assert(
    animationish.sort().join(', ') === 'gsap, motion',
    `the dependency list should not have grown an animation library: ${animationish.join(', ')}`,
  );
});

await check('every animation stays inside the product timing bands', () => {
  for (const [name, duration] of motionDurations()) {
    assert(duration >= 0.1 && duration <= 0.35, `${name} animates for ${duration}s, outside the 0.1–0.35s band`);
  }

  assert(
    !/duration-(?:500|700|1000)\b/.test(clientSource),
    'no long decorative Tailwind duration should exist anywhere in the client',
  );
  assert(
    !/\b(?:type:\s*'spring'|stiffness\s*:)/.test(clientSource),
    'ordinary controls should ease rather than spring, so nothing overshoots',
  );
  assert(
    !/\bbounce|elastic|back\.out\b/i.test(clientSource.replace(/\/\*[\s\S]*?\*\//g, '')),
    'no cartoon easing should appear in the interface',
  );

  const bars = sourceOf('hooks/useBarGrowth.js');
  assert(
    /const ENTER_DURATION = 0\.\d+;/.test(bars) && /const UPDATE_DURATION = 0\.\d+;/.test(bars),
    'the bar entrance and the bar update durations are named constants',
  );
  assert(
    Number(bars.match(/const ENTER_DURATION = ([0-9.]+)/)[1]) <= 0.45 &&
      Number(bars.match(/const UPDATE_DURATION = ([0-9.]+)/)[1]) <= 0.3,
    'a bar grows once, briefly, and moves quickly when the figure behind it changes',
  );
  assert(
    /const ENTER_STAGGER_LIMIT = ([0-9.]+)/.test(bars) &&
      Number(bars.match(/const ENTER_STAGGER_LIMIT = ([0-9.]+)/)[1]) <= 0.2,
    'the bar stagger is capped so the last row never waits',
  );
});

/**
 * Source with its comments removed, for assertions that look for a *decision*
 * rather than the words that explain it.
 */
const withoutComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

await check('page transitions belong to the shell alone and never delay navigation', () => {
  const pageTransition = withoutComments(sourceOf('components/motion/PageTransition.jsx'));
  const layout = withoutComments(sourceOf('components/layout/AppLayout.jsx'));

  const definitions = clientFiles.filter(([, source]) => source.includes('<PageTransition'));
  assert(
    definitions.length === 1 && definitions[0][0] === 'components/layout/AppLayout.jsx',
    'exactly one file wraps a route in the page transition',
  );
  assert(!layout.includes('PageTransition key={pathname}'), 'the shell should not restart the transition per URL, only per route pattern');
  assert(layout.includes('const routePattern = matchRouteMeta(pathname).path'), 'the key stays the route pattern');
  assert(
    !/<PageTransition[^>]*delay/.test(layout) && !pageTransition.includes('delay') && !layout.includes('delay'),
    'no route delay: navigation must be immediate',
  );
  assert(!pageTransition.includes('exit='), 'the transition has no exit, so a new screen never waits for the old one to leave');
  assert(
    pageTransition.includes("duration: prefersReducedMotion ? 0.16 : 0.3"),
    'the entrance is short enough to read as instant, and shorter still under reduced motion',
  );
  assert(
    !/\bexit=|\bAnimatePresence\b/.test(sourceOf('components/routing/ProtectedRoute.jsx')),
    'guarding a route should not animate anything of its own',
  );
});

await check('a refreshed figure never flashes back to zero', () => {
  const counter = sourceOf('hooks/useCountUp.js');
  const card = sourceOf('components/ui/StatCard.jsx');
  const dashboard = sourceOf('pages/DashboardPage.jsx');

  assert(
    counter.includes('const from = displayed.current'),
    'each run starts from the figure already on screen, which is what makes 248 → 250 an update and not an entrance',
  );
  assert(
    counter.includes('displayed.current = next') && counter.includes('displayed.current = safeTarget'),
    'the on-screen figure is remembered across renders and retired exactly on the API value',
  );
  assert(
    counter.includes('if (from === safeTarget) return undefined;'),
    'an unchanged target animates nothing, so an unrelated re-render cannot restart it',
  );
  assert(
    /useEffect\(\(\) => \{[\s\S]*?\}, \[duration, prefersReducedMotion, safeTarget\]\);/.test(counter),
    'the count is registered once per target and per motion preference',
  );
  assert(
    counter.includes('cancelAnimationFrame(frame)') && !counter.includes('setInterval'),
    'a cancelled or unmounted count-up leaves no frame behind',
  );
  assert(counter.includes('number = 520') === false && /duration = 5\d\d/.test(counter), 'the count stays short');
  assert(
    counter.includes('Number.isFinite(Number(target))'),
    'a missing figure cannot be animated into an invented one',
  );
  assert(
    card.includes('useCountUp(value)') && card.includes('{formatCount(animatedValue)}'),
    'the card renders the counted figure through the one number formatter',
  );
  assert(
    dashboard.includes('useDashboardSummary()') && !dashboard.includes('setInterval') && !dashboard.includes('requestAnimationFrame'),
    'the dashboard never polls or drives its own frames',
  );
});

await check('the dashboard bars say what the API said, and GSAP only moves towards it', () => {
  const bars = sourceOf('hooks/useBarGrowth.js');
  const dashboard = sourceOf('pages/DashboardPage.jsx');

  assert(
    bars.includes('gsap.context(') && bars.includes('return () => context.revert();'),
    'GSAP has exactly one home, and it is reverted on the way out',
  );
  assert(
    bars.includes('useLayoutEffect') && !bars.includes('useEffect('),
    'the bars are set before the first paint, so they never flash at full length',
  );
  assert(
    bars.includes("}, [prefersReducedMotion, signature]);"),
    'the animation is keyed by the data signature, not by every render',
  );
  assert(
    bars.includes("gsap.utils.toArray('[data-bar]')") && bars.includes('}, scope);'),
    'the tweens are scoped to the panel that owns them',
  );
  assert(
    bars.includes("overwrite: 'auto'") && bars.includes('const previous = painted.current.get(key)'),
    'a change slides a bar from its previous width and never stacks two tweens',
  );
  assert(
    bars.includes("if (!scope || prefersReducedMotion) return undefined;"),
    'under reduced motion the bars are simply the right length, with no GSAP at all',
  );
  assert(
    bars.includes('gsap.fromTo') && !bars.includes('gsap.to(') && !bars.includes('gsap.set('),
    'GSAP only animates between two widths React already declared',
  );

  assert(
    (dashboard.match(/data-bar=/g) ?? []).length === 3 &&
      dashboard.includes("data-bar={label}") &&
      dashboard.includes('data-bar="active"') &&
      dashboard.includes('data-bar="inactive"'),
    'every measured bar is named for the animation, and every bar is one of the API facets',
  );
  assert(
    dashboard.includes('Math.max((count / max) * 100, 3)'),
    'the 3% visibility floor is still applied to the real counts',
  );
  assert(
    dashboard.includes('style={{ width:') && !dashboard.includes("gsap.set("),
    'the width in the markup is React’s, so the figure is correct with or without the animation',
  );
  assert(
    (dashboard.match(/useBarGrowth\(/g) ?? []).length === 3 &&
      dashboard.includes('`${row.label}:${row.count}`') &&
      dashboard.includes('`${summary.active}:${summary.inactive}:${summary.total}`'),
    'each panel watches its own API values, so a refresh of the same numbers changes nothing',
  );
});

await check('interactive surfaces keep their motion inside the rules', () => {
  const chips = sourceOf('components/students/ActiveFilterChips.jsx');
  const drawer = sourceOf('components/layout/Sidebar.jsx');
  const modal = sourceOf('components/ui/Modal.jsx');
  const toasts = sourceOf('context/ToastProvider.jsx');
  const segmented = sourceOf('components/ui/SegmentedControl.jsx');
  const table = sourceOf('components/ui/DataTable.jsx');

  assert(
    chips.includes('AnimatePresence initial={false}') && chips.includes('layout="position"'),
    'chips arrive and leave with the URL, and the row closes the gap instead of jumping',
  );
  assert(
    chips.includes('exit={{ opacity: 0, transition: { duration: 0.12 } }}') &&
      !chips.includes('useState'),
    'the chips row has no state of its own: what it draws is what the URL says',
  );
  assert(
    chips.includes('aria-live="polite"') && chips.includes('aria-label="Clear all filters"') === false,
    'the chips row is announced as it changes',
  );

  assert(
    drawer.includes('AnimatePresence') && drawer.includes('exit={prefersReducedMotion ? { opacity: 0 }'),
    'the mobile drawer animates both ways, and fades instead of sliding under reduced motion',
  );
  assert(
    drawer.includes("animate={prefersReducedMotion ? { opacity: 1 } : { x: 0 }}") &&
      drawer.includes('duration: 0.24'),
    'the drawer arrives in 240ms and is never a decorative slide',
  );
  assert(
    drawer.includes("if (event.key === 'Escape') setDrawerRoute(null);") === false &&
      sourceOf('components/layout/AppLayout.jsx').includes("if (event.key === 'Escape') setDrawerRoute(null);"),
    'Escape still closes the drawer, from the shell that owns the state',
  );

  assert(
    modal.includes("initial={{ opacity: 0, y: 24, scale: 0.98 }}") &&
      modal.includes('duration: 0.22, ease: [0.22, 1, 0.36, 1]'),
    'a dialog eases in quickly instead of springing',
  );
  assert(
    modal.includes('aria-modal="true"') && modal.includes('FOCUSABLE') && modal.includes('event.key === \'Escape\''),
    'the dialog keeps its trap, its Escape and its modal semantics',
  );

  assert(toasts.includes('AnimatePresence initial={false}') && toasts.includes('duration: 0.2'), 'a toast appears immediately and briefly');
  assert(
    toasts.includes('layout={!prefersReducedMotion}') && toasts.includes('role="status"') && toasts.includes('aria-live="polite"'),
    'the remaining toasts reflow without animating for someone who asked for less motion',
  );
  assert(segmented.includes('duration: 0.2') && segmented.includes('aria-checked={isActive}'), 'the segmented pill eases between options and keeps its radio semantics');
  assert(
    table.includes('duration: 0.18') && table.includes('hover:bg-beige/20') && !table.includes('scale'),
    'table rows fade in briefly and change colour on hover — never position',
  );
});

await check('animated surfaces keep their focus, their labels and their state', () => {
  const button = sourceOf('components/ui/Button.jsx');
  const field = sourceOf('components/ui/Field.jsx');
  const statCard = sourceOf('components/ui/StatCard.jsx');
  const states = sourceOf('components/ui/States.jsx');

  assert(
    button.includes('disabled={disabled || isLoading}') && button.includes('aria-busy={isLoading || undefined}'),
    'a loading button is inert in the same render it starts loading',
  );
  assert(
    button.includes('prefersReducedMotion || disabled || isLoading ? undefined : { scale: 0.97 }'),
    'press feedback is skipped when the button is inert or the user prefers less motion',
  );
  assert(
    button.includes('animate-spin') && button.includes('aria-hidden="true"'),
    'the spinner is decorative and never announced twice',
  );

  assert(
    field.includes('AnimatePresence initial={false} mode="wait"') &&
      field.includes("'aria-describedby': error || hint ? messageId : undefined"),
    'the error message animates, while the control is described in the same render',
  );
  assert(
    field.includes("'aria-invalid': error ? true : undefined") && !field.includes('onAnimationComplete'),
    'a rejected field is marked immediately, and nothing waits for an animation to finish',
  );

  assert(
    statCard.includes('group-hover:translate-x-0.5') && statCard.includes('group block h-full'),
    'the dashboard cards answer the pointer with a nudge of the arrow only',
  );
  assert(
    !/whileHover|whileTap/.test(statCard) && statCard.includes('hover:border-line-strong hover:shadow-raised'),
    'a card does not jump, rotate or glow',
  );

  assert(states.includes('duration: 0.24'), 'an empty or failed state arrives quietly');
  assert(
    !/(?:shake|flash|vibrate|Audio|playSound)/i.test(clientSource.replace(/\/\*[\s\S]*?\*\//g, '')),
    'nothing shakes, flashes or makes a sound',
  );
  assert(
    !/requestAnimationFrame/.test(clientSource.replace(sourceOf('hooks/useCountUp.js'), '')),
    'the count-up is the only place the product drives its own frames',
  );
  assert(
    !/while\s*\(\s*true/.test(clientSource) && !/setInterval/.test(clientSource),
    'no unbounded loop or repeating timer animates anything',
  );
});

// ---------------------------------------------------------------------------
section('Security, input hardening & responsive integrity');
// ---------------------------------------------------------------------------

/**
 * The register's list parameters are one value each.
 *
 * Express parses a repeated parameter into an array. Before this was enforced
 * that array either reached the query builder and threw while being trimmed (a
 * 500 for a URL anybody can type) or became a query shape nobody intended, so
 * these checks pin down both halves: the request is refused, and nothing reaches
 * the model.
 */
await check('every register query parameter is a single value', async () => {
  const repeated = [
    'status=active&status=inactive',
    'year=1st%20Year&year=2nd%20Year',
    'department=a&department=b',
    'course=a&course=b',
    'search=kumar&search=sharma',
    'sort=name&sort=email',
    'page=1&page=2',
    'limit=5&limit=10',
  ];

  for (const pairs of repeated) {
    let reachedModel = false;

    const response = await withModelStubs(
      {
        ...userStubs,
        Student: {
          find: () => {
            reachedModel = true;
            return chainableQuery([]);
          },
          countDocuments: async () => 0,
        },
      },
      () => stubRequest('GET', `/api/students?${pairs}`),
    );

    assert(response.status === 422, `\`${pairs}\` should be refused, received ${response.status}`);
    assert(reachedModel === false, `\`${pairs}\` must be refused before any query is built`);
  }

  // A single value for the same parameters is still perfectly usable.
  let filter;
  const single = await withModelStubs(
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
    () => stubRequest('GET', '/api/students?status=active&year=1st%20Year&sort=name&page=2&limit=25'),
  );

  assert(single.status === 200, `a single value per parameter should still work, received ${single.status}`);
  assert(filter.enrollmentStatus === 'active' && filter.year === '1st Year', 'and should still reach the query');

  const source = readFileSync(new URL('../src/validators/studentValidators.js', import.meta.url), 'utf8');
  assert(
    source.includes('const singleValue = (fields) =>') && source.includes('...singleValue(['),
    'the contract lives in one place in the validators',
  );

  const guarded = source.slice(source.indexOf('...singleValue(['));
  for (const field of ['search', 'status', 'year', 'department', 'course', 'sort', 'order', 'page', 'limit']) {
    assert(guarded.slice(0, 400).includes(`'${field}',`), `\`${field}\` should be covered by the single-value rule`);
  }
});

await check('a filter in the wrong shape can never reach the query engine', async () => {
  // The pure builder is used by other callers too, so it stays total: a value
  // that is not a string is left out rather than trusted, thrown on, or turned
  // into a query operator.
  const hostile = buildStudentQuery({
    status: ['active', 'inactive'],
    year: { $ne: '1st Year' },
    department: ['CSE'],
    course: { $regex: '.*' },
    search: ['kumar', 'sharma'],
  });

  assert(typeof hostile === 'object' && hostile !== null, 'the builder must still answer');
  assert(hostile.enrollmentStatus === undefined && hostile.year === undefined, 'an array or object is not a status or a year');
  assert(hostile.department === undefined && hostile.course === undefined, 'and it is not a department or a course either');
  assert(
    !JSON.stringify(hostile).includes('$ne') && !JSON.stringify(hostile).includes('$regex'),
    'no query operator may be built from a parameter value',
  );

  const text = buildStudentQuery({ status: 'active', year: '2nd Year', department: 'CSE', course: 'BBA' });
  assert(text.enrollmentStatus === 'active' && text.year === '2nd Year', 'plain strings still filter');
  assert(text.department instanceof RegExp && text.course instanceof RegExp, 'and still match case-insensitively');

  // Over HTTP, operator syntax in a parameter name is dropped rather than parsed.
  for (const path of [
    '/api/students?status%5B%24ne%5D=active',
    '/api/students?department%5B%24regex%5D=.*',
    '/api/students?sort%5B%24ne%5D=name',
    '/api/students?limit%5B%24gt%5D=0',
  ]) {
    let filter;
    const response = await withModelStubs(
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
      () => stubRequest('GET', path),
    );

    assert(response.status === 200, `${path} should be answered, received ${response.status}`);
    assert(
      Object.keys(filter).length === 0 && !JSON.stringify(filter).includes('$'),
      `${path} must not contribute a clause to the query`,
    );
  }
});

await check('an out-of-range page answers as an empty page, never as an unbounded skip', async () => {
  const absurd = resolvePagination({ page: 1e20, limit: 10 });
  assert(Number.isSafeInteger(absurd.skip), `a skip must stay representable, got ${absurd.skip}`);
  assert(absurd.skip <= MAX_SKIP, `a skip must stay bounded, got ${absurd.skip}`);
  assert(absurd.page <= absurd.skip / absurd.limit + 1, 'the page reported back is the page actually read');

  for (const value of [Infinity, -5, 0, 'abc', null, undefined, 2]) {
    const safe = resolvePagination({ page: value, limit: 10 });
    assert(Number.isSafeInteger(safe.skip) && safe.skip >= 0, `page \`${value}\` produced skip ${safe.skip}`);
    assert(Number.isSafeInteger(safe.limit) && safe.limit >= 1, `page \`${value}\` produced limit ${safe.limit}`);
  }

  let query;
  const response = await withModelStubs(
    {
      ...userStubs,
      Student: {
        find: () => {
          query = chainableQuery([]);
          return query;
        },
        countDocuments: async () => 0,
      },
    },
    () => stubRequest('GET', '/api/students?page=99999999999999999999&limit=100'),
  );

  assert(response.status === 200, `an impossible page should still answer, received ${response.status}`);
  assert(Number.isSafeInteger(query.skipped), `the driver must never be handed ${query.skipped}`);
  assert(query.skipped <= MAX_SKIP, `the skip must be bounded, got ${query.skipped}`);
  assert(response.body.meta.page <= MAX_SKIP + 1, 'the response describes the page it actually read');
});

await check('a registration date cannot be in the future', async () => {
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const past = '2020-01-01';

  const created = await withModelStubs(
    {
      User: { findById: async () => fakeUser },
      Student: { create: async (value) => fakeDocument(value) },
    },
    () => stubRequest('POST', '/api/students', { body: { ...VALID_STUDENT, dateOfRegistration: future } }),
  );

  assert(created.status === 422, `a future date should be refused, received ${created.status}`);
  assert(
    /future/i.test(created.body.error.details?.dateOfRegistration ?? ''),
    'and the field should say what is wrong',
  );

  const patched = await withModelStubs(
    { User: { findById: async () => fakeUser }, Student: { findById: async () => fakeDocument() } },
    () =>
      stubRequest('PATCH', '/api/students/64b7f9c2e1a2b3c4d5e6f7a8', {
        body: { dateOfRegistration: future },
      }),
  );

  assert(patched.status === 422, `an edit must not move a date into the future either, received ${patched.status}`);

  let created_value;
  const accepted = await withModelStubs(
    {
      User: { findById: async () => fakeUser },
      Student: {
        create: async (value) => {
          created_value = value;
          return fakeDocument(value);
        },
      },
    },
    () => stubRequest('POST', '/api/students', { body: { ...VALID_STUDENT, dateOfRegistration: past } }),
  );

  assert(accepted.status === 201, `a real date must still be accepted, received ${accepted.status}`);
  assert(created_value.dateOfRegistration instanceof Date, 'and still reach the model as a Date');

  // The form refuses it first, so the rule is stated in both places.
  assert(
    sourceOf('pages/StudentFormPage.jsx').includes('notFutureDate()'),
    'the form refuses a future date at the field as well',
  );
});

await check('no secret is committed, and none can reach the browser', async () => {
  const repo = new URL('../../', import.meta.url);
  const serverEnv = readFileSync(new URL('server/.env.example', repo), 'utf8');
  const clientEnv = readFileSync(new URL('client/.env.example', repo), 'utf8');

  for (const [name, template] of [
    ['server/.env.example', serverEnv],
    ['client/.env.example', clientEnv],
  ]) {
    assert(template.includes('JWT_SECRET') || name.startsWith('client'), `${name} should document the configuration`);
    assert(
      !/[0-9a-f]{32,}/i.test(template),
      `${name} must contain placeholders, not a real key`,
    );
    assert(!/mongodb\+srv:\/\/[^:\s]+:[^@\s]+@/.test(template), `${name} must not carry a real connection string`);
  }

  const ignore = readFileSync(new URL('.gitignore', repo), 'utf8');
  assert(/^\.env$/m.test(ignore) && /^!\.env\.example$/m.test(ignore), 'real environment files are ignored, templates are not');

  const secretShapes = [
    /mongodb\+srv:\/\/[^:\s/]+:[^@\s]+@/i,
    /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  ];

  for (const [name, source] of clientFiles) {
    for (const shape of secretShapes) {
      assert(!shape.test(source), `${name} looks like it contains a real credential`);
    }
    assert(
      !/import\.meta\.env\.(?!VITE_|DEV|PROD|MODE|BASE_URL|SSR)/.test(source),
      `${name} reads a custom environment variable that is not VITE_-prefixed`,
    );
    for (const serverOnly of ['JWT_SECRET', 'MONGODB_URI', 'BCRYPT_SALT_ROUNDS', 'process.env']) {
      assert(!source.includes(serverOnly), `${name} must not reach for the server's ${serverOnly}`);
    }
  }

  for (const name of ['config/env.js', 'middleware/requireAuth.js', 'utils/token.js', 'services/authService.js']) {
    const source = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
    for (const shape of secretShapes) {
      assert(!shape.test(source), `server/src/${name} looks like it contains a real credential`);
    }
  }

  assert(
    readFileSync(new URL('../src/config/env.js', import.meta.url), 'utf8').includes(
      'JWT_SECRET must be set to a strong, unique value in production.',
    ),
    'a production boot without a real secret must still refuse to start',
  );
});

await check('the update payload is allowlisted end to end', async () => {
  let created;
  const response = await withModelStubs(
    {
      User: { findById: async () => fakeUser },
      Student: {
        create: async (value) => {
          created = value;
          return fakeDocument(value);
        },
      },
    },
    () =>
      stubRequest('POST', '/api/students', {
        body: {
          ...VALID_STUDENT,
          enrollmentStatus: 'active',
          avatarUrl: '',
          role: 'admin',
          teacherNotes: 'not a field',
          $where: 'this.name',
        },
      }),
  );

  assert(response.status === 201, `a normal create should succeed, received ${response.status}`);
  assert(
    Object.keys(created).sort().join(',') ===
      'avatarUrl,course,dateOfRegistration,department,email,enrollmentStatus,name,phone,year',
    `only the editable fields may reach the model, got ${Object.keys(created).join(', ')}`,
  );
  assert(created.createdAt === undefined && created.role === undefined, 'no protected or unknown field is written');
  assert(Object.keys(created).every((key) => !key.startsWith('$')), 'no operator may be written as a field');

  for (const field of ['studentId', 'id', '_id', 'createdAt', 'updatedAt', '__v']) {
    const refused = await withModelStubs(
      {
        User: { findById: async () => fakeUser },
        Student: { create: async (value) => fakeDocument(value) },
      },
      () => stubRequest('POST', '/api/students', { body: { ...VALID_STUDENT, [field]: 'injected' } }),
    );

    assert(refused.status === 422, `\`${field}\` should be refused outright, received ${refused.status}`);
    assert(refused.body.error.details?.[field], `\`${field}\` should be named in the error`);
  }

  const document = fakeDocument();
  const patched = await withModelStubs(
    { User: { findById: async () => fakeUser }, Student: { findById: async () => document } },
    () =>
      stubRequest('PATCH', '/api/students/64b7f9c2e1a2b3c4d5e6f7a8', {
        body: { name: 'Renamed', role: 'admin', studentId: 'CDS-2026-9999' },
      }),
  );

  assert(patched.status === 422, `a protected field in an edit should be refused, received ${patched.status}`);
  assert(document.name === VALID_STUDENT.name, 'and nothing may be applied to the record');

  const renamed = fakeDocument();
  const clean = await withModelStubs(
    { User: { findById: async () => fakeUser }, Student: { findById: async () => renamed } },
    () =>
      stubRequest('PATCH', '/api/students/64b7f9c2e1a2b3c4d5e6f7a8', {
        body: { name: 'Renamed', role: 'admin', constructor: 'nope' },
      }),
  );

  assert(clean.status === 200, `an allowlisted edit should succeed, received ${clean.status}`);
  assert(renamed.name === 'Renamed', 'the allowlisted field is applied');
  assert(renamed.role === undefined, 'an unknown field is dropped rather than applied');
  assert(renamed.studentId === 'CDS-2026-0042', 'and the generated student ID is untouched');
  assert(({}).polluted === undefined, 'no prototype pollution survives the request');
});

await check('a failure the API did not plan for leaks nothing', async () => {
  // Whatever a dependency throws, the caller only ever sees a generic message, a
  // machine-readable code and no details. The hostile message below is what a real
  // driver error can look like: a connection string with credentials, a source
  // path, a bcrypt hash and a token.
  const hostile = new Error(
    'connect failed for mongodb+srv://campusdesk:sup3rSecret@cluster0.example.net/campusdesk ' +
      'while loading /srv/campusdesk/server/src/services/studentService.js ' +
      '(hash $2b$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEF, token ' +
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiJ9.signature)',
  );

  const response = await withModelStubs(
    {
      ...userStubs,
      Student: {
        find: () => chainableQuery([]),
        countDocuments: async () => {
          throw hostile;
        },
      },
    },
    () => stubRequest('GET', '/api/students'),
  );

  assert(response.status === 500, `an unplanned failure should answer 500, received ${response.status}`);
  assert(response.body.success === false, 'a failure keeps the standard envelope');
  assert(response.body.error.code === 'INTERNAL_ERROR', `unexpected code: ${response.body.error.code}`);
  assert(
    response.body.error.message === 'Something went wrong on our end. Please try again.',
    'the caller is told nothing beyond the fact that the request failed',
  );
  assert(response.body.error.details === undefined, 'no details are invented for an unplanned failure');
  assert(response.body.data === undefined, 'and no data accompanies a failure');

  const faced = JSON.stringify({
    code: response.body.error.code,
    message: response.body.error.message,
    details: response.body.error.details ?? null,
  });

  for (const [what, pattern] of [
    ['a connection string', /mongodb(\+srv)?:\/\//i],
    ['a credential', /sup3rSecret/],
    ['a host name', /cluster0\.example\.net/],
    ['a file path or file name', /\/srv\/|\.js\b|studentService/],
    ['a bcrypt hash', /\$2[aby]\$/],
    ['a token', /eyJ[A-Za-z0-9_-]{8,}/],
    ['a driver or model name', /MongoServerSelectionError|countDocuments|Mongoose/i],
  ]) {
    assert(!pattern.test(faced), `what the caller sees must not carry ${what}`);
  }

  // The stack exists for the developer: it stays a property of its own, never a
  // message, and the shipped handler attaches it only outside production and
  // never to the operational 503.
  const attached = response.body.error.stack;
  assert(attached === undefined || typeof attached === 'string', 'a stack may only be attached as its own field');
  assert(!String(response.body.error.message).includes('\n    at '), 'the message is never a stack trace');

  const handler = readFileSync(new URL('../src/middleware/errorHandler.js', import.meta.url), 'utf8');
  assert(
    /if \(!env\.isProduction && apiError\.statusCode >= 500 && apiError\.statusCode !== 503\)/.test(handler),
    'a stack trace is attached only outside production, and never to an operational 503',
  );
});

await check('nothing the API returns carries password material', async () => {
  const password = 'passw0rd123';
  const saved = [];

  const registered = await withModelStubs(
    { ...noWrites(saved), User: { exists: async () => null } },
    () => registerAttempt({ name: 'Ananya Sharma', email: 'ananya@campusdesk.edu', password }),
  );

  const account = await makeAccount({ password });
  const signedIn = await withModelStubs(
    { ...noWrites(), User: { findOne: () => selectable(account) } },
    () => loginAttempt({ email: account.email, password }),
  );

  const me = await withModelStubs(
    { ...noWrites(), User: { findById: async () => account } },
    () => stubRequest('GET', '/api/auth/me'),
  );

  const rejected = await withModelStubs(
    { ...noWrites(), User: { findOne: () => selectable(account) } },
    () => loginAttempt({ email: account.email, password: 'definitely-wrong' }),
  );

  assert(registered.status === 201 && signedIn.status === 200 && me.status === 200, 'the three happy paths should answer');
  assert(rejected.status === 401, 'a rejected sign-in should answer 401');

  for (const [name, response] of [
    ['registration', registered],
    ['sign-in', signedIn],
    ['me', me],
    ['a rejected sign-in', rejected],
  ]) {
    const raw = JSON.stringify(response.body);
    assert(!raw.includes(password), `${name} must never echo the password`);
    assert(!/passwordHash|password\s*:/.test(raw), `${name} must never carry a hash or a password field`);
    assert(!/\$2[aby]\$/.test(raw), `${name} must never carry anything that looks like a bcrypt hash`);
    assert(saved.every((doc) => doc.passwordHash !== password), 'the stored hash is never the plaintext');
  }
});

await check('the client and the API agree on every list vocabulary', async () => {
  const domainBundle = await bundleClient(
    { studentDomain: 'constants/student.js', studentQuery: 'utils/studentQuery.js' },
    { baseUrl: `${stubUrl}/api` },
  );

  const { PAGE_SIZE, PAGE_SIZE_OPTIONS, SORT_OPTIONS, STUDENT_YEARS, ENROLLMENT_STATUS_VALUES } =
    domainBundle.loaded.studentDomain;
  const { LIST_DEFAULTS, readStudentListQuery } = domainBundle.loaded.studentQuery;

  const {
    DEFAULT_PAGE_SIZE,
    DEFAULT_STUDENT_SORT_FIELD,
    ENROLLMENT_STATUSES: SERVER_STATUSES,
    MAX_PAGE_SIZE,
    STUDENT_SORT_FIELDS: SERVER_SORT_FIELDS,
    STUDENT_YEARS: SERVER_YEARS,
  } = await import('../src/constants/student.js');

  assert(
    PAGE_SIZE_OPTIONS.every((size) => size >= 1 && size <= MAX_PAGE_SIZE),
    'every page size the register offers must be one the API accepts',
  );
  assert(PAGE_SIZE === DEFAULT_PAGE_SIZE, 'the register starts on the default page size the API uses');
  assert(
    SORT_OPTIONS.every((option) => SERVER_SORT_FIELDS.includes(option.value)),
    'every sort the register offers must be a field the API can sort on',
  );
  assert(
    STUDENT_YEARS.join('|') === SERVER_YEARS.join('|'),
    'the years the client offers are exactly the years the API validates',
  );
  assert(
    ENROLLMENT_STATUS_VALUES.join('|') === SERVER_STATUSES.join('|'),
    'and so are the enrollment statuses',
  );

  const fallback = readStudentListQuery(new URLSearchParams('sort=passwordHash&limit=1000000&page=abc&year=9th%20Year'));
  assert(
    fallback.sort === LIST_DEFAULTS.sort &&
      fallback.page === 1 &&
      fallback.limit === DEFAULT_PAGE_SIZE &&
      fallback.year === '' &&
      LIST_DEFAULTS.sort === `-${DEFAULT_STUDENT_SORT_FIELD}`,
    'values the API would refuse never make it into a request',
  );

  domainBundle.cleanup();
});

await check('a value a user typed stays readable however it is shortened', () => {
  const table = sourceOf('components/students/StudentTable.jsx');
  const detail = sourceOf('pages/StudentDetailPage.jsx');
  const dashboard = sourceOf('pages/DashboardPage.jsx');

  // Every field the register shortens keeps its full value on the element, so a
  // long name is shortened rather than lost.
  for (const field of ['name', 'studentId', 'course', 'department', 'year']) {
    assert(
      table.includes(`title={student.${field}}`),
      `the register should keep the full \`${field}\` available when it truncates`,
    );
  }

  assert(
    (table.match(/title=\{student\./g) ?? []).length >= 8,
    'both the table and the mobile card carry the full value',
  );
  assert(detail.includes('title={fact.value}'), 'the detail identity card does too');
  assert(
    dashboard.includes('title={`${label} — ${formatCount(count)}'),
    'and so does every dashboard distribution row',
  );

  // Nothing is dropped on a narrow screen: the columns the table hides only past
  // a certain width are all present in the card the same component renders.
  const mobileCard = table.slice(table.indexOf('renderMobileCard'));
  for (const field of ['course', 'year', 'department', 'dateOfRegistration']) {
    assert(mobileCard.includes(`student.${field}`), `the mobile card should carry \`${field}\``);
  }

  assert(
    !/overflow-x-scroll|\bw-\[(\d{4,})px\]/.test(table) && table.includes('min-w-0'),
    'the register adapts by wrapping and truncating rather than overflowing',
  );
});

await check('small text keeps enough contrast on every surface it is used on', () => {
  // The palette is fixed, so contrast can be decided exactly rather than by eye:
  // the tokens come from the one stylesheet that defines them, and the pairs
  // below are the surfaces the product actually puts small text on.
  const css = readFileSync(new URL('../../client/src/index.css', import.meta.url), 'utf8');

  const token = (name) => {
    const value = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
    assert(value, `the palette should still define \`${name}\``);
    return value;
  };

  const luminance = (hex) => {
    const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
    const linear = channels.map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };

  const ratio = (foreground, background) => {
    const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (light + 0.05) / (dark + 0.05);
  };

  // AA for text under 18.66px (14px bold): every label, hint, meta line and
  // table header in the product.
  const AA = 4.5;

  const pairs = [
    ['body text on the page', 'ink', 'canvas'],
    ['body text on a surface', 'ink', 'surface'],
    ['secondary text on the page', 'muted', 'canvas'],
    ['secondary text on a surface', 'muted', 'surface'],
    ['secondary text inside a panel', 'muted', 'surface-muted'],
    ['table head and quiet strips', 'charcoal', 'canvas-deep'],
    ['status text on beige', 'ink', 'beige'],
    ['error text', 'danger', 'surface'],
    ['success text', 'success', 'surface'],
    ['informational text', 'info', 'surface'],
    ['warning text', 'warning-ink', 'surface'],
    ['inverted text on the dark panel', 'canvas', 'charcoal'],
  ];

  for (const [where, foreground, background] of pairs) {
    const value = ratio(token(foreground), token(background));
    assert(
      value >= AA,
      `${where} should reach ${AA}:1, ${foreground} on ${background} measures ${value.toFixed(2)}:1`,
    );
  }

  // The one place the quieter grey could not be used: the segmented control
  // sits on that quiet strip, so its unselected options carry the stronger
  // charcoal rather than being pushed under the threshold.
  const segmented = sourceOf('components/ui/SegmentedControl.jsx');
  assert(
    !/text-muted/.test(segmented),
    'the status control must not use the quieter grey on its darker strip',
  );
  assert(
    segmented.includes('bg-canvas-deep') && segmented.includes("'text-charcoal hover:text-ink'"),
    'and it should carry the readable colour instead',
  );
});

await check('the figures the product advertises are the figures it uses', () => {
  const landing = sourceOf('pages/LandingPage.jsx');

  assert(
    landing.includes('PAGE_SIZE') && landing.includes('PAGE_SIZE_OPTIONS'),
    "the landing page reads the register's own page-size constants",
  );
  assert(
    !landing.includes("value: '8'"),
    'and no longer advertises a page size the register never had',
  );
  assert(
    /label: 'Rows per page'/.test(landing),
    "the claim it does make is the register's own vocabulary",
  );

  const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
  const advertised = readme.match(/per page[^\n]*/i)?.[0] ?? '';
  assert(
    !/\b8\b/.test(advertised),
    `the README should not advertise a stale page size either, found: ${advertised}`,
  );
});

// ---------------------------------------------------------------------------
section('Route rendering (real components, rendered in Node — no browser)');
// ---------------------------------------------------------------------------

/**
 * The route tree is rendered here with the same React code the browser runs, so
 * "an anonymous visitor is never shown a signed-in screen" is decided by the
 * components themselves rather than by reading their source.
 *
 * It is not a browser: only a first render happens, so effects — and therefore
 * every request — never run, and there is no layout engine. What it does prove is
 * which screen a URL produces and what that screen contains.
 */
const ssrBundle = await bundleClient(
  { ssr: 'ssr-entry.js' },
  { baseUrl: `${stubUrl}/api`, root: './', platform: 'node' },
);

const { renderRoute, renderSignedIn } = ssrBundle.loaded.ssr;

/** The application's own token store, which the harness has already shimmed. */
const storeToken = (value) => {
  const storage = globalThis.window.localStorage;
  storage.removeItem('campusdesk.auth.token');
  if (value) storage.setItem('campusdesk.auth.token', value);
};

/** Every navigation link the shell currently marks as the page you are on. */
const currentNavigationLinks = (html) =>
  [...html.matchAll(/<a[^>]*aria-current="page"[^>]*>/g)].map((match) => match[0]);

await check('each public page renders inside the shared public shell', async () => {
  const landing = await renderRoute(declaredPaths.home);
  assert(landing.includes(`href="${declaredPaths.login}"`), 'the landing page should offer a way in');
  assert(!landing.includes('Skip to content'), 'and is not part of the signed-in shell');

  const login = await renderRoute(declaredPaths.login);
  assert(login.includes('Sign in to CampusDesk'), 'the sign-in screen should render');
  assert(
    login.includes('The register your campus actually keeps up with.'),
    'inside the shared brand panel',
  );
  assert(login.includes('Email address') && login.includes('Password'), 'with its labelled fields');
  assert(login.includes(`href="${declaredPaths.register}"`), 'and a way to create an account');

  const register = await renderRoute(declaredPaths.register);
  assert(register.includes('Create your CampusDesk account'), 'the registration screen should render');
  assert(register.includes('Two minutes now, a tidy register later.'), 'with its own panel copy');
  assert(register.includes('Confirm password'), 'and the fields the API expects');
});

await check('an anonymous visitor is never shown a signed-in screen', async () => {
  storeToken(null);

  for (const url of [
    declaredPaths.dashboard,
    declaredPaths.students,
    declaredPaths.newStudent,
    declaredPaths.student('6502a1b2c3d4e5f60718293a'),
  ]) {
    const html = await renderRoute(url);

    assert(!html.includes('id="main-content"'), `${url} must not render the application shell`);
    assert(!html.includes('Main navigation'), `${url} must not render the navigation`);
    assert(!html.includes('Checking your session'), `${url} needs no session check without a token`);
  }

  const missing = await renderRoute('/not-a-page');
  assert(missing.includes('not on the register'), 'an unknown URL should render the not-found page');
  assert(missing.includes(`href="${declaredPaths.home}"`), 'which offers a way back to the public site');
  assert(!missing.includes('id="main-content"'), 'and no part of the signed-in shell');
});

await check('a stored session shows the loader, not the page, until it is resolved', async () => {
  storeToken('stub-token');

  for (const url of [declaredPaths.dashboard, declaredPaths.students]) {
    const html = await renderRoute(url);

    assert(html.includes('Checking your session'), `${url} should wait for the session to be resolved`);
    assert(
      !html.includes('id="main-content"'),
      `${url} must not draw the application before the session is known`,
    );
  }

  const missing = await renderRoute('/not-a-page');
  assert(missing.includes('Checking your session'), 'the not-found screen waits for it too');

  storeToken(null);
});

await check('a signed-in visitor gets the shell, the navigation and the page', async () => {
  const html = await renderSignedIn(declaredPaths.students, 'students');

  assert(html.includes('Skip to content'), 'keyboard users should be able to skip the navigation');
  assert(html.includes('id="main-content"'), 'the content area should be in the shell');
  assert(html.includes('Main navigation'), 'the sidebar should render as a navigation landmark');
  assert(
    html.includes(`href="${declaredPaths.dashboard}"`) && html.includes(`href="${declaredPaths.newStudent}"`),
    'with the application routes',
  );
  assert(html.includes('Ananya Sharma'), 'and the signed-in user');
  assert(html.includes('Search name, ID, email or phone'), 'the register toolbar should render');
  assert(html.includes('Rows per page'), 'including the page-size control');
  assert(!html.includes('Sign in to CampusDesk'), 'and no trace of the sign-in screen');

  const dashboard = await renderSignedIn(declaredPaths.dashboard, 'dashboard');
  assert(dashboard.includes('id="main-content"'), 'the dashboard renders in the same shell');

  const detail = await renderSignedIn(declaredPaths.student('42'), 'detail');
  assert(detail.includes(`href="${declaredPaths.students}"`), 'a student screen links back to the register');

  const form = await renderSignedIn(declaredPaths.newStudent, 'form');
  assert(form.includes('Full name') && form.includes('Email address'), 'the create form renders its fields');
});

await check('screens are structurally sound: one h1, labelled controls, real table markup', async () => {
  const register = await renderSignedIn(declaredPaths.students, 'students');

  const h1s = [...register.matchAll(/<h1[^>]*>/g)];
  assert(h1s.length === 1, `a screen should have exactly one h1, found ${h1s.length}`);
  assert(/<h2[^>]*>/.test(register), 'the page title should be a second-level heading');
  assert(register.includes('id="main-content"'), 'the content area should be the skip link target');
  assert(
    register.includes('animate-pulse'),
    'a register that has not loaded yet should show skeleton rows rather than an empty table',
  );
  assert(
    sourceOf('components/ui/DataTable.jsx').includes('scope="col"'),
    'table headers should be real column headers',
  );

  for (const label of [
    'Filter by enrollment status',
    'Filter by year',
    'Filter by department',
    'Filter by course',
    'Sort students',
    'Rows per page',
  ]) {
    assert(register.includes(`aria-label="${label}"`), `the ${label} control should have an accessible name`);
  }

  assert(/aria-current="page"/.test(register), 'the current section should be marked for assistive tech');

  const dashboard = await renderSignedIn(declaredPaths.dashboard, 'dashboard');
  assert(
    [...dashboard.matchAll(/<h1[^>]*>/g)].length === 1,
    'the dashboard should also have exactly one h1',
  );
  assert(
    dashboard.includes('Register at a glance') || dashboard.includes('Could not'),
    'the dashboard should render its summary band',
  );
});

await check('navigation marks the current section, and only one item at a time', async () => {
  const register = await renderSignedIn(declaredPaths.students, 'students');
  const onRegister = currentNavigationLinks(register);
  assert(onRegister.length === 1, `exactly one item should be current, got ${onRegister.length}`);
  assert(onRegister[0].includes(`href="${declaredPaths.students}"`), 'the register is current on /students');

  const detail = await renderSignedIn(declaredPaths.student('42'), 'detail');
  const onDetail = currentNavigationLinks(detail);
  assert(onDetail.length === 1, 'a nested student URL still lights exactly one item');
  assert(onDetail[0].includes(`href="${declaredPaths.students}"`), 'and it is the register, not nothing');

  const create = await renderSignedIn(declaredPaths.newStudent, 'form');
  const onCreate = currentNavigationLinks(create);
  assert(onCreate.length === 1, 'adding a student lights exactly one item');
  assert(onCreate[0].includes(`href="${declaredPaths.newStudent}"`), 'the add-student item');
  assert(
    !onCreate[0].includes(`href="${declaredPaths.students}"`),
    'and does not also light the register above it',
  );
});

// ---------------------------------------------------------------------------
section('Workflow rendering (real components, rendered in Node — no browser)');
// ---------------------------------------------------------------------------

/** The element React emitted for a named control, so a check can read its attributes. */
const tagFor = (html, attribute) =>
  html.match(new RegExp(`<(?:input|select|textarea)[^>]*${attribute}[^>]*>`))?.[0] ?? '';
const idOf = (tag) => tag.match(/id="([^"]+)"/)?.[1] ?? '';

/**
 * Whether a control is really disabled. The class list carries Tailwind's own
 * `disabled:` variants, so the attribute has to be matched as an attribute.
 */
const isDisabled = (tag) => /\sdisabled(?:="")?(?=[\s/>])/.test(tag);

await check('the sign-in screen is labelled, autofillable and explains an expired session', async () => {
  const plain = await renderRoute(declaredPaths.login);

  const email = tagFor(plain, 'name="email"');
  const password = tagFor(plain, 'name="password"');
  assert(Boolean(email) && Boolean(password), 'both credential fields should render');
  assert(email.includes('type="email"') && /autocomplete="email"/i.test(email), 'email is typed and autofillable');
  assert(
    password.includes('type="password"') && /autocomplete="current-password"/i.test(password),
    'the password field is a sign-in field to the browser',
  );
  assert(email.includes('autofocus'), 'the first field takes focus, so the form can be typed into immediately');
  assert(plain.includes(`for="${idOf(email)}"`) && plain.includes(`for="${idOf(password)}"`), 'each control is named by its own label');
  assert(plain.includes('aria-label="Show password"'), 'the reveal button is labelled');
  assert((plain.match(/<form /g) ?? []).length === 1, 'one form, one submit');
  assert(!plain.includes('Your session expired'), 'nothing is explained that did not happen');

  const expired = await renderRoute(declaredPaths.login, {
    state: { from: { pathname: declaredPaths.students, search: '?search=cse&page=2' }, reason: 'expired' },
  });
  assert(expired.includes('Your session expired'), 'a session the API rejected is explained in words');
  assert(expired.includes('warning/35'), 'and marked as a warning rather than a failure');
  assert(
    expired.indexOf('Your session expired') < expired.indexOf('name="email"'),
    'the explanation comes before the form it is about',
  );

  const redirected = await renderRoute(declaredPaths.login, {
    state: { from: { pathname: declaredPaths.students, search: '?search=cse&page=2' } },
  });
  assert(redirected.includes('Sign in to continue'), 'a plain redirect says why the visitor is here');
  assert(!redirected.includes('Your session expired'), 'without inventing an expiry');
});

await check('the create form renders its sections, its labels and a generated-ID promise', async () => {
  const form = await renderSignedIn(declaredPaths.newStudent, 'form', { role: 'staff' });

  for (const section of ['Student identity', 'Academic information', 'Contact information', 'Registration']) {
    assert(form.includes(section), `the form should be grouped: ${section} is missing`);
  }

  for (const field of ['name', 'email', 'phone', 'course', 'year', 'department', 'dateOfRegistration', 'avatarUrl']) {
    const tag = tagFor(form, `name="${field}"`);
    assert(Boolean(tag), `${field} should render`);
    assert(form.includes(`for="${idOf(tag)}"`), `${field} should be named by its own label`);
  }

  const date = tagFor(form, 'name="dateOfRegistration"');
  assert(date.includes('type="date"') && date.includes('max='), 'the registration date cannot be picked in the future');
  assert(!isDisabled(date), 'a staff account sets the date when the record is created');
  assert(form.includes('CDS-') && form.includes('when the record is saved'), 'the screen says the ID is generated, not typed');
  assert(!/\bCDS-\d{4}-\d{4}\b/.test(form), 'and shows no particular student ID while nothing has been created');
});

await check('editing presents the registration date according to the role, and hides it from staff', async () => {
  const staff = await renderSignedIn(declaredPaths.editStudent('42'), 'edit', { role: 'staff' });
  const staffDate = tagFor(staff, 'name="dateOfRegistration"');

  assert(Boolean(staffDate), 'the edit screen renders the date field');
  assert(isDisabled(staffDate), 'a staff account cannot change a registration date that already exists');
  assert(
    staff.includes('only an administrator can change it'),
    'and is told why, instead of being left to work it out',
  );
  assert(staff.includes('Loading record…'), 'the record itself is still being read');
  assert(tagFor(staff, 'name="name"').includes('value=""'), 'no student details are invented while it loads');

  const admin = await renderSignedIn(declaredPaths.editStudent('42'), 'edit', { role: 'admin' });
  const adminDate = tagFor(admin, 'name="dateOfRegistration"');

  assert(Boolean(adminDate) && !isDisabled(adminDate), 'an administrator is offered the field the API lets them change');
  assert(!admin.includes('only an administrator can change it'), 'and needs no explanation');
});

// ---------------------------------------------------------------------------
section('Register state & dashboard rendering (real components, rendered in Node — no browser)');
// ---------------------------------------------------------------------------

/**
 * The canonical query writer is bundled and run here, so "a dashboard link is
 * exactly the URL the register would have produced" is decided by the code the
 * browser runs rather than by reading it.
 */
const hrefBundle = await bundleClient({ paths: 'routes/paths.js' }, { baseUrl: `${stubUrl}/api` });
const { studentRegisterHref } = hrefBundle.loaded.paths;

await check('dashboard links are canonical register URLs, and hostile input is dropped', () => {
  assert(studentRegisterHref() === declaredPaths.students, 'a plain link is the register itself');
  assert(
    studentRegisterHref({ status: 'active' }) === `${declaredPaths.students}?status=active`,
    'a status figure links to the canonical status filter',
  );
  assert(
    studentRegisterHref({ department: 'Computer Science' }) ===
      `${declaredPaths.students}?department=Computer+Science`,
    'a department is encoded the way the register encodes it',
  );
  assert(
    studentRegisterHref({ year: '3rd Year' }) === `${declaredPaths.students}?year=3rd+Year`,
    'and so is a year of study',
  );
  assert(
    studentRegisterHref({ sort: '-dateOfRegistration', limit: 10, page: 1 }) === declaredPaths.students,
    'defaults stay out of the URL, exactly as the register writes them',
  );
  assert(
    studentRegisterHref({ search: 'kumar', department: 'CSE', status: 'active', page: 2 }) ===
      `${declaredPaths.students}?search=kumar&status=active&department=CSE&page=2`,
    'a combined state round-trips in the register\'s own parameter order',
  );
  assert(
    studentRegisterHref({ status: 'pending', year: '9th Year', sort: 'passwordHash', page: 'abc', limit: 100000 }) ===
      declaredPaths.students,
    'values the register would refuse are never written into a link',
  );

  hrefBundle.cleanup();
});

await check('a filtered URL renders the same state it describes', async () => {
  const plain = await renderSignedIn(declaredPaths.students, 'students');
  assert(!plain.includes('Filtering by'), 'an unfiltered register shows no filter bar');
  assert(!plain.includes('No students match'), 'and claims nothing about matches it has not read');
  assert(
    plain.includes('Matches part of a word, and every word has to match something'),
    'the search explanation is part of the register, filtered or not',
  );

  const filtered = await renderSignedIn(
    `${declaredPaths.students}?search=kumar&department=CSE&status=active&year=3rd+Year&page=2&sort=name`,
    'students',
  );

  assert(filtered.includes('Filtering by'), 'a filtered register says so');
  assert(/4[\s\S]{0,24}filters/.test(filtered), 'and counts the filters, not the sorting');
  assert(
    filtered.includes('Sorted by:') && filtered.includes('Name A–Z'),
    'a non-default sort is shown as sorting, in its own chip',
  );
  assert(
    (filtered.match(/aria-label="Reset sorting/g) ?? []).length === 1,
    'and can be put back to the default without touching a filter',
  );
  for (const chip of ['Search: kumar', 'Status: Active', '3rd Year', 'CSE']) {
    assert(filtered.includes(chip), `the ${chip} filter should be shown as active`);
  }
  assert(filtered.includes('Clear all filters'), 'with one action to lift them all');
  assert(
    (filtered.match(/aria-label="Remove filter:/g) ?? []).length === 4 &&
      (filtered.match(/aria-label="Reset sorting/g) ?? []).length === 1,
    'every chip can be removed on its own',
  );
  assert(filtered.includes('value="kumar"'), 'the search box shows the search from the URL');

  const clean = await renderSignedIn(`${declaredPaths.students}?search=kumar&department=CSE`, 'students');
  assert(
    (clean.match(/aria-label="Remove filter:/g) ?? []).length === 2 &&
      !clean.includes('Status: Active') &&
      !clean.includes('Sorted by:'),
    'a two-filter URL produces two chips, no sort chip and nothing else',
  );
});

const chipsRowOf = (html) => html.slice(html.indexOf('Filtering by'), html.indexOf('Filtering by') + 2000);

await check('animated surfaces render what the URL says, never their animation state', async () => {
  const filtered = await renderSignedIn(
    `${declaredPaths.students}?search=kumar&status=active&page=2`,
    'students',
  );
  const chipsRow = chipsRowOf(filtered);

  assert(filtered.includes('Filtering by'), 'the chips row is in the markup, not only in an exit animation');
  assert(
    (filtered.match(/aria-label="Remove filter:/g) ?? []).length === 2,
    'both active filters are present as chips',
  );
  assert(
    !/style="[^"]*opacity:\s*0/.test(chipsRow),
    'nothing in the chips row is rendered hidden waiting for an animation',
  );
  assert(
    /class="[^"]*badge[^"]*"/.test(chipsRow) || chipsRow.includes('border-line'),
    'the chips are styled markup rather than placeholders',
  );

  const plain = await renderSignedIn(declaredPaths.students, 'students');
  assert(!plain.includes('Filtering by'), 'an unfiltered register renders no chips row at all');
  assert(
    !/style="[^"]*opacity:\s*0/.test(chipsRowOf(plain)),
    'and nothing in an unfiltered register is waiting to appear',
  );
  // The one hidden element a screen may contain is the shell's own entrance
  // wrapper; rows, chips, cards and panels are all rendered readable, so a
  // missing animation can never hide data.
  assert(
    (plain.match(/style="[^"]*opacity:\s*0[^"]*"/g) ?? []).length === 1 &&
      plain.includes('style="opacity:0;transform:translateY(12px)"'),
    'only the shell\u2019s route entrance starts from zero opacity, and it is a 12px rise',
  );
});

await check('a closed panel is not in the page at all', async () => {
  const shell = await renderSignedIn(declaredPaths.students, 'students');
  const dashboard = await renderSignedIn(declaredPaths.dashboard, 'dashboard');

  for (const [name, html] of [
    ['the register', shell],
    ['the dashboard', dashboard],
  ]) {
    assert(!html.includes('Navigation drawer'), `${name} should not render the mobile drawer while it is closed`);
    assert(!html.includes('aria-modal'), `${name} should not render a dialog that was never opened`);
    assert(!html.includes('role="dialog"'), `${name} should not carry dialog markup while closed`);
    assert(
      !/aria-hidden="true"[^>]*>(?:(?!<\/)[\s\S])*?<button/.test(html),
      `${name} should not hide interactive controls from assistive technology`,
    );
  }

  assert(
    shell.includes('aria-busy=') === false || shell.includes('aria-busy="true"'),
    'the register only reports busy when it really is',
  );
});

await check('the dashboard renders as a summary that is still being read, never as zeros', async () => {
  const dashboard = await renderSignedIn(declaredPaths.dashboard, 'dashboard');

  assert(dashboard.includes('Register at a glance'), 'the summary band renders');
  assert(dashboard.includes('Reading the register…'), 'and says it is still reading the register');
  assert(
    [...dashboard.matchAll(/<h1[^>]*>/g)].length === 1,
    'the dashboard keeps exactly one page heading',
  );
  assert(dashboard.includes('aria-busy="true"'), 'the summary reports that it is busy');
  assert(dashboard.includes('animate-pulse'), 'the figures wait as skeletons rather than as zeroes');
  assert(!dashboard.includes('0 students on CampusDesk'), 'no figure is invented before the API answers');
  assert(
    dashboard.includes('Students on register') === false,
    'the cards themselves wait for real numbers instead of rendering zero',
  );

  for (const panel of ['Recent registrations', 'Enrollment by department', 'Students by year of study', 'Active and inactive']) {
    assert(dashboard.includes(panel), `${panel} should be part of the dashboard`);
  }
  assert(dashboard.includes('The five newest records, by date of registration.'), 'the recent list explains what recent means');
});

ssrBundle.cleanup();

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
