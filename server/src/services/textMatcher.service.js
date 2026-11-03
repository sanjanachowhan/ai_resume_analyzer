import { SCORING } from '../config/matching.js';
import { STOPWORDS } from '../data/stopwords.js';

// Very light stemming so "scalable" matches "scalability" and "deploying" matches "deployed".
export function stem(word) {
  if (word.length <= 4) return word;
  const stripped = word.replace(/(ability|ations?|ments?|ings?|able|ness|ity|ed|es|ly|s)$/, '');
  return stripped.length >= 3 ? stripped : word;
}

export function tokenize(text) {
  return (text.toLowerCase().match(/[a-z][a-z0-9+#]*/g) ?? []).filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

const stemSet = (text) => new Set(tokenize(text).map(stem));

// Share of the job's keywords that appear on the resume.
export function matchKeywords(keywords, resumeText, resumeSkillNames) {
  if (!keywords?.length) return { score: null, matched: [], missing: [] };

  const resumeStems = stemSet(resumeText);
  const resumeLower = resumeText.toLowerCase();
  const matched = [];
  const missing = [];

  for (const keyword of keywords) {
    const found =
      resumeSkillNames.has(keyword) ||
      resumeLower.includes(keyword.toLowerCase()) ||
      (tokenize(keyword).length > 0 && tokenize(keyword).every((t) => resumeStems.has(stem(t))));
    (found ? matched : missing).push(keyword);
  }

  return {
    score: Math.round((matched.length / keywords.length) * 100),
    matched: matched.slice(0, SCORING.maxListedKeywords),
    missing: missing.slice(0, SCORING.maxListedKeywords),
  };
}

// How well does the resume's wording cover each duty listed in the job?
export function matchResponsibilities(responsibilities, resumeText) {
  if (!responsibilities?.length) return { score: null, items: [] };

  const resumeStems = stemSet(resumeText);
  const items = responsibilities.map((text) => {
    const stems = [...new Set(tokenize(text).map(stem))];
    const hits = stems.filter((s) => resumeStems.has(s)).length;
    const ratio = stems.length ? hits / stems.length : 0;
    const coverage = Math.min(1, ratio / SCORING.responsibilityFullCoverageRatio);
    return { text, coverage: Math.round(coverage * 100) / 100, covered: coverage >= SCORING.responsibilityCoveredThreshold };
  });

  const average = items.reduce((sum, item) => sum + item.coverage, 0) / items.length;
  return { score: Math.round(average * 100), items };
}

export function matchSoftSkills(jobSoftSkills, resumeSoftSkills) {
  if (!jobSoftSkills?.length) return { score: null, matched: [], missing: [] };
  const have = new Set(resumeSoftSkills);
  const matched = jobSoftSkills.filter((s) => have.has(s));
  const missing = jobSoftSkills.filter((s) => !have.has(s));
  return { score: Math.round((matched.length / jobSoftSkills.length) * 100), matched, missing };
}
