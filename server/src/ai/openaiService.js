import OpenAI from 'openai';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

let client;

function getClient() {
  if (!env.OPENAI_API_KEY) {
    throw new AppError('The AI service is not configured on the server.', 503, 'AI_NOT_CONFIGURED');
  }
  // The key stays on the server: it is read from .env and never sent to the browser.
  client ??= new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 60000, maxRetries: 2 });
  return client;
}

// Converts SDK errors into safe, user-friendly API errors. Details are logged on the server only.
function toAppError(err) {
  if (err instanceof AppError) return err;
  console.error('OpenAI request failed:', err.status ?? '', err.name, err.message);

  if (err.status === 401 || err.status === 403) {
    return new AppError('The AI service rejected the server credentials.', 503, 'AI_AUTH_FAILED');
  }
  if (err.status === 404) {
    return new AppError(`The AI model "${env.OPENAI_MODEL}" is not available for this account.`, 503, 'AI_MODEL_UNAVAILABLE');
  }
  if (err.status === 429) {
    return new AppError('The AI service is busy or its usage quota has been reached. Try again later.', 503, 'AI_RATE_LIMITED');
  }
  if (err.name === 'APIConnectionTimeoutError') {
    return new AppError('The AI service took too long to respond. Please try again.', 504, 'AI_TIMEOUT');
  }
  if (err.name === 'APIConnectionError') {
    return new AppError('Could not reach the AI service. Please try again.', 503, 'AI_UNREACHABLE');
  }
  return new AppError('The AI service returned an error. Please try again.', 502, 'AI_PROVIDER_ERROR');
}

// Provider interface shared with Gemini:
//   generateText({ messages: [{ role, content }], maxOutputTokens, json }) -> { text, model, usage }
export const openaiProvider = {
  name: 'openai',
  model: () => env.OPENAI_MODEL,
  isConfigured: () => Boolean(env.OPENAI_API_KEY),

  async generateText({ messages, maxOutputTokens = 4000, json = true }) {
    const openai = getClient();
    try {
      const completion = await openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages,
        max_completion_tokens: maxOutputTokens,
        ...(json && { response_format: { type: 'json_object' } }),
      });

      const choice = completion.choices?.[0];
      const text = choice?.message?.content;
      if (!text) {
        const reason = choice?.finish_reason === 'length' ? 'AI_TRUNCATED' : 'AI_EMPTY_RESPONSE';
        throw new AppError('The AI did not return a usable answer. Please try again.', 502, reason);
      }

      return {
        text,
        model: completion.model,
        usage: {
          inputTokens: completion.usage?.prompt_tokens ?? null,
          outputTokens: completion.usage?.completion_tokens ?? null,
        },
      };
    } catch (err) {
      throw toAppError(err);
    }
  },
};
