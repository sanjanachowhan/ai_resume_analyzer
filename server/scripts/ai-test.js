// Checks your AI setup from the terminal:  npm run ai:test
import 'dotenv/config';
import { generateStructured, getProvider, getProviderName } from '../src/ai/aiService.js';
import { pingSchema } from '../src/ai/schemas.js';

try {
  const provider = await getProvider();
  console.log(`Provider: ${getProviderName()} | model: ${provider.model()} | key set: ${provider.isConfigured() ? 'yes' : 'NO'}`);

  const started = Date.now();
  const { data, meta } = await generateStructured({
    provider,
    schema: pingSchema,
    maxOutputTokens: 1000,
    prompt: {
      system: 'You are a connectivity test. Reply with a single JSON object and nothing else.',
      user: 'Reply with exactly this JSON: {"ok": true, "message": "pong"}',
    },
  });
  console.log(`Success in ${Date.now() - started} ms (model ${meta.model}). Reply:`, data);
} catch (err) {
  console.error(`FAILED [${err.code ?? 'ERROR'}]: ${err.message}`);
  process.exitCode = 1;
}
