// Quick speed test for Gemini models:  node scripts/gemini-raw.js model-one model-two ...
// Each model gets 45 seconds. Your key is never printed.
import 'dotenv/config';

const key = process.env.GEMINI_API_KEY;
if (!key) { console.error('GEMINI_API_KEY is not set'); process.exit(1); }
const models = process.argv.slice(2);
if (!models.length) models.push(process.env.GEMINI_MODEL);

for (const model of models) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: pong' }] }] }),
      signal: controller.signal,
    });
    const raw = await res.text();
    const ms = Date.now() - started;
    let data = null;
    try { data = JSON.parse(raw); } catch {}
    console.log(`${model}: HTTP ${res.status} in ${ms} ms`);
    if (res.ok && data) {
      const part = data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
      console.log(`   answer: ${part ?? '(none)'} | finish: ${data.candidates?.[0]?.finishReason} | tokens: ${JSON.stringify(data.usageMetadata)}`);
    } else {
      console.log(`   raw reply: ${raw.slice(0, 300) || '(empty)'}`);
    }
  } catch (err) {
    console.log(`${model}: FAILED after ${Date.now() - started} ms (${err.name})`);
  } finally {
    clearTimeout(timer);
  }
}
