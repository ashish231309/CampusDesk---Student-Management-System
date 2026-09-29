/**
 * CampusDesk foundation check.
 *
 * Boots the real Express application on an ephemeral port and exercises the API
 * surface, the response envelope and the pure service helpers. It deliberately
 * does not need MongoDB: anything that requires the database reports its state
 * through GET /api/health/ready instead. Run with `npm run verify`.
 */
process.env.NODE_ENV = 'test';

const { once } = await import('node:events');

const { createApp } = await import('../src/app.js');
const { env } = await import('../src/config/env.js');
const { buildStudentQuery, resolvePagination, resolveSort } = await import(
  '../src/services/studentService.js'
);
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

const get = (path, options) => fetch(`${baseUrl}${path}`, options);

const post = (path, body) =>
  fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const server = createApp().listen(0, '127.0.0.1');
await once(server, 'listening');
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

console.log(`\nCampusDesk foundation check — API on ${baseUrl}\n`);

console.log('Configuration');
await check('environment loads with sane defaults', () => {
  assert(env.isTest, 'NODE_ENV should be test during verification');
  assert(env.port > 0, 'port should be a positive number');
  assert(env.apiPrefix === '/api', `unexpected API prefix: ${env.apiPrefix}`);
  assert(env.database.uri.startsWith('mongodb'), 'database URI should be a MongoDB connection string');
  assert(env.security.allowedOrigins.length > 0, 'at least one client origin must be allowed');
});

console.log('\nService helpers (pure)');
await check('buildStudentQuery filters by search, status, year and department', () => {
  const query = buildStudentQuery({
    search: 'ananya',
    status: 'active',
    year: '3rd Year',
    department: 'Computer Science',
  });

  assert(Array.isArray(query.$or) && query.$or.length === 5, 'search should span five fields');
  assert(query.enrollmentStatus === 'active', 'status filter missing');
  assert(query.year === '3rd Year', 'year filter missing');
  assert(query.department instanceof RegExp, 'department should be a case-insensitive match');
});

await check('buildStudentQuery escapes regular-expression input', () => {
  const query = buildStudentQuery({ search: 'a+b(' });
  const pattern = query.$or[0].name.source;
  assert(pattern.includes('\\+') && pattern.includes('\\('), 'search input must be escaped');
});

await check('buildStudentQuery returns an empty filter without input', () => {
  assert(Object.keys(buildStudentQuery()).length === 0, 'empty input should produce an empty filter');
});

await check('pagination is clamped to sensible bounds', () => {
  assert(resolvePagination({ page: -3, limit: 5000 }).limit === 100, 'limit should cap at 100');
  assert(resolvePagination({ page: 0 }).page === 1, 'page should floor at 1');
  assert(resolvePagination({ page: 3, limit: 10 }).skip === 20, 'skip should be derived from page and limit');
});

await check('unknown sort fields fall back to newest first', () => {
  assert(resolveSort('name') === '-name', 'ascending name should map to Mongoose syntax');
  assert(resolveSort('drop collection') === '-dateOfRegistration', 'unknown sort must be ignored');
});

await check('student ID prefix is the CampusDesk prefix', () => {
  assert(STUDENT_ID_PREFIX === 'CDS', `unexpected student ID prefix: ${STUDENT_ID_PREFIX}`);
});

console.log('\nHTTP surface');
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

await check('GET /api/health/ready reports database state', async () => {
  const response = await get('/api/health/ready');
  const body = await response.json();
  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(typeof body.data.database.isConnected === 'boolean', 'database flags missing');
  console.log(`      database: ${body.data.database.state}`);
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
  assert(body.error.code === 'VALIDATION_ERROR', 'expected a validation error');
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

await check('login with valid input reaches the not-implemented placeholder', async () => {
  const response = await post('/api/auth/login', {
    email: 'admin@campusdesk.edu',
    password: 'CampusDesk1',
  });
  const body = await response.json();
  assert(response.status === 501, `expected 501, received ${response.status}`);
  assert(body.error.code === 'NOT_IMPLEMENTED', 'expected the placeholder code');
});

await check('the student area is protected', async () => {
  const response = await get('/api/students');
  const body = await response.json();
  assert(response.status === 401, `expected 401, received ${response.status}`);
  assert(body.error.code === 'UNAUTHORIZED', 'expected an authorization error');
});

await check('an invalid bearer token is rejected', async () => {
  const response = await get('/api/students/stats', {
    headers: { Authorization: 'Bearer not.a.real.token' },
  });
  const body = await response.json();
  assert(response.status === 401, `expected 401, received ${response.status}`);
  assert(body.error.code === 'UNAUTHORIZED', `unexpected code: ${body.error.code}`);
});

await check('a student detail request is gated before its id is validated', async () => {
  const response = await get('/api/students/not-a-mongo-id');
  const body = await response.json();
  assert(response.status === 401, `expected 401, received ${response.status}`);
  assert(body.error.code === 'UNAUTHORIZED', `unexpected code: ${body.error.code}`);
});

server.close();

const failed = results.filter((result) => !result.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed${failed.length ? `, ${failed.length} failed` : ''}\n`,
);

process.exit(failed.length > 0 ? 1 : 0);
