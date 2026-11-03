import { extractSkills, extractSoftSkills, extractCertifications } from './skillExtractor.service.js';
import {
  detectDegrees, highestDegree, extractStatedYears, estimateExperienceYears,
} from './qualificationExtractor.service.js';

const EVIDENCE_SECTIONS = ['skills', 'experience', 'projects', 'summary', 'certifications', 'education'];

// Structured profile of a resume: which skills it shows, where, education level and experience.
// `sections` is the output of parseResumeSections (may have null sections).
export function buildResumeProfile(text, sections = {}) {
  // Where does each skill appear? "skills only" is weaker evidence than "used in a project or job".
  const evidence = new Map();
  for (const key of EVIDENCE_SECTIONS) {
    for (const skill of extractSkills(sections[key])) {
      if (!evidence.has(skill.name)) evidence.set(skill.name, []);
      evidence.get(skill.name).push(key);
    }
  }

  const skills = extractSkills(text).map((skill) => ({
    ...skill,
    evidence: evidence.get(skill.name) ?? ['other'],
  }));

  const education = highestDegree(detectDegrees(sections.education || text));

  return {
    version: 1,
    skills,
    softSkills: extractSoftSkills(text),
    certifications: extractCertifications(text),
    educationLevel: education ? { level: education.level, label: education.label } : null,
    yearsExperience: {
      stated: extractStatedYears(text),
      estimated: estimateExperienceYears(sections.experience),
    },
  };
}
