import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSkills, extractSoftSkills } from '../src/services/skillExtractor.service.js';
import { analyzeJobDescription } from '../src/services/jobAnalyzer.service.js';
import { buildResumeProfile } from '../src/services/resumeProfile.service.js';
import { parseResumeSections } from '../src/parsers/resumeSectionParser.js';
import { estimateExperienceYears } from '../src/services/qualificationExtractor.service.js';

const names = (text) => extractSkills(text).map((s) => s.name);

test('finds skills regardless of case and punctuation', () => {
  const found = names('Experienced with REACT, node.js and postgres; also C++, C# and CI/CD pipelines.');
  for (const skill of ['React', 'Node.js', 'PostgreSQL', 'C++', 'C#', 'CI/CD']) assert.ok(found.includes(skill), skill);
});

test('does not confuse similar names', () => {
  assert.deepEqual(names('JavaScript developer'), ['JavaScript']); // not Java
  assert.deepEqual(names('PostgreSQL database'), ['PostgreSQL']); // not SQL
  assert.deepEqual(names('MySQL and NoSQL'), ['MySQL']);
  assert.ok(!names('We value people who express interest and excel at work').length);
});

test('single-letter languages only match inside skill lists', () => {
  assert.ok(names('Languages: Python, C, Java, R, Go').includes('C'));
  assert.ok(names('Languages: Python, C, Java, R, Go').includes('R'));
  assert.ok(names('Languages: Python, C, Java, R, Go').includes('Go'));
  assert.ok(!names('Vitamin C helps; C-level executives; Go to market').some((n) => ['C', 'Go'].includes(n)));
});

test('REST is only a skill in capitals', () => {
  assert.ok(names('Built REST APIs').includes('REST APIs'));
  assert.ok(!names('take a rest after work').includes('REST APIs'));
});

test('soft skills are detected', () => {
  assert.deepEqual(extractSoftSkills('Excellent communication and problem-solving skills'), ['Communication', 'Problem Solving']);
});

const JOB = `Full Stack Developer

About Us
We build logistics software and run everything on AWS.

Responsibilities
• Build REST APIs using Node.js and PostgreSQL
• Develop responsive interfaces with React

Requirements
• Bachelor's degree in Computer Science or a related field
• 3+ years of experience in web development
• Strong JavaScript and TypeScript skills
• Excellent communication and problem solving

Nice to have
• Docker and Kubernetes
• Experience with GraphQL is a plus`;

test('job analyzer separates required from preferred skills', () => {
  const job = analyzeJobDescription(JOB);
  for (const s of ['Node.js', 'PostgreSQL', 'React', 'JavaScript', 'TypeScript', 'REST APIs']) {
    assert.ok(job.requiredSkills.includes(s), `required: ${s}`);
  }
  for (const s of ['Docker', 'Kubernetes', 'GraphQL', 'AWS']) assert.ok(job.preferredSkills.includes(s), `preferred: ${s}`);
  assert.ok(!job.requiredSkills.includes('Docker'));
});

test('job analyzer extracts experience, education and soft skills', () => {
  const job = analyzeJobDescription(JOB);
  assert.equal(job.yearsExperience.min, 3);
  assert.equal(job.minEducation.level, 2);
  assert.deepEqual(job.softSkills, ['Communication', 'Problem Solving']);
  assert.equal(job.responsibilities.length, 2);
  assert.ok(job.programmingLanguages.includes('TypeScript'));
});

test('years of experience: ranges, words and preferences', () => {
  assert.deepEqual(
    analyzeJobDescription('Requirements\n5-7 years of experience in backend development and some other text here to be long enough').yearsExperience.max,
    7
  );
  assert.equal(analyzeJobDescription('Requirements\nTwo years of experience with Python required for this position').yearsExperience.min, 2);
  assert.equal(analyzeJobDescription('We have 10 years of history and a great team that loves building products together').yearsExperience, null);
});

test('a plain pasted job description without headings still works', () => {
  const job = analyzeJobDescription('We need a developer skilled in Python and Django. Experience with Docker is a plus. 2+ years of experience needed.');
  assert.deepEqual(job.requiredSkills, ['Python', 'Django']);
  assert.deepEqual(job.preferredSkills, ['Docker']);
  assert.equal(job.yearsExperience.min, 2);
});

const RESUME = `John Doe
john@example.com

SKILLS
React, Node.js, PostgreSQL, Docker, Python

EXPERIENCE
Software Engineer, Acme  Jan 2021 - Dec 2022
Built dashboards with React and Node.js
Intern, Beta Corp  Jun 2020 - Aug 2020

PROJECTS
Resume Analyzer - React, Express.js, PostgreSQL

EDUCATION
B.Tech in Electronics, 2020`;

test('resume profile reports skills with evidence, education and experience', () => {
  const profile = buildResumeProfile(RESUME, parseResumeSections(RESUME));
  const byName = Object.fromEntries(profile.skills.map((s) => [s.name, s.evidence]));
  assert.deepEqual(byName.Docker, ['skills']); // listed but never used: weak evidence
  assert.ok(byName.React.includes('experience') && byName.React.includes('projects'));
  assert.equal(profile.educationLevel.level, 2);
  assert.ok(profile.yearsExperience.estimated >= 2 && profile.yearsExperience.estimated <= 2.3);
  assert.equal(profile.yearsExperience.stated, null);
});

test('experience estimate handles Present, overlaps and unknowns', () => {
  const now = new Date('2026-06-15');
  assert.equal(estimateExperienceYears('Dev 2024 - Present', now), 2.5);
  assert.equal(estimateExperienceYears('A: Jan 2020 - Dec 2021\nB: Jun 2021 - Dec 2022', now), 3); // overlap counted once
  assert.equal(estimateExperienceYears('Jan 2021 - Dec 2023', now), 3); // both end months count
  assert.equal(estimateExperienceYears('No dates here', now), null);
  assert.equal(estimateExperienceYears(null, now), null);
});
