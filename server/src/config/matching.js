// All tunable numbers of the matching algorithm live here.

// How much each component contributes to the overall score (must add up to 1; normalized automatically).
export const DEFAULT_WEIGHTS = {
  skills: 0.4,
  keywords: 0.2,
  experience: 0.15,
  education: 0.1,
  responsibilities: 0.1,
  softSkills: 0.05,
};

export const SCORING = {
  requiredSkillWeight: 1, // a required skill counts fully...
  preferredSkillWeight: 0.5, // ...a "nice to have" skill counts half
  partialCredit: 0.5, // a related skill (e.g. Azure for AWS) earns half credit
  educationOneLevelBelow: 50, // e.g. Bachelor's when a Master's is required
  responsibilityFullCoverageRatio: 0.5, // 50% of a duty's words found on the resume = fully covered
  responsibilityCoveredThreshold: 0.6, // coverage at or above this counts as "covered" in the report
  maxListedKeywords: 30,
};

// Validates custom weights and scales them so they add up to exactly 1.
export function normalizeWeights(raw) {
  const keys = Object.keys(DEFAULT_WEIGHTS);
  for (const key of Object.keys(raw)) {
    if (!keys.includes(key)) throw new Error(`Unknown match weight "${key}". Allowed: ${keys.join(', ')}`);
  }
  let total = 0;
  for (const key of keys) {
    const value = raw[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error(`Match weight "${key}" must be a number of 0 or more`);
    }
    total += value;
  }
  if (total <= 0) throw new Error('Match weights must not all be zero');
  return Object.fromEntries(keys.map((key) => [key, raw[key] / total]));
}

// Defaults, optionally overridden by MATCH_WEIGHTS in .env, e.g. {"skills":0.5,"keywords":0.1}
export function getWeights() {
  const raw = process.env.MATCH_WEIGHTS;
  if (!raw) return { ...DEFAULT_WEIGHTS };

  let overrides;
  try {
    overrides = JSON.parse(raw);
  } catch {
    throw new Error('MATCH_WEIGHTS in .env must be valid JSON');
  }
  return normalizeWeights({ ...DEFAULT_WEIGHTS, ...overrides });
}
