// AI models sometimes wrap JSON in markdown fences or add a sentence around it. Recover what we can.
export function parseAiJson(text) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'The reply was empty.' };

  const candidates = [text.trim()];

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === 'object' && !Array.isArray(value)) return { ok: true, value };
    } catch {
      // try the next candidate
    }
  }
  return { ok: false, error: 'The reply was not a valid JSON object.' };
}

export function summarizeZodError(error) {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}
