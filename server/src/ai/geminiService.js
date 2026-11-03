import { env } from '../config/env.js';
import { createGeminiProvider } from './geminiClient.js';

// Google Gemini provider. It has the same interface as the OpenAI provider,
// so switching is just AI_PROVIDER=gemini in server/.env.
export const geminiProvider = createGeminiProvider({
  getApiKey: () => env.GEMINI_API_KEY,
  getModel: () => env.GEMINI_MODEL,
});
