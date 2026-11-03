import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthService } from '../src/services/authCore.service.js';
import { createRequireAuth } from '../src/middleware/authCore.js';

// Simple stand-ins for bcrypt, JWT and the database.
function setup() {
  const users = [];
  const log = { hashed: [], compared: [], findUnique: [] };

  const hasher = {
    hash: async (pw) => { log.hashed.push(pw); return `hashed:${pw}`; },
    hashSync: (pw) => `hashed:${pw}`,
    compare: async (pw, hash) => { log.compared.push(hash); return hash === `hashed:${pw}`; },
  };
  const tokens = {
    sign: (id) => `token-for-${id}`,
    verify: (token) => {
      if (!token.startsWith('token-for-')) throw new Error('invalid');
      return { sub: token.slice('token-for-'.length) };
    },
  };
  const db = {
    user: {
      create: async ({ data, select }) => {
        if (users.some((u) => u.email === data.email)) throw Object.assign(new Error('unique'), { code: 'P2002' });
        const user = { id: `u${users.length + 1}`, createdAt: new Date(), ...data };
        users.push(user);
        return Object.fromEntries(Object.keys(select).map((k) => [k, user[k]])); // honours "select"
      },
      findUnique: async ({ where, select }) => {
        log.findUnique.push({ where, select });
        const user = users.find((u) => u.email === where.email || u.id === where.id) ?? null;
        if (!user || !select) return user;
        return Object.fromEntries(Object.keys(select).map((k) => [k, user[k]]));
      },
    },
  };
  return { users, log, service: createAuthService({ db, hasher, tokens }) };
}

const alice = { name: 'Alice', email: 'alice@example.com', password: 'Passw0rd123' };

// ---------- registration ----------

test('registering stores a hash, never the password, and returns a token', async () => {
  const { users, service } = setup();
  const { user, token } = await service.registerUser(alice);

  assert.equal(users[0].passwordHash, 'hashed:Passw0rd123');
  assert.notEqual(users[0].passwordHash, alice.password);
  assert.equal(token, `token-for-${user.id}`);
  assert.deepEqual(Object.keys(user).sort(), ['createdAt', 'email', 'id', 'name']);
  assert.ok(!JSON.stringify(user).includes('hashed'));
});

test('registering the same email twice is a 409', async () => {
  const { service } = setup();
  await service.registerUser(alice);
  await assert.rejects(service.registerUser(alice), { code: 'EMAIL_TAKEN', statusCode: 409 });
});

test('unexpected database errors are not disguised as "email taken"', async () => {
  const { service } = setup();
  const broken = createAuthService({
    db: { user: { create: async () => { throw new Error('connection lost'); } } },
    hasher: { hash: async () => 'h', hashSync: () => 'h', compare: async () => false },
    tokens: { sign: () => 't', verify: () => ({}) },
  });
  await assert.rejects(broken.registerUser(alice), { message: 'connection lost' });
  assert.ok(service); // (the working service is unaffected)
});

// ---------- login ----------

test('login with the right password returns the user and a token', async () => {
  const { service } = setup();
  await service.registerUser(alice);
  const { user, token } = await service.loginUser({ email: alice.email, password: alice.password });
  assert.equal(user.email, alice.email);
  assert.ok(token.startsWith('token-for-'));
  assert.ok(!('passwordHash' in user));
});

test('wrong password and unknown email give the same error', async () => {
  const { service } = setup();
  await service.registerUser(alice);

  const wrongPassword = await service.loginUser({ email: alice.email, password: 'nope' }).catch((e) => e);
  const unknownEmail = await service.loginUser({ email: 'ghost@example.com', password: 'Passw0rd123' }).catch((e) => e);

  for (const err of [wrongPassword, unknownEmail]) {
    assert.equal(err.code, 'INVALID_CREDENTIALS');
    assert.equal(err.statusCode, 401);
  }
  assert.equal(wrongPassword.message, unknownEmail.message); // an attacker can't tell which emails exist
});

test('an unknown email still costs one password comparison (no timing leak)', async () => {
  const { service, log } = setup();
  await service.loginUser({ email: 'ghost@example.com', password: 'whatever' }).catch(() => {});
  assert.equal(log.compared.length, 1);
});

// ---------- requireAuth middleware ----------

function run(headers, { verifyToken, getUserById } = {}) {
  const { service } = setup();
  const middleware = createRequireAuth({
    verifyToken: verifyToken ?? ((t) => { if (!t.startsWith('token-for-')) throw new Error('bad'); return { sub: t.slice(10) }; }),
    getUserById: getUserById ?? (async (id) => (id === 'u1' ? { id: 'u1', name: 'Alice' } : null)),
  });
  const req = { headers };
  let outcome;
  return middleware(req, {}, (err) => { outcome = err ?? 'ok'; }).then(() => ({ req, outcome, service }));
}

test('a valid token lets the request through and attaches the user', async () => {
  const { req, outcome } = await run({ authorization: 'Bearer token-for-u1' });
  assert.equal(outcome, 'ok');
  assert.deepEqual(req.user, { id: 'u1', name: 'Alice' });
});

test('missing or malformed Authorization headers are rejected', async () => {
  for (const headers of [{}, { authorization: '' }, { authorization: 'Bearer' }, { authorization: 'Basic abc' }, { authorization: 'token-for-u1' }]) {
    const { outcome, req } = await run(headers);
    assert.equal(outcome.code, 'UNAUTHORIZED', JSON.stringify(headers));
    assert.equal(outcome.statusCode, 401);
    assert.equal(req.user, undefined);
  }
});

test('invalid or expired tokens are rejected', async () => {
  const { outcome } = await run({ authorization: 'Bearer garbage' });
  assert.equal(outcome.code, 'INVALID_TOKEN');
  assert.equal(outcome.statusCode, 401);
});

test('a valid token for a deleted account is rejected', async () => {
  const { outcome } = await run({ authorization: 'Bearer token-for-u999' });
  assert.equal(outcome.code, 'INVALID_TOKEN');
});
