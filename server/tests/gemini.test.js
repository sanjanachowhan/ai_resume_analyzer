import test from 'node:test';
import assert from 'node:assert/strict';
import { createGeminiProvider, toGeminiRequest, readGeminiResponse } from '../src/ai/geminiClient.js';
import { generateStructured } from '../src/ai/aiService.js';
import { pingSchema } from '../src/ai/schemas.js';

const okBody = (text, extra = {}) => ({
  candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }],
  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
  modelVersion: 'gemini-test-1',
  ...extra,
});

// A fake "fetch" that replays scripted HTTP responses and records every call.
function fakeFetch(...responses) {
  const calls = [];
  const fn = async (url, options) => {
    calls.push({ url, options });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)];
    if (typeof next === 'function') return next(options);
    return { ok: next.status < 400, status: next.status, json: async () => next.body };
  };
  fn.calls = calls;
  return fn;
}
const reply = (status, body) => ({ status, body });
const make = (fetchImpl, extra = {}) =>
  createGeminiProvider({ getApiKey: () => 'secret-key', getModel: () => 'gemini-test', fetchImpl, retryDelayMs: 1, ...extra });
const messages = [
  { role: 'system', content: 'be brief' },
  { role: 'user', content: 'hi' },
];

// ---------- request building ----------

test('messages are mapped to the Gemini format', () => {
  const body = toGeminiRequest(
    [...messages, { role: 'assistant', content: 'oops' }, { role: 'user', content: 'again' }],
    3000,
    true
  );
  assert.deepEqual(body.systemInstruction, { parts: [{ text: 'be brief' }] });
  assert.deepEqual(body.contents.map((c) => c.role), ['user', 'model', 'user']);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.equal(body.generationConfig.maxOutputTokens, 3000);
});

test('the API key goes in a header, never in the URL, and the model is in the path', async () => {
  const fetchImpl = fakeFetch(reply(200, okBody('{}')));
  await make(fetchImpl).generateText({ messages });
  const { url, options } = fetchImpl.calls[0];
  assert.match(url, /models\/gemini-test:generateContent$/);
  assert.ok(!url.includes('secret-key'));
  assert.equal(options.headers['x-goog-api-key'], 'secret-key');
  assert.equal(JSON.parse(options.body).generationConfig.responseMimeType, 'application/json');
});

test('small output limits are raised so thinking models still have room to answer', async () => {
  const fetchImpl = fakeFetch(reply(200, okBody('{}')));
  await make(fetchImpl).generateText({ messages, maxOutputTokens: 500 });
  assert.ok(JSON.parse(fetchImpl.calls[0].options.body).generationConfig.maxOutputTokens >= 2048);
});

// ---------- responses ----------

test('a normal answer is returned with usage and model', async () => {
  const result = await make(fakeFetch(reply(200, okBody('{"ok":true}')))).generateText({ messages });
  assert.equal(result.text, '{"ok":true}');
  assert.equal(result.model, 'gemini-test-1');
  assert.deepEqual(result.usage, { inputTokens: 10, outputTokens: 5 });
});

test('reasoning ("thought") parts are ignored', () => {
  const data = { candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: '{"a":1}' }] } }] };
  assert.equal(readGeminiResponse(data).text, '{"a":1}');
});

test('empty and blocked answers become controlled errors', () => {
  assert.throws(() => readGeminiResponse({ candidates: [{ finishReason: 'MAX_TOKENS' }] }), { code: 'AI_TRUNCATED' });
  assert.throws(() => readGeminiResponse({ candidates: [{ finishReason: 'SAFETY' }] }), { code: 'AI_CONTENT_BLOCKED' });
  assert.throws(() => readGeminiResponse({ promptFeedback: { blockReason: 'OTHER' } }), { code: 'AI_CONTENT_BLOCKED' });
  assert.throws(() => readGeminiResponse({}), { code: 'AI_EMPTY_RESPONSE' });
});

// ---------- errors ----------

test('HTTP errors map to friendly codes and never expose Google details', async () => {
  const cases = [
    [403, 'AI_AUTH_FAILED', 503],
    [400, 'AI_AUTH_FAILED', 503, 'API key not valid. Please pass a valid API key.'],
    [404, 'AI_MODEL_UNAVAILABLE', 503],
    [429, 'AI_RATE_LIMITED', 503],
    [400, 'AI_BAD_REQUEST', 502, 'Something else'],
  ];
  for (const [status, code, httpStatus, message = 'details'] of cases) {
    const fetchImpl = fakeFetch(reply(status, { error: { message } }));
    await assert.rejects(make(fetchImpl).generateText({ messages }), (err) => {
      assert.equal(err.code, code);
      assert.equal(err.statusCode, httpStatus);
      assert.ok(!err.message.includes(message), 'raw provider text must not reach the user');
      return true;
    });
    assert.equal(fetchImpl.calls.length, 1); // these are not retried
  }
});

test('temporary 503 errors are retried and then succeed', async () => {
  const fetchImpl = fakeFetch(reply(503, { error: { message: 'overloaded' } }), reply(503, {}), reply(200, okBody('{"ok":true}')));
  const result = await make(fetchImpl).generateText({ messages });
  assert.equal(result.text, '{"ok":true}');
  assert.equal(fetchImpl.calls.length, 3);
});

test('persistent 503 errors give up after the retries', async () => {
  const fetchImpl = fakeFetch(reply(503, {}));
  await assert.rejects(make(fetchImpl).generateText({ messages }), { code: 'AI_PROVIDER_ERROR' });
  assert.equal(fetchImpl.calls.length, 3);
});

test('a missing key is reported without calling Google', async () => {
  const fetchImpl = fakeFetch(reply(200, okBody('{}')));
  const provider = createGeminiProvider({ getApiKey: () => '', getModel: () => 'm', fetchImpl });
  assert.equal(provider.isConfigured(), false);
  await assert.rejects(provider.generateText({ messages }), { code: 'AI_NOT_CONFIGURED' });
  assert.equal(fetchImpl.calls.length, 0);
});

test('network failures and timeouts are reported clearly', async () => {
  const down = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(make(down).generateText({ messages }), { code: 'AI_UNREACHABLE' });

  const hang = (options) => new Promise((_, reject) => {
    options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
  await assert.rejects(make(fakeFetch(hang), { timeoutMs: 20 }).generateText({ messages }), { code: 'AI_TIMEOUT', statusCode: 504 });
});

// ---------- works behind the shared validation layer ----------

test('Gemini plugs into generateStructured, including fenced JSON and retry', async () => {
  const fetchImpl = fakeFetch(
    reply(200, okBody('I am not sure')),
    reply(200, okBody('```json\n{"ok": true, "message": "pong"}\n```'))
  );
  const { data, meta } = await generateStructured({
    prompt: { system: 's', user: 'u' },
    schema: pingSchema,
    provider: make(fetchImpl),
  });
  assert.deepEqual(data, { ok: true, message: 'pong' });
  assert.equal(meta.provider, 'gemini');
  assert.equal(meta.attempts, 2);

  // the retry sent the previous answer back as a "model" turn
  const secondBody = JSON.parse(fetchImpl.calls[1].options.body);
  assert.deepEqual(secondBody.contents.map((c) => c.role), ['user', 'model', 'user']);
});
