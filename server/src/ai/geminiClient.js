import { AppError } from '../utils/AppError.js';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_RETRIES = 2; // for temporary server-side failures (500/503)
// Newer Gemini models "think" before answering and that counts against the limit,
// so very small limits can leave no room for the answer itself.
const MIN_OUTPUT_TOKENS = 2048;

// Our provider-neutral messages -> Gemini request body.
//   system messages  -> systemInstruction
//   assistant        -> role "model"
export function toGeminiRequest(messages, maxOutputTokens, json) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

  return {
    ...(system && { systemInstruction: { parts: [{ text: system }] } }),
    contents,
    generationConfig: {
      maxOutputTokens,
      ...(json && { responseMimeType: 'application/json' }),
    },
  };
}

// Gemini response body -> { text, usage, model }
export function readGeminiResponse(data) {
  if (data?.promptFeedback?.blockReason) {
    throw new AppError('The AI could not process this content.', 502, 'AI_CONTENT_BLOCKED');
  }

  const candidate = data?.candidates?.[0];
  // Skip "thought" parts (the model's reasoning summary); keep only the real answer.
  const text = (candidate?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join('');

  if (!text) {
    const reason = candidate?.finishReason;
    const code = reason === 'MAX_TOKENS' ? 'AI_TRUNCATED' : reason === 'SAFETY' ? 'AI_CONTENT_BLOCKED' : 'AI_EMPTY_RESPONSE';
    throw new AppError('The AI did not return a usable answer. Please try again.', 502, code);
  }

  return {
    text,
    model: data.modelVersion ?? null,
    usage: {
      inputTokens: data.usageMetadata?.promptTokenCount ?? null,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
    },
  };
}

// Turns an HTTP error from Google into a safe API error. Details are logged on the server only.
export function toHttpError(status, payload, model) {
  const message = payload?.error?.message ?? '';
  console.error('Gemini request failed:', status, message);

  if (status === 401 || status === 403 || (status === 400 && /api key/i.test(message))) {
    return new AppError('The AI service rejected the server credentials.', 503, 'AI_AUTH_FAILED');
  }
  if (status === 404) {
    return new AppError(`The AI model "${model}" is not available for this account.`, 503, 'AI_MODEL_UNAVAILABLE');
  }
  if (status === 429) {
    return new AppError('The AI service usage limit has been reached. Wait a little and try again.', 503, 'AI_RATE_LIMITED');
  }
  if (status >= 500) {
    return new AppError('The AI service is temporarily overloaded. Please try again.', 502, 'AI_PROVIDER_ERROR');
  }
  return new AppError('The AI service could not handle the request. Please try again.', 502, 'AI_BAD_REQUEST');
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Builds a provider with the same interface as the OpenAI one.
// Plain HTTPS is used (no extra package). The key is sent in a header, never in the URL.
export function createGeminiProvider({
  getApiKey,
  getModel,
  fetchImpl = globalThis.fetch,
  timeoutMs = 60000,
  retryDelayMs = 1000,
}) {
  return {
    name: 'gemini',
    model: () => getModel(),
    isConfigured: () => Boolean(getApiKey()),

    async generateText({ messages, maxOutputTokens = 4000, json = true }) {
      const apiKey = getApiKey();
      if (!apiKey) {
        throw new AppError('The AI service is not configured on the server.', 503, 'AI_NOT_CONFIGURED');
      }

      const model = getModel();
      const url = `${BASE_URL}/models/${encodeURIComponent(model)}:generateContent`;
      const body = JSON.stringify(toGeminiRequest(messages, Math.max(maxOutputTokens, MIN_OUTPUT_TOKENS), json));

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let response;
        let payload;

        try {
          response = await fetchImpl(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body,
            signal: controller.signal,
          });
          payload = await response.json().catch(() => null);
        } catch (err) {
          if (err.name === 'AbortError') {
            throw new AppError('The AI service took too long to respond. Please try again.', 504, 'AI_TIMEOUT');
          }
          console.error('Gemini request failed:', err.name, err.message);
          throw new AppError('Could not reach the AI service. Please try again.', 503, 'AI_UNREACHABLE');
        } finally {
          clearTimeout(timer);
        }

        if (response.ok) {
          const result = readGeminiResponse(payload);
          return { ...result, model: result.model ?? model };
        }
        if ((response.status === 500 || response.status === 503) && attempt < MAX_RETRIES) {
          await wait(retryDelayMs * (attempt + 1));
          continue;
        }
        throw toHttpError(response.status, payload, model);
      }
    },
  };
}
