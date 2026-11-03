// End-to-end tests of the REST API against a real database.   npm run test:integration
//
// - The app is started inside the test on a random port; you do NOT need `npm run dev`.
// - It uses the database from server/.env (or TEST_DATABASE_URL if you set one) and only ever
//   creates users whose email starts with "apitest-". Those users and their data are deleted afterwards.
// - The AI is switched off for these tests (no API key), so no AI calls are made and nothing is spent.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Settings must be in place BEFORE the app is imported.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = '';
process.env.GEMINI_API_KEY = '';
await import('dotenv/config');

const dbHost = (() => {
  try { return new URL(process.env.DATABASE_URL).hostname; } catch { return ''; }
})();
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(dbHost) && !process.env.ALLOW_REMOTE_TEST_DB) {
  throw new Error(`Refusing to run API tests against a non-local database (${dbHost || 'unknown'}). Set TEST_DATABASE_URL to a local test database.`);
}

const fixture = (name) => fs.readFileSync(new URL(`../fixtures/${name}`, import.meta.url));
const RUN = Date.now();
const PASSWORD = 'Passw0rd123';
const JOB_TEXT = `Backend Developer

Responsibilities
• Build REST APIs using Node.js and PostgreSQL

Requirements
• Strong Node.js and PostgreSQL skills
• 3+ years of experience building REST APIs
• Bachelor's degree in Computer Science

Nice to have
• Docker and AWS experience`;

let server;
let prisma;
let base;

async function call(method, path, { token, json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }
  const res = await fetch(`${base}${path}`, { method, headers, body });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, data, text };
}

const fileForm = (field, name, buffer, type) => {
  const form = new FormData();
  form.append(field, new Blob([buffer], { type }), name);
  return form;
};

before(async () => {
  ({ prisma } = await import('../../src/config/prisma.js'));
  const { default: app } = await import('../../src/app.js');
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await prisma?.user.deleteMany({ where: { email: { startsWith: 'apitest-' } } }); // cascades to all their data
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
  await prisma?.$disconnect();
});

const state = {};

describe('health and error handling', () => {
  it('reports that the API and database are up', async () => {
    const res = await call('GET', '/health');
    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'ok');
    assert.equal(res.data.database, 'connected');
  });

  it('unknown routes give a JSON 404 with no stack trace', async () => {
    const res = await call('GET', '/does-not-exist');
    assert.equal(res.status, 404);
    assert.equal(res.data.error.code, 'NOT_FOUND');
    assert.ok(!/node_modules|\.js:\d+/.test(res.text));
  });
});

describe('authentication', () => {
  const email = `apitest-a-${RUN}@example.com`;

  it('rejects invalid registrations with field-level messages', async () => {
    const weak = await call('POST', '/auth/register', { json: { name: 'Test A', email, password: 'short' } });
    assert.equal(weak.status, 400);
    assert.equal(weak.data.error.code, 'VALIDATION_ERROR');
    assert.ok(weak.data.error.details.some((d) => d.field === 'password'));

    const badEmail = await call('POST', '/auth/register', { json: { name: 'Test A', email: 'nope', password: PASSWORD } });
    assert.equal(badEmail.status, 400);
  });

  it('registers a user and never returns the password or its hash', async () => {
    const res = await call('POST', '/auth/register', { json: { name: 'Test A', email, password: PASSWORD } });
    assert.equal(res.status, 201);
    assert.ok(res.data.token);
    assert.equal(res.data.user.email, email);
    assert.ok(!res.text.includes('passwordHash'));
    assert.ok(!res.text.includes(PASSWORD));
    state.tokenA = res.data.token;
  });

  it('refuses a duplicate email', async () => {
    const res = await call('POST', '/auth/register', { json: { name: 'Test A', email, password: PASSWORD } });
    assert.equal(res.status, 409);
    assert.equal(res.data.error.code, 'EMAIL_TAKEN');
  });

  it('login fails the same way for a wrong password and an unknown email', async () => {
    const wrong = await call('POST', '/auth/login', { json: { email, password: 'Wrong-pass-1' } });
    const unknown = await call('POST', '/auth/login', { json: { email: `apitest-nobody-${RUN}@example.com`, password: PASSWORD } });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.data.error.message, unknown.data.error.message);
  });

  it('login works and the token opens /auth/me', async () => {
    const login = await call('POST', '/auth/login', { json: { email: email.toUpperCase(), password: PASSWORD } });
    assert.equal(login.status, 200);
    const me = await call('GET', '/auth/me', { token: login.data.token });
    assert.equal(me.status, 200);
    assert.equal(me.data.user.email, email);
  });

  it('protected routes need a valid token', async () => {
    for (const path of ['/auth/me', '/resumes', '/jobs', '/analysis', '/analysis/stats']) {
      const none = await call('GET', path);
      assert.equal(none.status, 401, path);
      const bad = await call('GET', path, { token: 'not-a-real-token' });
      assert.equal(bad.status, 401, path);
    }
  });
});

describe('resumes', () => {
  it('upload needs a login, a file, and a real PDF or DOCX', async () => {
    const anon = await call('POST', '/resumes/upload', { form: fileForm('resume', 'a.pdf', fixture('jane-doe-resume.pdf'), 'application/pdf') });
    assert.equal(anon.status, 401);

    const noFile = await call('POST', '/resumes/upload', { token: state.tokenA, form: new FormData() });
    assert.equal(noFile.status, 400);
    assert.equal(noFile.data.error.code, 'NO_FILE');

    const txt = await call('POST', '/resumes/upload', { token: state.tokenA, form: fileForm('resume', 'resume.txt', Buffer.from('hello world'), 'text/plain') });
    assert.equal(txt.status, 400);
    assert.equal(txt.data.error.code, 'INVALID_FILE_TYPE');

    const fake = await call('POST', '/resumes/upload', { token: state.tokenA, form: fileForm('resume', 'fake.pdf', Buffer.from('this is plain text pretending to be a pdf'), 'application/pdf') });
    assert.equal(fake.status, 400);
    assert.equal(fake.data.error.code, 'INVALID_FILE_TYPE');
  });

  it('uploads a PDF, extracts its text and parses it', async () => {
    const res = await call('POST', '/resumes/upload', { token: state.tokenA, form: fileForm('resume', 'jane-doe-resume.pdf', fixture('jane-doe-resume.pdf'), 'application/pdf') });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.data.duplicate, false);
    assert.match(res.data.resume.rawText, /Jane Doe/);
    assert.ok(res.data.resume.parsedData.sectionsFound.length >= 3);
    assert.ok(res.data.resume.parsedData.profile.skills.some((s) => s.name === 'React'));
    state.resumeId = res.data.resume.id;
  });

  it('uploading the same resume again returns the saved one instead of a duplicate', async () => {
    const res = await call('POST', '/resumes/upload', { token: state.tokenA, form: fileForm('resume', 'again.pdf', fixture('jane-doe-resume.pdf'), 'application/pdf') });
    assert.equal(res.status, 200);
    assert.equal(res.data.duplicate, true);
    assert.equal(res.data.resume.id, state.resumeId);
  });

  it('uploads a DOCX', async () => {
    const res = await call('POST', '/resumes/upload', {
      token: state.tokenA,
      form: fileForm('resume', 'alex-kim-resume.docx', fixture('alex-kim-resume.docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.data.resume.fileType, 'docx');
    state.docxResumeId = res.data.resume.id;
  });

  it('lists resumes without the heavy text, and opens one', async () => {
    const list = await call('GET', '/resumes', { token: state.tokenA });
    assert.equal(list.status, 200);
    assert.equal(list.data.resumes.length, 2);
    assert.ok(!('rawText' in list.data.resumes[0]));

    const one = await call('GET', `/resumes/${state.resumeId}`, { token: state.tokenA });
    assert.equal(one.status, 200);
    assert.ok(one.data.resume.rawText.length > 100);
  });
});

describe('job descriptions', () => {
  it('validates input', async () => {
    const empty = await call('POST', '/jobs', { token: state.tokenA, json: { title: 'Dev', description: '' } });
    assert.equal(empty.status, 400);
    assert.ok(empty.data.error.details.some((d) => d.field === 'description'));

    const short = await call('POST', '/jobs', { token: state.tokenA, json: { title: 'Dev', description: 'too short' } });
    assert.equal(short.status, 400);
  });

  it('extracts text from an uploaded job document without saving anything', async () => {
    const res = await call('POST', '/jobs/extract', {
      token: state.tokenA,
      form: fileForm('file', 'backend-job.docx', fixture('backend-job.docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    });
    assert.equal(res.status, 200, res.text);
    assert.match(res.data.text, /Backend Developer/);
  });

  it('saves a job and analyzes its requirements', async () => {
    const res = await call('POST', '/jobs', { token: state.tokenA, json: { title: 'Backend Developer', company: 'Acme', description: JOB_TEXT } });
    assert.equal(res.status, 201);
    state.jobId = res.data.job.id;
    const parsed = res.data.job.parsedData;
    assert.equal(parsed.version, 1);
    assert.ok(parsed.requiredSkills.includes('Node.js'));
    assert.ok(parsed.preferredSkills.includes('Docker'));
    assert.equal(parsed.yearsExperience.min, 3);
  });

  it('lists jobs with a preview and opens one in full', async () => {
    const list = await call('GET', '/jobs', { token: state.tokenA });
    assert.equal(list.status, 200);
    assert.ok(list.data.jobs[0].preview.length > 0);
    assert.ok(!('description' in list.data.jobs[0]));
    const one = await call('GET', `/jobs/${state.jobId}`, { token: state.tokenA });
    assert.equal(one.data.job.title, 'Backend Developer');
  });
});

describe('analysis', () => {
  it('previews an instant, deterministic score', async () => {
    const res = await call('POST', '/analysis/preview', { token: state.tokenA, json: { resumeId: state.resumeId, jobId: state.jobId } });
    assert.equal(res.status, 200, res.text);
    const { result } = res.data;
    assert.ok(Number.isInteger(result.overallScore) && result.overallScore >= 0 && result.overallScore <= 100);
    assert.ok(result.skills.matched.some((s) => s.skill === 'Node.js'));
    assert.ok(result.skills.missing.some((s) => s.skill === 'AWS'));
  });

  it('the same input always gives the same score', async () => {
    const again = await call('POST', '/analysis/preview', { token: state.tokenA, json: { resumeId: state.resumeId, jobId: state.jobId } });
    const first = await call('POST', '/analysis/preview', { token: state.tokenA, json: { resumeId: state.resumeId, jobId: state.jobId } });
    assert.equal(first.data.result.overallScore, again.data.result.overallScore);
  });

  it('rejects incomplete requests and unknown ids', async () => {
    const missing = await call('POST', '/analysis', { token: state.tokenA, json: { resumeId: state.resumeId } });
    assert.equal(missing.status, 400);
    const unknown = await call('POST', '/analysis', { token: state.tokenA, json: { resumeId: 'nope', jobId: state.jobId } });
    assert.equal(unknown.status, 404);
  });

  it('with the AI switched off, the score report is still saved and says why', async () => {
    const res = await call('POST', '/analysis', { token: state.tokenA, json: { resumeId: state.resumeId, jobId: state.jobId } });
    assert.equal(res.status, 201, res.text);
    const { analysis } = res.data;
    assert.equal(analysis.aiAvailable, false);
    assert.equal(analysis.aiMeta.error.code, 'AI_NOT_CONFIGURED');
    assert.ok(analysis.scores.overall > 0);
    assert.ok(analysis.skills.missing.length > 0);
    assert.ok(analysis.suggestions.length > 0);
    state.analysisId = analysis.id;

    // asking again completes the same saved row instead of creating a duplicate
    const again = await call('POST', '/analysis', { token: state.tokenA, json: { resumeId: state.resumeId, jobId: state.jobId } });
    assert.equal(again.data.analysis.id, state.analysisId);
  });

  it('a saved analysis can be opened, listed, counted and searched', async () => {
    const one = await call('GET', `/analysis/${state.analysisId}`, { token: state.tokenA });
    assert.equal(one.status, 200);
    assert.equal(one.data.analysis.job.title, 'Backend Developer');

    const list = await call('GET', '/analysis?q=backend&sort=score&pageSize=5', { token: state.tokenA });
    assert.equal(list.status, 200);
    assert.equal(list.data.total, 1);
    assert.equal(list.data.items[0].id, state.analysisId);

    const none = await call('GET', '/analysis?q=zzz-no-match', { token: state.tokenA });
    assert.equal(none.data.total, 0);

    const stats = await call('GET', '/analysis/stats', { token: state.tokenA });
    assert.equal(stats.data.total, 1);
    assert.equal(typeof stats.data.averageScore, 'number');
    assert.equal(stats.data.highest.id, state.analysisId);
  });

  it('odd list parameters are handled safely', async () => {
    const res = await call('GET', '/analysis?page=-3&pageSize=100000&sort=DROP%20TABLE', { token: state.tokenA });
    assert.equal(res.status, 200);
    assert.equal(res.data.page, 1);
    assert.equal(res.data.pageSize, 50);
  });
});

describe('data isolation between users', () => {
  const emailB = `apitest-b-${RUN}@example.com`;

  it("another user cannot see, use or delete the first user's data", async () => {
    const reg = await call('POST', '/auth/register', { json: { name: 'Test B', email: emailB, password: PASSWORD } });
    assert.equal(reg.status, 201);
    const tokenB = reg.data.token;

    for (const path of [`/resumes/${state.resumeId}`, `/jobs/${state.jobId}`, `/analysis/${state.analysisId}`]) {
      assert.equal((await call('GET', path, { token: tokenB })).status, 404, path);
    }
    for (const path of [`/resumes/${state.resumeId}`, `/jobs/${state.jobId}`, `/analysis/${state.analysisId}`]) {
      assert.equal((await call('DELETE', path, { token: tokenB })).status, 404, `DELETE ${path}`);
    }

    const cross = await call('POST', '/analysis', { token: tokenB, json: { resumeId: state.resumeId, jobId: state.jobId } });
    assert.equal(cross.status, 404);

    assert.equal((await call('GET', '/resumes', { token: tokenB })).data.resumes.length, 0);
    assert.equal((await call('GET', '/jobs', { token: tokenB })).data.jobs.length, 0);
    assert.equal((await call('GET', '/analysis', { token: tokenB })).data.total, 0);
    assert.equal((await call('GET', '/analysis/stats', { token: tokenB })).data.total, 0);

    // ...and the first user's data is untouched
    assert.equal((await call('GET', `/analysis/${state.analysisId}`, { token: state.tokenA })).status, 200);
  });
});

describe('deleting', () => {
  it('deletes an analysis, a job and a resume, and they are gone afterwards', async () => {
    assert.equal((await call('DELETE', `/analysis/${state.analysisId}`, { token: state.tokenA })).status, 200);
    assert.equal((await call('GET', `/analysis/${state.analysisId}`, { token: state.tokenA })).status, 404);
    assert.equal((await call('DELETE', `/analysis/${state.analysisId}`, { token: state.tokenA })).status, 404);

    assert.equal((await call('DELETE', `/jobs/${state.jobId}`, { token: state.tokenA })).status, 200);
    assert.equal((await call('GET', `/jobs/${state.jobId}`, { token: state.tokenA })).status, 404);

    assert.equal((await call('DELETE', `/resumes/${state.resumeId}`, { token: state.tokenA })).status, 200);
    assert.equal((await call('GET', `/resumes/${state.resumeId}`, { token: state.tokenA })).status, 404);
  });
});
