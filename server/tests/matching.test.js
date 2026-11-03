import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_WEIGHTS, normalizeWeights } from '../src/config/matching.js';
import { matchSkills } from '../src/services/skillMatcher.service.js';
import { matchKeywords, matchSoftSkills } from '../src/services/textMatcher.service.js';
import { calculateMatch } from '../src/services/scoreCalculator.service.js';
import { analyzeJobDescription } from '../src/services/jobAnalyzer.service.js';
import { buildResumeProfile } from '../src/services/resumeProfile.service.js';
import { parseResumeSections } from '../src/parsers/resumeSectionParser.js';

const req = (name) => ({ name, importance: 'required' });
const pref = (name) => ({ name, importance: 'preferred' });
const has = (name, evidence = ['experience']) => ({ name, evidence });

// ---------- weights ----------

test('default weights add up to 1', () => {
  const total = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test('custom weights are validated and normalized', () => {
  const weights = normalizeWeights({ ...DEFAULT_WEIGHTS, skills: 0.8 });
  assert.ok(Math.abs(Object.values(weights).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(weights.skills > DEFAULT_WEIGHTS.skills);
  assert.throws(() => normalizeWeights({ ...DEFAULT_WEIGHTS, skills: -1 }), /skills/);
  assert.throws(() => normalizeWeights({ ...DEFAULT_WEIGHTS, bogus: 1 }), /bogus/);
});

// ---------- skill matching ----------

test('skills are sorted into matched, partial, missing and additional', () => {
  const result = matchSkills(
    [req('React'), req('SQL'), req('Vue.js'), req('Docker'), pref('Kubernetes'), pref('AWS')],
    [has('React', ['skills']), has('PostgreSQL'), has('Python'), has('Azure', ['projects'])]
  );

  const names = (list) => list.map((s) => s.skill);
  assert.deepEqual(names(result.matched), ['React', 'SQL']);
  assert.deepEqual(names(result.partial), ['Vue.js', 'AWS']);
  assert.deepEqual(names(result.missing), ['Docker', 'Kubernetes']);
  assert.deepEqual(result.additional, ['Python']);

  assert.equal(result.matched[0].weakEvidence, true); // React only appears in the skills list
  assert.equal(result.matched[1].via, 'implied by PostgreSQL');
  assert.equal(result.partial[0].relatedTo, 'React');
  // earned 1 + 1 + 0.5 + 0 + 0 + 0.25 of 5 -> 55
  assert.equal(result.score, 55);
});

test('missing required skills are listed before missing preferred ones', () => {
  const result = matchSkills([pref('Docker'), req('Rust')], []);
  assert.deepEqual(result.missing.map((s) => s.skill), ['Rust', 'Docker']);
  assert.equal(result.score, 0);
});

test('no job skills means the skill component is not applicable', () => {
  assert.equal(matchSkills([], [has('React')]).score, null);
});

// ---------- keywords and soft skills ----------

test('keywords match by word, by skill and by simple stem', () => {
  const skills = new Set(['React']);
  const result = matchKeywords(['React', 'scalability', 'logistics', 'kubernetes'], 'Built scalable React apps for a logistics company', skills);
  assert.deepEqual(result.matched, ['React', 'scalability', 'logistics']);
  assert.deepEqual(result.missing, ['kubernetes']);
  assert.equal(result.score, 75);
});

test('soft skill matching', () => {
  assert.equal(matchSoftSkills(['Communication', 'Teamwork'], ['Teamwork']).score, 50);
  assert.equal(matchSoftSkills([], ['Teamwork']).score, null);
});

// ---------- full calculation ----------

const JOB = `Full Stack Developer

Responsibilities
• Build REST APIs using Node.js and PostgreSQL
• Develop responsive interfaces with React

Requirements
• Bachelor's degree in Computer Science
• 3+ years of experience in web development
• Strong JavaScript and TypeScript skills
• Excellent communication and problem solving

Nice to have
• Docker and Kubernetes`;

const RESUME = `Jane Doe
jane@example.com

SKILLS
React, Node.js, PostgreSQL, JavaScript, Python

EXPERIENCE
Software Engineer, Acme  Jan 2021 - Dec 2023
Built REST APIs with Node.js and PostgreSQL. Developed responsive React interfaces.
Strong communication with the design team.

EDUCATION
B.Tech in Computer Science, 2020`;

const build = (resumeText, jobText) => ({
  resume: { rawText: resumeText, parsedData: parseResumeSections(resumeText) },
  job: { description: jobText, parsedData: null }, // analyzed on the fly
});

test('a strong candidate scores high, with explainable parts', () => {
  const result = calculateMatch(build(RESUME, JOB), { ...DEFAULT_WEIGHTS });

  assert.ok(result.overallScore >= 70 && result.overallScore <= 100, `overall ${result.overallScore}`);
  assert.equal(result.components.experience.score, 100); // 3 years vs 3+ required
  assert.equal(result.components.education.score, 100);
  assert.ok(result.skills.matched.some((s) => s.skill === 'React'));
  assert.ok(result.skills.missing.some((s) => s.skill === 'TypeScript') === false); // TS is related to JS -> partial
  assert.ok(result.skills.partial.some((s) => s.skill === 'TypeScript'));
  assert.ok(result.skills.missing.some((s) => s.skill === 'Docker'));
  assert.ok(result.skills.additional.includes('Python'));
});

test('overall score equals the weighted sum of the counted components', () => {
  const result = calculateMatch(build(RESUME, JOB), { ...DEFAULT_WEIGHTS });
  const weightSum = Object.values(result.components).reduce((s, c) => s + c.effectiveWeight, 0);
  assert.ok(Math.abs(weightSum - 1) < 1e-9);

  const expected = Object.values(result.components).reduce((s, c) => s + c.score * c.effectiveWeight, 0);
  assert.equal(result.overallScore, Math.round(expected));
});

test('the same input always gives the same score', () => {
  const a = calculateMatch(build(RESUME, JOB), { ...DEFAULT_WEIGHTS });
  const b = calculateMatch(build(RESUME, JOB), { ...DEFAULT_WEIGHTS });
  assert.deepEqual(a, b);
});

test('changing the weights changes the overall score', () => {
  const skillsOnly = normalizeWeights({ skills: 1, keywords: 0, experience: 0, education: 0, responsibilities: 0, softSkills: 0 });
  const result = calculateMatch(build(RESUME, JOB), skillsOnly);
  assert.equal(result.overallScore, result.skillScore);
});

test('requirements the job does not state are left out and weights are shared', () => {
  const result = calculateMatch(build(RESUME, 'We need someone who knows Python and Django well enough to build our new platform and tools.'), { ...DEFAULT_WEIGHTS });
  assert.equal(result.components.experience.status, 'not_required');
  assert.equal(result.components.education.status, 'not_required');
  assert.equal(result.components.experience.effectiveWeight, 0);
  const counted = Object.values(result.components).filter((c) => c.status === 'scored');
  assert.ok(counted.length >= 1);
  assert.ok(Math.abs(counted.reduce((s, c) => s + c.effectiveWeight, 0) - 1) < 1e-9);
});

test('experience scoring: short of the requirement, overqualified, unknown', () => {
  const job = 'Requirements\n• 4+ years of experience in backend development\n• Python and Django skills required for this role';
  const half = calculateMatch({ resume: { rawText: 'x'.repeat(60), parsedData: { profile: { skills: [], softSkills: [], educationLevel: null, yearsExperience: { stated: 2, estimated: null } } } }, job: { description: job, parsedData: null } }, { ...DEFAULT_WEIGHTS });
  assert.equal(half.components.experience.score, 50);

  const senior = calculateMatch({ resume: { rawText: 'x'.repeat(60), parsedData: { profile: { skills: [], softSkills: [], educationLevel: null, yearsExperience: { stated: 9, estimated: null } } } }, job: { description: job, parsedData: null } }, { ...DEFAULT_WEIGHTS });
  assert.equal(senior.components.experience.score, 100);

  const noInfo = calculateMatch({ resume: { rawText: 'x'.repeat(60), parsedData: { profile: { skills: [], softSkills: [], educationLevel: null, yearsExperience: { stated: null, estimated: null } } } }, job: { description: job, parsedData: null } }, { ...DEFAULT_WEIGHTS });
  assert.equal(noInfo.components.experience.status, 'unknown');
  assert.equal(noInfo.components.experience.effectiveWeight, 0);
});

test('education scoring: meets, one level below, far below', () => {
  const level = (n, label) => ({ rawText: 'x'.repeat(60), parsedData: { profile: { skills: [], softSkills: [], educationLevel: { level: n, label }, yearsExperience: { stated: null, estimated: null } } } });
  const job = (degree) => ({ description: `Requirements\n• ${degree} degree in a related field\n• Python and Django skills required here`, parsedData: null });

  assert.equal(calculateMatch({ resume: level(3, "Master's"), job: job("Bachelor's") }, { ...DEFAULT_WEIGHTS }).components.education.score, 100);
  assert.equal(calculateMatch({ resume: level(2, "Bachelor's"), job: job("Master's") }, { ...DEFAULT_WEIGHTS }).components.education.score, 50);
  assert.equal(calculateMatch({ resume: level(2, "Bachelor's"), job: job('PhD') }, { ...DEFAULT_WEIGHTS }).components.education.score, 0);
});

test('a job with nothing recognizable cannot be scored', () => {
  const result = calculateMatch(build(RESUME, 'Join us. We are a friendly company with free coffee and a great office in a lovely town.'), { ...DEFAULT_WEIGHTS });
  assert.equal(result.overallScore, null);
});

test('an unrelated resume scores much lower than a matching one', () => {
  const unrelated = 'Maria Garcia\n\nSKILLS\nPhotoshop, Illustration, Typography\n\nEXPERIENCE\nGraphic Designer Jan 2018 - Dec 2022\nDesigned posters and brand identities for retail clients.';
  const good = calculateMatch(build(RESUME, JOB), { ...DEFAULT_WEIGHTS }).overallScore;
  const bad = calculateMatch(build(unrelated, JOB), { ...DEFAULT_WEIGHTS }).overallScore;
  assert.ok(good - bad >= 30, `good ${good} vs bad ${bad}`);
});
