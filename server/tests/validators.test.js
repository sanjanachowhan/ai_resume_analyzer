import test from 'node:test';
import assert from 'node:assert/strict';
import { registerSchema, loginSchema } from '../src/validators/auth.validators.js';
import { createJobSchema, MAX_JOB_DESCRIPTION_LENGTH } from '../src/validators/job.validators.js';
import { previewSchema, analyzeSchema } from '../src/validators/analysis.validators.js';
import { validate } from '../src/middleware/validate.js';

const firstIssue = (result) => result.error.issues[0];
const messages = (result) => result.error.issues.map((i) => i.message);

// ---------- authentication ----------

test('registration: valid input is normalized (trimmed name, lower-cased email)', () => {
  const result = registerSchema.safeParse({ name: '  Alice  ', email: '  Alice@Example.COM ', password: 'Passw0rd123' });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { name: 'Alice', email: 'alice@example.com', password: 'Passw0rd123' });
});

test('registration: weak passwords are rejected with a helpful message', () => {
  const base = { name: 'Alice', email: 'a@example.com' };
  assert.match(messages(registerSchema.safeParse({ ...base, password: 'short1' })).join(), /at least 8/);
  assert.match(messages(registerSchema.safeParse({ ...base, password: '12345678' })).join(), /letter/);
  assert.match(messages(registerSchema.safeParse({ ...base, password: 'abcdefgh' })).join(), /number/);
  assert.match(messages(registerSchema.safeParse({ ...base, password: 'a1'.repeat(40) })).join(), /at most 72/);
  assert.equal(registerSchema.safeParse({ ...base, password: 'Passw0rd' }).success, true);
});

test('registration: bad names and emails are rejected', () => {
  assert.equal(registerSchema.safeParse({ name: 'A', email: 'a@example.com', password: 'Passw0rd123' }).success, false);
  assert.equal(registerSchema.safeParse({ name: 'Alice', email: 'not-an-email', password: 'Passw0rd123' }).success, false);
  assert.equal(registerSchema.safeParse({ name: 'Alice', password: 'Passw0rd123' }).success, false);
  assert.equal(registerSchema.safeParse({}).success, false);
});

test('login: needs a valid email and a password, and lower-cases the email', () => {
  assert.equal(loginSchema.parse({ email: 'ALICE@Example.com', password: 'x' }).email, 'alice@example.com');
  assert.equal(loginSchema.safeParse({ email: 'alice@example.com', password: '' }).success, false);
  assert.equal(loginSchema.safeParse({ email: 'nope', password: 'x' }).success, false);
});

// ---------- job descriptions ----------

const LONG = 'We need a developer who knows React and Node.js to build our internal tools.';

test('job: valid input is cleaned, and an empty company becomes null', () => {
  const data = createJobSchema.parse({ title: '  Developer ', company: '   ', description: `  ${LONG}\r\n\r\n\r\n\r\nMore.  ` });
  assert.equal(data.title, 'Developer');
  assert.equal(data.company, null);
  assert.ok(!data.description.includes('\r'));
  assert.ok(!/\n{3,}/.test(data.description));
  assert.equal(createJobSchema.parse({ title: 'Dev', description: LONG }).company, null); // company is optional
});

test('job: required fields and length limits give clear messages', () => {
  const empty = createJobSchema.safeParse({ title: 'Dev', description: '   ' });
  assert.equal(firstIssue(empty).message, 'Job description is required');

  const short = createJobSchema.safeParse({ title: 'Dev', description: 'hello' });
  assert.match(firstIssue(short).message, /too short/);

  const long = createJobSchema.safeParse({ title: 'Dev', description: 'x'.repeat(MAX_JOB_DESCRIPTION_LENGTH + 1) });
  assert.match(firstIssue(long).message, /too long/);

  assert.match(firstIssue(createJobSchema.safeParse({ title: 'D', description: LONG })).message, /at least 2/);
  assert.equal(createJobSchema.safeParse({ description: LONG }).success, false);
});

// ---------- analysis requests ----------

test('analysis requests need both ids; "force" defaults to false', () => {
  assert.equal(previewSchema.safeParse({ resumeId: 'r1' }).success, false);
  assert.equal(previewSchema.safeParse({ resumeId: '', jobId: 'j1' }).success, false);
  assert.deepEqual(analyzeSchema.parse({ resumeId: 'r1', jobId: 'j1' }), { resumeId: 'r1', jobId: 'j1', force: false });
  assert.equal(analyzeSchema.parse({ resumeId: 'r1', jobId: 'j1', force: true }).force, true);
  assert.equal(analyzeSchema.safeParse({ resumeId: 'r1', jobId: 'j1', force: 'yes' }).success, false);
});

// ---------- the validate() middleware ----------

test('validate() passes cleaned data on, or hands a validation error to the error handler', () => {
  const middleware = validate(loginSchema);

  const good = { body: { email: ' A@Example.com ', password: 'x' } };
  let outcome;
  middleware(good, {}, (err) => { outcome = err ?? 'ok'; });
  assert.equal(outcome, 'ok');
  assert.equal(good.body.email, 'a@example.com');

  const bad = { body: { email: 'nope' } };
  middleware(bad, {}, (err) => { outcome = err; });
  assert.equal(outcome.name, 'ZodError');
  assert.ok(outcome.issues.length >= 1);
});
