import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { z } from 'zod';
import { buildErrorResponse } from '../src/utils/errorResponse.js';
import { AppError } from '../src/utils/AppError.js';
import { inspectZip, assertSafeZip } from '../src/utils/zipInspector.js';
import { productionProblems } from '../src/config/envChecks.js';
import { registerSchema } from '../src/validators/auth.validators.js';
import { detectFileType } from '../src/utils/fileValidation.js';
import { buildFakeZip, zipBomb } from './helpers/zipHelper.js';

// ---------- error responses: friendly for users, silent about internals ----------

test('validation errors list the fields that need fixing', () => {
  const result = z.object({ email: z.string().email() }).safeParse({ email: 'nope' });
  const { status, body, log } = buildErrorResponse(result.error);
  assert.equal(status, 400);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.equal(body.error.details[0].field, 'email');
  assert.equal(log, false);
});

test('our own errors keep their status and message', () => {
  const { status, body, log } = buildErrorResponse(new AppError('Nope.', 409, 'EMAIL_TAKEN'));
  assert.deepEqual([status, body.error.code, body.error.message, log], [409, 'EMAIL_TAKEN', 'Nope.', false]);
  assert.equal(buildErrorResponse(new AppError('Down', 503, 'AI_DOWN')).log, true); // server-side problems are logged
});

test('bad JSON and oversized bodies are client errors, not crashes', () => {
  const badJson = Object.assign(new SyntaxError('Unexpected token } in JSON at position 5'), { type: 'entity.parse.failed', status: 400 });
  const parse = buildErrorResponse(badJson);
  assert.equal(parse.status, 400);
  assert.equal(parse.body.error.code, 'INVALID_JSON');
  assert.ok(!JSON.stringify(parse.body).includes('Unexpected token')); // the parser's wording is not exposed

  const tooBig = Object.assign(new Error('request entity too large'), { type: 'entity.too.large', status: 413 });
  assert.equal(buildErrorResponse(tooBig).status, 413);

  const other = Object.assign(new Error('unsupported charset "X"'), { type: 'charset.unsupported', status: 415 });
  const generic = buildErrorResponse(other);
  assert.equal(generic.status, 415);
  assert.equal(generic.body.error.code, 'BAD_REQUEST');
});

test('database outages become a polite 503', () => {
  const init = Object.assign(new Error("Can't reach database server at `localhost:5432`"), { name: 'PrismaClientInitializationError' });
  const timeout = Object.assign(new Error('Timed out fetching a new connection'), { code: 'P2024' });
  for (const err of [init, timeout, Object.assign(new Error('x'), { code: 'P1001' })]) {
    const { status, body, log } = buildErrorResponse(err);
    assert.equal(status, 503);
    assert.equal(body.error.code, 'DATABASE_UNAVAILABLE');
    assert.ok(!JSON.stringify(body).includes('localhost'));
    assert.equal(log, true);
  }
  assert.equal(buildErrorResponse(Object.assign(new Error('gone'), { code: 'P2025' })).status, 404);
});

test('unknown errors never leak internals, unless debugging is on', () => {
  const secret = new Error('SELECT * FROM "User" WHERE password = ... at /home/app/server.js:42');
  const production = buildErrorResponse(secret);
  assert.equal(production.status, 500);
  assert.equal(production.body.error.code, 'INTERNAL_ERROR');
  assert.ok(!JSON.stringify(production.body).includes('SELECT'));
  assert.ok(!JSON.stringify(production.body).includes('/home/app'));
  assert.equal(production.log, true);
  assert.ok(!('debug' in production.body.error));

  assert.match(buildErrorResponse(secret, { debug: true }).body.error.debug, /SELECT/); // only for local development
  assert.equal(buildErrorResponse(null).status, 500);
  assert.equal(buildErrorResponse('a string').status, 500);
});

// ---------- zip-bomb protection ----------

test('real documents pass the zip check', () => {
  for (const name of ['alex-kim-resume.docx', 'backend-job.docx']) {
    const result = inspectZip(fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
    assert.equal(result.ok, true, name);
    assert.ok(result.entries > 3);
  }
});

test('an archive claiming to expand to gigabytes is rejected', () => {
  assert.equal(inspectZip(zipBomb()).ok, false);
  assert.match(inspectZip(zipBomb()).reason, /too much data/);
  assert.throws(() => assertSafeZip(zipBomb()), { code: 'UNSAFE_FILE', statusCode: 422 });
});

test('absurd compression ratios and file counts are rejected', () => {
  const ratio = buildFakeZip([{ compressed: 20_000, uncompressed: 50 * 1024 * 1024 }]); // 2600:1 and 50 MB
  assert.match(inspectZip(ratio).reason, /ratio/);

  const manyFiles = buildFakeZip(Array.from({ length: 2500 }, (_, i) => ({ name: `f${i}.xml` })));
  assert.match(inspectZip(manyFiles).reason, /too many files/);

  assert.equal(inspectZip(buildFakeZip([{ compressed: 1000, uncompressed: 8000 }])).ok, true); // a normal ratio is fine
});

test('broken or non-zip data is reported, not crashed on', () => {
  assert.equal(inspectZip(Buffer.from('hello')).ok, false);
  assert.equal(inspectZip(Buffer.alloc(0)).ok, false);
  const truncated = zipBomb().subarray(0, 40);
  assert.equal(inspectZip(truncated).ok, false);
});

test('a damaged DOCX gets the ordinary "corrupted" message, not an "unsafe" accusation', () => {
  const damaged = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4]); // starts like a zip but is not one
  assert.equal(inspectZip(damaged).unsafe, false);
  assert.throws(() => assertSafeZip(damaged), { code: 'UNREADABLE_FILE', statusCode: 422 });
  assert.equal(inspectZip(zipBomb()).unsafe, true); // only dangerous sizes count as unsafe
});

test('a zip bomb still looks like a DOCX to the file-type check, so the zip inspector is what stops it', () => {
  assert.equal(detectFileType(zipBomb(), 'resume.docx'), 'docx');
});

// ---------- production settings ----------

const good = {
  NODE_ENV: 'production',
  JWT_SECRET: 'f3a9c27d41b8e65a90d2c47b1e8f6a35d09b7c42e1f8a6d3b5c07e94a21d8f60',
  CLIENT_URL: 'https://app.example-resume.com',
  DATABASE_URL: 'postgresql://app_user:Zx8qL2mN4vB7@db.internal:5432/resume',
};

test('a safe production setup has no problems, and development is never blocked', () => {
  assert.deepEqual(productionProblems(good), []);
  assert.deepEqual(productionProblems({ ...good, NODE_ENV: 'development', JWT_SECRET: 'short', CLIENT_URL: 'http://localhost:5173' }), []);
});

test('unsafe production settings are caught', () => {
  assert.match(productionProblems({ ...good, JWT_SECRET: 'tooshort1234567' }).join(), /32 characters/);
  assert.match(productionProblems({ ...good, JWT_SECRET: 'replace-with-a-long-random-string-at-least-32-chars' }).join(), /placeholder/);
  assert.match(productionProblems({ ...good, CLIENT_URL: 'http://myapp.com' }).join(), /https/);
  assert.match(productionProblems({ ...good, DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/x' }).join(), /default development password/);
  assert.equal(productionProblems({ ...good, JWT_SECRET: 'x', CLIENT_URL: 'http://a', DATABASE_URL: 'postgresql://postgres:postgres@h/x' }).length >= 3, true);
});

// ---------- passwords ----------

test('passwords are limited by BYTES, matching what bcrypt actually uses', () => {
  const base = { name: 'Alice', email: 'a@example.com' };
  const accented = `${'é'.repeat(36)}1a`; // 38 characters but 74 bytes
  assert.equal(accented.length <= 72, true);
  assert.equal(registerSchema.safeParse({ ...base, password: accented }).success, false);
  assert.equal(registerSchema.safeParse({ ...base, password: `${'é'.repeat(30)}1a` }).success, true); // 62 bytes
});

test('unknown fields in a registration are dropped (no mass assignment)', () => {
  const data = registerSchema.parse({ name: 'Alice', email: 'a@example.com', password: 'Passw0rd123', id: 'hacked', role: 'admin', passwordHash: 'x' });
  assert.deepEqual(Object.keys(data).sort(), ['email', 'name', 'password']);
});
