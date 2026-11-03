import { asyncHandler } from '../utils/asyncHandler.js';
import { generateStructured, getAiStatus, getProvider } from '../ai/aiService.js';
import { pingSchema } from '../ai/schemas.js';
import { runAnalysis } from '../services/analysis.service.js';

export const status = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await getAiStatus()) });
});

// Sends a tiny prompt to check that the key, model and network all work.
export const testConnection = asyncHandler(async (req, res) => {
  const provider = await getProvider();
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

  res.json({
    success: true,
    provider: meta.provider,
    model: meta.model,
    latencyMs: Date.now() - started,
    reply: data,
  });
});

// POST /api/ai/analyze: same pipeline as POST /api/analysis (kept as the AI-flavoured entry point).
export const analyze = asyncHandler(async (req, res) => {
  const { analysis, cached } = await runAnalysis(req.user.id, req.body);
  res.status(cached ? 200 : 201).json({ success: true, cached, analysis });
});
