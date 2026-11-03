import { STOPWORDS } from '../data/stopwords.js';
import { extractSkills, extractSoftSkills, extractCertifications } from './skillExtractor.service.js';
import {
  detectDegrees, lowestDegree, extractYearsFromLine,
} from './qualificationExtractor.service.js';

// ---- Section headings commonly found in job postings ----
const HEADINGS = {
  required: [
    'requirements', 'required', 'required skills', 'required qualifications', 'qualifications',
    'minimum qualifications', 'basic qualifications', 'must have', 'must haves', 'what you need',
    'what you ll need', 'what we re looking for', 'what you bring', 'skills and experience',
    'skills experience', 'key skills', 'technical skills', 'who you are', 'your profile',
  ],
  preferred: [
    'preferred', 'preferred qualifications', 'preferred skills', 'nice to have', 'nice to haves',
    'bonus', 'bonus points', 'good to have', 'desired', 'desirable skills', 'pluses',
    'what would make you stand out',
  ],
  responsibilities: [
    'responsibilities', 'key responsibilities', 'what you ll do', 'what you will do', 'your role',
    'role', 'the role', 'duties', 'day to day',
  ],
  other: [
    'about us', 'about the company', 'who we are', 'benefits', 'perks', 'what we offer',
    'why join us', 'compensation', 'equal opportunity', 'how to apply',
  ],
};

const normalizeHeading = (line) =>
  line.toLowerCase().replace(/['’]/g, '').replace(/[^a-z]+/g, ' ').trim();

const HEADING_MAP = new Map();
for (const [section, names] of Object.entries(HEADINGS)) {
  for (const name of names) HEADING_MAP.set(normalizeHeading(name), section);
}

// A line containing one of these describes something optional.
const PREFERRED_CUE =
  /\b(nice[-\s]to[-\s]have|preferred|preferably|(?:is|are|be)\s+a\s+plus|a\s+plus|bonus|good\s+to\s+have|desirable|ideally|an?\s+advantage|an\s+asset|familiarity\s+with|exposure\s+to|would\s+be\s+great)\b/i;

const ACTION_VERBS = new Set([
  'build', 'develop', 'design', 'implement', 'maintain', 'collaborate', 'write', 'create', 'deliver',
  'participate', 'optimize', 'ensure', 'work', 'lead', 'manage', 'review', 'integrate', 'deploy',
  'test', 'debug', 'analyze', 'improve', 'support', 'contribute', 'own', 'drive', 'architect',
]);

const stripBullet = (line) => line.replace(/^[\s•\-*–—·▪●○>\d.)]+/, '').trim();

const GROUPS = {
  programmingLanguages: ['language'],
  frameworks: ['framework', 'mobile'],
  tools: ['tool', 'testing', 'devops'],
  technologies: ['database', 'cloud', 'data', 'concept'],
};

function topTerms(text, skillNames, limit = 20) {
  const skillWords = new Set(skillNames.flatMap((n) => n.toLowerCase().split(/[^a-z0-9]+/)).filter(Boolean));
  const counts = new Map();
  for (const word of text.toLowerCase().match(/[a-z][a-z0-9+#-]{2,}/g) ?? []) {
    if (STOPWORDS.has(word) || skillWords.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

// Turns job description text into structured requirements. Deterministic: no AI involved.
export function analyzeJobDescription(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // 1. Tag each line with the section it belongs to.
  const entries = [];
  let section = 'general';
  for (const line of lines) {
    const heading = line.length <= 60 ? HEADING_MAP.get(normalizeHeading(line)) : undefined;
    if (heading) {
      section = heading;
      continue;
    }
    // Long pasted paragraphs are judged sentence by sentence, so "Docker is a plus." doesn't taint the sentence before it.
    for (const sentence of line.split(/(?<=[.!?])\s+/)) {
      if (sentence.trim()) entries.push({ line: sentence.trim(), section });
    }
  }

  // 2. Skills: required unless the line/section marks them optional or they only appear in "about us"-style text.
  const requiredMap = new Map();
  const optionalMap = new Map();
  for (const { line, section: sec } of entries) {
    const optional = sec === 'preferred' || sec === 'other' || PREFERRED_CUE.test(line);
    for (const skill of extractSkills(line)) (optional ? optionalMap : requiredMap).set(skill.name, skill);
  }
  const required = [...requiredMap.values()];
  const preferred = [...optionalMap.values()].filter((s) => !requiredMap.has(s.name));
  const skills = [
    ...required.map((s) => ({ ...s, importance: 'required' })),
    ...preferred.map((s) => ({ ...s, importance: 'preferred' })),
  ];

  const namesIn = (categories) => skills.filter((s) => categories.includes(s.category)).map((s) => s.name);

  // 3. Education and experience (ignoring lines that only describe a preference).
  const educationRequirements = [];
  const yearMentions = [];
  for (const { line } of entries) {
    const preferredLine = PREFERRED_CUE.test(line);
    for (const degree of detectDegrees(line)) {
      educationRequirements.push({ ...degree, text: line.slice(0, 160), preferred: preferredLine });
    }
    for (const mention of extractYearsFromLine(line)) yearMentions.push({ ...mention, preferred: preferredLine });
  }
  const minEducation = lowestDegree(educationRequirements.filter((e) => !e.preferred));
  const requiredYears = yearMentions.filter((y) => !y.preferred).sort((a, b) => b.min - a.min)[0] ?? null;

  // 4. Certifications: known ones by name, plus any other line that mentions a certification.
  const certifications = extractCertifications(text);
  const otherCertificationRequirements = lines
    .filter((l) => /certif/i.test(l) && extractCertifications(l).length === 0)
    .map((l) => stripBullet(l).slice(0, 120))
    .slice(0, 5);

  // 5. Responsibilities and key qualifications.
  let responsibilities = entries.filter((e) => e.section === 'responsibilities').map((e) => stripBullet(e.line));
  if (!responsibilities.length) {
    responsibilities = entries
      .filter((e) => /^[\s•\-*–—·▪●]/.test(e.line) && ACTION_VERBS.has(stripBullet(e.line).split(/\s+/)[0]?.toLowerCase()))
      .map((e) => stripBullet(e.line));
  }
  const importantQualifications = entries
    .filter((e) => e.section === 'required')
    .map((e) => stripBullet(e.line))
    .filter((l) => l.length > 3);

  const softSkills = extractSoftSkills(text);
  const skillNames = skills.map((s) => s.name);
  const terms = topTerms(text, skillNames);

  return {
    version: 1,
    requiredSkills: required.map((s) => s.name),
    preferredSkills: preferred.map((s) => s.name),
    skills,
    programmingLanguages: namesIn(GROUPS.programmingLanguages),
    frameworks: namesIn(GROUPS.frameworks),
    tools: namesIn(GROUPS.tools),
    technologies: namesIn(GROUPS.technologies),
    softSkills,
    certifications,
    otherCertificationRequirements,
    educationRequirements: educationRequirements.slice(0, 5),
    minEducation: minEducation ? { level: minEducation.level, label: minEducation.label } : null,
    yearsExperience: requiredYears
      ? { min: requiredYears.min, max: requiredYears.max, text: requiredYears.text }
      : null,
    responsibilities: responsibilities.slice(0, 15).map((r) => r.slice(0, 200)),
    importantQualifications: importantQualifications.slice(0, 10).map((r) => r.slice(0, 200)),
    keywords: [...skillNames, ...terms].slice(0, 40),
    topTerms: terms,
  };
}
