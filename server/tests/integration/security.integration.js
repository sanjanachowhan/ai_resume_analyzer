// Attack-style checks against the running API.   npm run test:integration
// Same safety rules as api.integration.js: local database only, only "apitest-" users, AI switched off.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { zipBomb } from '../helpers/zipHelper.js';

if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = '';
process.env.GEMINI_API_KEY = '';
await import('dotenv/config');

const dbHost = (() => {
  try { return new URL(process.env.DATABASE_URL).hostname; } catch { return ''; }
})();
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(dbHost) && !process.env.ALLOW_REMOTE_TEST_DB) {
  throw new Error(`Refusing to run against a non-local database (${dbHost || 'unknown'}). Set TEST_DATABASE_URL to a local test database.`);
}

const RUN = Date.now();
const PASSWORD = 'Passw0rd123';
const ALLOWED_ORIGIN = new URL(process.env.CLIENT_URL || 'http://localhost:5173').origin;
const MAX_MB = Number(process.env.MAX_FILE_SIZE_MB || 5);

let server;
let prisma;
let base;

async function call(method, path, { token, json, rawBody, form, headers: extra = {} } = {}) {
  const headers = { ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (rawBody !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = rawBody;
  } else if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }
  const res = await fetch(`${base}${path}`, { method, headers, body });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, data, text, headers: res.headers };
}

const fileForm = (name, buffer, type) => {
  const form = new FormData();
  form.append('resume', new Blob([buffer], { type }), name);
  return form;
};

// Builds a JWT by hand so we can forge bad ones.
const b64 = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
function makeToken(payload, { secret = process.env.JWT_SECRET, alg = 'HS256' } = {}) {
  const head = b64({ alg, typ: 'JWT' });
  const body = b64(payload);
  if (alg === 'none') return `${head}.${body}.`;
  const signature = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${signature}`;
}
const inAnHour = () => Math.floor(Date.now() / 1000) + 3600;

before(async () => {
  ({ prisma } = await import('../../src/config/prisma.js'));
  const { default: app } = await import('../../src/app.js');
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await prisma?.user.deleteMany({ where: { email: { startsWith: 'apitest-' } } });
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
  await prisma?.$disconnect();
});

const state = {};

describe('security headers', () => {
  it('sends protective headers and hides the framework', async () => {
    const res = await call('GET', '/health');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.get('strict-transport-security'));
    assert.ok(res.headers.get('x-frame-options') || res.headers.get('content-security-policy'));
  });

  it('API responses are never cached or answered with 304', async () => {
    const res = await call('GET', '/health');
    assert.match(res.headers.get('cache-control'), /no-store/);
    assert.equal(res.headers.get('etag'), null);
  });
});

describe('CORS', () => {
  const preflight = (origin) =>
    fetch(`${base}/auth/login`, {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,authorization' },
    });

  it('allows the real website', async () => {
    const res = await preflight(ALLOWED_ORIGIN);
    assert.equal(res.headers.get('access-control-allow-origin'), ALLOWED_ORIGIN);
    assert.match(res.headers.get('access-control-allow-headers'), /authorization/i);
  });

  it('never grants access to another website', async () => {
    const res = await preflight('https://evil.example');
    const allowed = res.headers.get('access-control-allow-origin');
    assert.notEqual(allowed, 'https://evil.example');
    assert.notEqual(allowed, '*');
    assert.equal(res.headers.get('access-control-allow-credentials'), null);
  });
});

describe('hostile requests', () => {
  it('malformed JSON is a 400, not a server error', async () => {
    const res = await call('POST', '/auth/login', { rawBody: '{"email": "a@b.com", ' });
    assert.equal(res.status, 400);
    assert.equal(res.data.error.code, 'INVALID_JSON');
    assert.ok(!/SyntaxError|Unexpected|node_modules/.test(res.text));
  });

  it('huge request bodies are refused', async () => {
    const res = await call('POST', '/auth/login', { rawBody: JSON.stringify({ email: 'a'.repeat(300_000), password: 'x' }) });
    assert.equal(res.status, 413);
    assert.equal(res.data.error.code, 'PAYLOAD_TOO_LARGE');
  });

  it('injection-style input is rejected by validation, never reaching the database', async () => {
    for (const email of ["admin@example.com' OR '1'='1", "' OR 1=1 --", '"; DROP TABLE "User"; --']) {
      const res = await call('POST', '/auth/login', { json: { email, password: 'x' } });
      assert.equal(res.status, 400, email);
    }
    const objectEmail = await call('POST', '/auth/login', { json: { email: { $ne: null }, password: { $gt: '' } } });
    assert.equal(objectEmail.status, 400);
  });

  it('extra fields cannot be used to pick your own id or role', async () => {
    const email = `apitest-mass-${RUN}@example.com`;
    const res = await call('POST', '/auth/register', { json: { name: 'Mass Test', email, password: PASSWORD, id: 'hacked', role: 'admin' } });
    assert.equal(res.status, 201);
    assert.notEqual(res.data.user.id, 'hacked');
    assert.ok(!('role' in res.data.user));
  });

  it('errors never contain stack traces or file paths', async () => {
    const res = await call('GET', '/resumes/%00%00');
    assert.ok(!/node_modules|\.js:\d+|at .*\(/.test(res.text));
  });
});

describe('token security', () => {
  it('registers a user to test with', async () => {
    const res = await call('POST', '/auth/register', { json: { name: 'Token Test', email: `apitest-token-${RUN}@example.com`, password: PASSWORD } });
    assert.equal(res.status, 201);
    state.userId = res.data.user.id;
    state.goodToken = res.data.token;
  });

  it('a correctly signed token works (confirms the forging helper is accurate)', async () => {
    const res = await call('GET', '/auth/me', { token: makeToken({ sub: state.userId, exp: inAnHour() }) });
    assert.equal(res.status, 200);
  });

  it('forged and altered tokens are rejected', async () => {
    const cases = {
      'expired': makeToken({ sub: state.userId, exp: Math.floor(Date.now() / 1000) - 60 }),
      'wrong secret': makeToken({ sub: state.userId, exp: inAnHour() }, { secret: 'a-completely-different-secret-value' }),
      'algorithm "none"': makeToken({ sub: state.userId, exp: inAnHour() }, { alg: 'none' }),
      'unknown user': makeToken({ sub: crypto.randomUUID(), exp: inAnHour() }),
      'payload swapped': (() => {
        const [head, , sig] = state.goodToken.split('.');
        return `${head}.${b64({ sub: crypto.randomUUID(), exp: inAnHour() })}.${sig}`;
      })(),
      'garbage': 'abc.def.ghi',
    };
    for (const [name, token] of Object.entries(cases)) {
      const res = await call('GET', '/auth/me', { token });
      assert.equal(res.status, 401, name);
      assert.equal(res.data.error.code, 'INVALID_TOKEN', name);
    }
  });
});

describe('upload protection', () => {
  it('files over the size limit are refused', async () => {
    const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc((MAX_MB + 1) * 1024 * 1024, 32)]);
    const res = await call('POST', '/resumes/upload', { token: state.goodToken, form: fileForm('big.pdf', big, 'application/pdf') });
    assert.equal(res.status, 413);
    assert.equal(res.data.error.code, 'FILE_TOO_LARGE');
  });

  it('a zip bomb disguised as a resume is refused before it is opened', async () => {
    const res = await call('POST', '/resumes/upload', {
      token: state.goodToken,
      form: fileForm('bomb.docx', zipBomb(), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    });
    assert.equal(res.status, 422);
    assert.equal(res.data.error.code, 'UNSAFE_FILE');
  });

  it('the same protection covers job description uploads', async () => {
    const form = new FormData();
    form.append('file', new Blob([zipBomb()]), 'bomb.docx');
    const res = await call('POST', '/jobs/extract', { token: state.goodToken, form });
    assert.equal(res.status, 422);
    assert.equal(res.data.error.code, 'UNSAFE_FILE');
  });
});

// These come last: they deliberately trip the rate limits, which would disturb the tests above.
describe('rate limiting', () => {
  it('repeated wrong passwords are slowed down', async () => {
    const email = `apitest-token-${RUN}@example.com`;
    const statuses = [];
    for (let i = 0; i < 30; i++) statuses.push((await call('POST', '/auth/login', { json: { email, password: `Wrong-pass-${i}` } })).status);
    assert.ok(statuses.includes(429), `no 429 in: ${statuses.join(',')}`);
    assert.ok(statuses.slice(0, 5).every((s) => s === 401)); // the first few are ordinary failures
  });

  it('a blocked client is told how long to wait', async () => {
    const res = await call('POST', '/auth/login', { json: { email: `apitest-token-${RUN}@example.com`, password: 'Wrong-pass-x' } });
    assert.equal(res.status, 429);
    assert.equal(res.data.error.code, 'RATE_LIMITED');
    assert.ok(res.headers.get('retry-after'));
  });

  it('mass account creation is slowed down', async () => {
    const statuses = [];
    for (let i = 0; i < 15; i++) {
      statuses.push((await call('POST', '/auth/register', { json: { name: 'Spam', email: `apitest-spam-${RUN}-${i}@example.com`, password: PASSWORD } })).status);
    }
    assert.ok(statuses.includes(429), `no 429 in: ${statuses.join(',')}`);
  });
});
