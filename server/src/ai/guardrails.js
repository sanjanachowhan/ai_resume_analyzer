// Safety checks applied to AI output before it is shown or saved.
// The AI explains and suggests; it must never invent facts about the candidate.

const NUMBER_RE = /\d+(?:[.,]\d+)?/g;
const PLACEHOLDER_RE = /\[add measurable result\]/gi;
const words = (text = '') => text.toLowerCase().match(/[a-z0-9+#]+/g) ?? [];

// A rewrite is only kept if (1) the "current" line really comes from the resume and
// (2) the new wording does not contain numbers that appear nowhere on the resume.
export function isGroundedRewrite({ current, suggested }, resumeText) {
  if (!current?.trim() || !suggested?.trim() || current.trim() === suggested.trim()) return false;

  const currentWords = words(current);
  if (currentWords.length < 3) return false;
  const resumeWords = new Set(words(resumeText));
  const overlap = currentWords.filter((w) => resumeWords.has(w)).length / currentWords.length;
  if (overlap < 0.8) return false;

  const knownNumbers = new Set(resumeText.match(NUMBER_RE) ?? []);
  const invented = (suggested.replace(PLACEHOLDER_RE, '').match(NUMBER_RE) ?? []).filter((n) => !knownNumbers.has(n));
  return invented.length === 0;
}

export function filterRewrites(rewrites = [], resumeText) {
  const kept = rewrites.filter((r) => isGroundedRewrite(r, resumeText));
  return { kept, dropped: rewrites.length - kept.length };
}

const defaultRecommendation = (skill) =>
  `If you have real experience with ${skill}, add it to your skills and describe where you used it. Otherwise a small project or course would help.`;

// The list of missing skills always comes from the deterministic matcher (so it is reliable);
// the AI only adds the reasoning and advice.
export function buildMissingSkills(engineMissing = [], aiMissing = []) {
  const aiBySkill = new Map(aiMissing.map((m) => [m.skill.toLowerCase(), m]));

  return engineMissing.map(({ skill, importance: jobImportance }) => {
    const ai = aiBySkill.get(skill.toLowerCase());
    let importance = ai?.importance ?? (jobImportance === 'required' ? 'High' : 'Medium');
    if (jobImportance === 'required' && importance === 'Low') importance = 'Medium'; // a required skill is never "low"

    return {
      skill,
      jobImportance,
      importance,
      reason: ai?.reason || (jobImportance === 'required'
        ? 'Listed as a requirement in the job description.'
        : 'Listed as a preferred skill in the job description.'),
      recommendation: ai?.recommendation || defaultRecommendation(skill),
    };
  });
}

// Skills that are on the resume but only in the skills list (deterministic) plus any the AI flags,
// as long as they really are on the resume.
export function buildWeakSkills(engineMatched = [], aiWeak = [], resumeSkillNames = []) {
  const weak = engineMatched
    .filter((m) => m.weakEvidence)
    .map((m) => ({ skill: m.skill, reason: 'Listed in your skills section but not shown in any job or project.' }));

  const onResume = new Set(resumeSkillNames.map((s) => s.toLowerCase()));
  const seen = new Set(weak.map((w) => w.skill.toLowerCase()));
  for (const item of aiWeak) {
    const key = item.skill.toLowerCase();
    if (onResume.has(key) && !seen.has(key)) {
      weak.push({ skill: item.skill, reason: item.reason });
      seen.add(key);
    }
  }
  return weak;
}

// Used when the AI is unavailable, so the report still has honest next steps.
export function fallbackSuggestions(engineMissing = []) {
  const ranked = [...engineMissing].sort((a, b) => (a.importance === b.importance ? 0 : a.importance === 'required' ? -1 : 1));
  if (!ranked.length) {
    return ['Your resume covers the skills this job lists. Focus on showing results in your experience and project bullet points.'];
  }
  return ranked.slice(0, 5).map(({ skill }) => `Add ${skill} to your resume only if you have real experience with it; otherwise a small project or course would help.`);
}
