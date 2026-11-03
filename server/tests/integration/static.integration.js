// Checks that the server can serve the built website (SERVE_CLIENT=true) without breaking the API.
// Uses a small fake "build" in a temporary folder, so you do not need to build the real website.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'resumeiq-dist-'));
fs.mkdirSync(path.join(dist, 'assets'));
fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><body><div id="root">SPA-SHELL</div></body></html>');
fs.writeFileSync(path.join(dist, 'assets', 'app-abc123.js'), 'console.log("hello");');
fs.writeFileSync(path.join(dist, 'robots.txt'), 'User-agent: *');

process.env.NODE_ENV = 'test';
process.env.SERVE_CLIENT = 'true';
process.env.CLIENT_DIST_DIR = dist;
await import('dotenv/config');

let server;
let base;
const get = (p, options) => fetch(`${base}${p}`, options);

before(async () => {
  const { default: app } = await import('../../src/app.js');
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
  fs.rmSync(dist, { recursive: true, force: true });
});

describe('serving the website', () => {
  it('the home page is the app shell and is never cached', async () => {
    const res = await get('/');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(await res.text(), /SPA-SHELL/);
    assert.match(res.headers.get('cache-control'), /no-cache/);
  });

  it('page addresses that belong to the React router get the app shell', async () => {
    for (const p of ['/history', '/analysis/some-id', '/login']) {
      const res = await get(p);
      assert.equal(res.status, 200, p);
      assert.match(await res.text(), /SPA-SHELL/, p);
    }
  });

  it('built files are cached for a long time', async () => {
    const res = await get('/assets/app-abc123.js');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('cache-control'), /max-age=31536000/);
    assert.match(res.headers.get('cache-control'), /immutable/);
  });

  it('other files in the build folder are served, and a missing asset is a real 404', async () => {
    assert.equal((await get('/robots.txt')).status, 200);
    const missing = await get('/assets/missing.js');
    assert.equal(missing.status, 404);
    assert.ok(!(await missing.text()).includes('SPA-SHELL'));
  });

  it('pages carry the security headers', async () => {
    const res = await get('/');
    assert.ok(res.headers.get('content-security-policy'));
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-powered-by'), null);
  });
});

describe('the API is not affected', () => {
  it('unknown API routes are still JSON 404s, never the app shell', async () => {
    const res = await get('/api/does-not-exist');
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, 'NOT_FOUND');
    assert.match(res.headers.get('cache-control'), /no-store/);
  });

  it('only GET requests receive the app shell', async () => {
    const res = await get('/history', { method: 'POST' });
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, 'NOT_FOUND');
  });
});
