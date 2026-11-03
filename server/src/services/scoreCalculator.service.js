import { SCORING, getWeights } from '../config/matching.js';
import { matchSkills } from './skillMatcher.service.js';
import { matchKeywords, matchResponsibilities, matchSoftSkills } from './textMatcher.service.js';
import { buildResumeProfile } from './resumeProfile.service.js';
import { analyzeJobDescription } from './jobAnalyzer.service.js';

// Each component reports one of three states:
//   scored        -> a real 0-100 score that counts towards the overall score
//   not_required  -> the job doesn't ask for this, so it is left out (its weight is shared by the others)
//   unknown       -> the job asks, but the resume doesn't let us tell; also left out, and flagged
const scored = (score, note) => ({ status: 'scored', score, note });
const notRequired = (note) => ({ status: 'not_required', score: 100, note });
const unknown = (note) => ({ status: 'unknown', score: 0, note });

function fromRaw(score, noteWhenMissing) {
  return score === null ? notRequired(noteWhenMissing) : scored(score);
}

function scoreExperience(requirement, yearsInfo) {
  if (!requirement) return { ...notRequired('The job does not state a required number of years.'), required: null, resumeYears: null };

  const known = [yearsInfo?.stated, yearsInfo?.estimated].filter((y) => y !== null && y !== undefined);
  if (!known.length) {
    return { ...unknown("We couldn't detect your years of experience from the resume."), required: requirement.min, resumeYears: null };
  }

  const resumeYears = Math.max(...known);
  const score = requirement.min <= 0 ? 100 : Math.min(100, Math.round((resumeYears / requirement.min) * 100));
  return {
    ...scored(score, `${resumeYears} years on the resume vs ${requirement.min}${requirement.max ? `-${requirement.max}` : '+'} required.`),
    required: requirement.min,
    resumeYears,
  };
}

function scoreEducation(requirement, resumeLevel) {
  if (!requirement) return { ...notRequired('The job does not state a degree requirement.'), required: null, resumeLevel: null };
  if (!resumeLevel) {
    return { ...unknown("We couldn't detect your education level from the resume."), required: requirement.label, resumeLevel: null };
  }

  const gap = requirement.level - resumeLevel.level;
  const score = gap <= 0 ? 100 : gap === 1 ? SCORING.educationOneLevelBelow : 0;
  return {
    ...scored(score, `${resumeLevel.label} on the resume vs ${requirement.label} required.`),
    required: requirement.label,
    resumeLevel: resumeLevel.label,
  };
}

// resume: { rawText, parsedData }   job: { description, parsedData }
// Returns the full, explainable match result. No AI is involved, so the same input always gives the same score.
export function calculateMatch({ resume, job }, weights = getWeights()) {
  const profile = resume.parsedData?.profile ?? buildResumeProfile(resume.rawText, resume.parsedData ?? {});
  const requirements = job.parsedData?.version ? job.parsedData : analyzeJobDescription(job.description);

  const skills = matchSkills(requirements.skills ?? [], profile.skills ?? []);
  const keywords = matchKeywords(requirements.keywords, resume.rawText, skills.resumeSkillNames);
  const experience = scoreExperience(requirements.yearsExperience, profile.yearsExperience);
  const education = scoreEducation(requirements.minEducation, profile.educationLevel);

  // Compare duties with the parts of the resume that describe work; fall back to the whole text.
  const workText = [resume.parsedData?.experience, resume.parsedData?.projects].filter(Boolean).join('\n') || resume.rawText;
  const responsibilities = matchResponsibilities(requirements.responsibilities, workText);
  const softSkills = matchSoftSkills(requirements.softSkills, profile.softSkills ?? []);

  const components = {
    skills: { ...fromRaw(skills.score, 'No recognizable skills found in the job description.') },
    keywords: { ...fromRaw(keywords.score, 'No keywords found in the job description.') },
    experience,
    education,
    responsibilities: { ...fromRaw(responsibilities.score, 'No responsibilities found in the job description.') },
    softSkills: { ...fromRaw(softSkills.score, 'The job does not mention soft skills.') },
  };

  // Components that count are re-weighted so the weights still add up to 100%.
  const counted = Object.keys(components).filter((key) => components[key].status === 'scored');
  const countedTotal = counted.reduce((sum, key) => sum + weights[key], 0);
  for (const key of Object.keys(components)) {
    components[key].weight = weights[key];
    components[key].effectiveWeight =
      components[key].status === 'scored' && countedTotal > 0 ? weights[key] / countedTotal : 0;
  }

  const overall = counted.reduce((sum, key) => sum + components[key].score * components[key].effectiveWeight, 0);

  return {
    engineVersion: 1,
    overallScore: counted.length && countedTotal > 0 ? Math.round(overall) : null,
    skillScore: components.skills.score,
    keywordScore: components.keywords.score,
    experienceScore: components.experience.score,
    educationScore: components.education.score,
    responsibilityScore: components.responsibilities.score,
    softSkillScore: components.softSkills.score,
    components,
    skills: { matched: skills.matched, partial: skills.partial, missing: skills.missing, additional: skills.additional },
    keywords: { matched: keywords.matched, missing: keywords.missing },
    responsibilities: responsibilities.items,
    softSkills: { matched: softSkills.matched, missing: softSkills.missing },
    weights,
  };
}
