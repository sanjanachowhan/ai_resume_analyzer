import { AppError } from '../utils/AppError.js';
import { parseAiJson, summarizeZodError } from './jsonResponse.js';

// Provider modules are loaded on demand, so the rest of the app never depends on one specific vendor.
const PROVIDERS = {
  openai: async () => (await import('./openaiService.js')).openaiProvider,
  gemini: async () => (await import('./geminiService.js')).geminiProvider,
};

export function getProviderName() {
  const name = (process.env.AI_PROVIDER || 'openai').toLowerCase();
  if (!PROVIDERS[name]) {
    throw new AppError(`Unknown AI provider "${name}". Use "openai" or "gemini".`, 500, 'AI_MISCONFIGURED');
  }
  return name;
}

export const getProvider = async (name = getProviderName()) => PROVIDERS[name]();

// Which providers are set up. Never includes API keys.
export async function getAiStatus() {
  const active = getProviderName();
  const providers = {};
  for (const name of Object.keys(PROVIDERS)) {
    const provider = await getProvider(name);
    providers[name] = { configured: provider.isConfigured(), model: provider.model() };
  }
  return { activeProvider: active, providers };
}

const MAX_ATTEMPTS = 2;

// Sends a prompt, then makes sure the answer is valid JSON that matches `schema`.
// If it is not, the model is told what was wrong and asked once more before we give up.
//   prompt: { system, user }   schema: a Zod schema   provider: optional (used by tests)
export async function generateStructured({ prompt, schema, maxOutputTokens = 4000, provider }) {
  const ai = provider ?? (await getProvider());
  const messages = [
    { role: 'system', content: prompt.system },
    { role: 'user', content: prompt.user },
  ];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { text, model, usage } = await ai.generateText({ messages, maxOutputTokens, json: true });

    let problem;
    const parsed = parseAiJson(text);
    if (parsed.ok) {
      const checked = schema.safeParse(parsed.value);
      if (checked.success) {
        return { data: checked.data, meta: { provider: ai.name, model, usage, attempts: attempt } };
      }
      problem = summarizeZodError(checked.error);
    } else {
      problem = parsed.error;
    }

    console.error(`AI response rejected (attempt ${attempt}/${MAX_ATTEMPTS}): ${problem}`);
    messages.push(
      { role: 'assistant', content: text },
      { role: 'user', content: `Your reply could not be used. Problem: ${problem} Reply again with ONLY the corrected JSON object.` }
    );
  }

  throw new AppError('The AI returned an answer we could not use. Please try again.', 502, 'AI_INVALID_RESPONSE');
}
