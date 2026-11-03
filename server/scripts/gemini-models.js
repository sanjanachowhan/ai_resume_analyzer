// Lists the Gemini models your API key can use:  npm run ai:models
// Pick one and set GEMINI_MODEL in server/.env.
import 'dotenv/config';

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error('GEMINI_API_KEY is not set in server/.env');
  process.exit(1);
}

const names = [];
let pageToken = '';
do {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`;
  const response = await fetch(url, { headers: { 'x-goog-api-key': key } });
  if (!response.ok) {
    console.error(`Request failed (HTTP ${response.status}). Check that GEMINI_API_KEY is correct.`);
    process.exit(1);
  }
  const data = await response.json();
  for (const model of data.models ?? []) {
    if (model.supportedGenerationMethods?.includes('generateContent')) names.push(model.name.replace(/^models\//, ''));
  }
  pageToken = data.nextPageToken ?? '';
} while (pageToken);

const text = names.filter((n) => n.startsWith('gemini') && !/(image|tts|embedding|audio|live|robotics|computer-use|native)/.test(n)).sort();

console.log('Text models available to your key:\n');
for (const name of text) console.log(`  ${/flash/.test(name) ? '*' : ' '} ${name}`);
console.log('\n* = "flash" models: fast and cheap, usually the best choice for the free tier.');
console.log('Set one in server/.env, e.g.  GEMINI_MODEL=<name>   then run: npm run ai:test');
