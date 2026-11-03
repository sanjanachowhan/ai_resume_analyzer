export function verdict(score) {
  if (score >= 80) return { label: 'Excellent match', tone: 'text-emerald-600' };
  if (score >= 65) return { label: 'Strong match', tone: 'text-emerald-600' };
  if (score >= 50) return { label: 'Moderate match', tone: 'text-amber-600' };
  return { label: 'Low match', tone: 'text-rose-600' };
}

export const COMPONENT_LABELS = {
  skills: 'Skills',
  keywords: 'Keywords',
  experience: 'Experience',
  education: 'Education',
  responsibilities: 'Responsibilities',
  softSkills: 'Soft skills',
};

// Strengths that can be stated from the numbers alone (used when the AI is unavailable).
export function deriveStrengths(analysis) {
  const { matched, missing } = analysis.skills;
  const strengths = [];

  const requiredMatched = matched.filter((m) => m.importance === 'required').length;
  const requiredTotal = requiredMatched + missing.filter((m) => m.jobImportance === 'required').length;
  if (requiredTotal > 0 && requiredMatched / requiredTotal >= 0.5) {
    strengths.push(`${requiredMatched} of ${requiredTotal} required skills are on your resume.`);
  }

  for (const [key, c] of Object.entries(analysis.components ?? {})) {
    if (c.status === 'scored' && c.score >= 80) strengths.push(`${COMPONENT_LABELS[key]} is a strong area (${c.score}%).`);
  }
  return strengths;
}
