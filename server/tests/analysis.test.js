import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isGroundedRewrite, filterRewrites, buildMissingSkills, buildWeakSkills, fallbackSuggestions,
} from '../src/ai/guardrails.js';
import { createAnalysisService } from '../src/services/analysisPipeline.service.js';
import { gapAnalysisSchema, improvementSchema, finalSummarySchema } from '../src/ai/schemas.js';
import { parseResumeSections } from '../src/parsers/resumeSectionParser.js';
import { AppError } from '../src/utils/AppError.js';

// ---------- guardrails ----------

const RESUME_TEXT = 'Created a web application using React. Built REST APIs with Node.js, serving 200 users.';

test('rewrites must come from the resume and must not invent numbers', () => {
  const good = { current: 'Created a web application using React.', suggested: 'Developed a responsive React web application with REST API integration [add measurable result].' };
  assert.equal(isGroundedRewrite(good, RESUME_TEXT), true);

  const invented = { ...good, suggested: 'Developed a React web application that cut load time by 30%.' };
  assert.equal(isGroundedRewrite(invented, RESUME_TEXT), false);

  const fabricatedSource = { current: 'Led a team of ten engineers at Google.', suggested: 'Led an engineering team.' };
  assert.equal(isGroundedRewrite(fabricatedSource, RESUME_TEXT), false);

  const realNumber = { current: 'Built REST APIs with Node.js, serving 200 users.', suggested: 'Built and maintained REST APIs with Node.js serving 200 users.' };
  assert.equal(isGroundedRewrite(realNumber, RESUME_TEXT), true); // 200 is on the resume
});

test('filterRewrites reports how many were dropped', () => {
  const { kept, dropped } = filterRewrites(
    [
      { section: 'Projects', current: 'Created a web application using React.', suggested: 'Built a responsive React application.', note: '' },
      { section: 'Projects', current: 'Created a web application using React.', suggested: 'Built a React app used by 5000 people.', note: '' },
    ],
    RESUME_TEXT
  );
  assert.equal(kept.length, 1);
  assert.equal(dropped, 1);
});

test('missing skills come from the matcher; the AI only adds reasons', () => {
  const result = buildMissingSkills(
    [{ skill: 'AWS', importance: 'required' }, { skill: 'Docker', importance: 'preferred' }],
    [
      { skill: 'aws', importance: 'Low', reason: 'Used for deployment.', recommendation: 'Deploy a project.' },
      { skill: 'Quantum Computing', importance: 'High', reason: 'Made up.', recommendation: 'x' }, // not in the matcher's list
    ]
  );
  assert.deepEqual(result.map((m) => m.skill), ['AWS', 'Docker']);
  assert.equal(result[0].importance, 'Medium'); // a required skill is never "Low"
  assert.equal(result[0].reason, 'Used for deployment.');
  assert.match(result[1].reason, /preferred/); // default text when the AI said nothing
  assert.match(result[1].recommendation, /real experience/);
});

test('weak skills are limited to skills that are really on the resume', () => {
  const weak = buildWeakSkills(
    [{ skill: 'Docker', weakEvidence: true }, { skill: 'React' }],
    [{ skill: 'Python', reason: 'Only mentioned once.' }, { skill: 'Rust', reason: 'Invented.' }, { skill: 'docker', reason: 'dup' }],
    ['Docker', 'React', 'Python']
  );
  assert.deepEqual(weak.map((w) => w.skill), ['Docker', 'Python']);
});

test('fallback suggestions put required skills first and never claim experience', () => {
  const s = fallbackSuggestions([{ skill: 'Docker', importance: 'preferred' }, { skill: 'AWS', importance: 'required' }]);
  assert.match(s[0], /AWS/);
  assert.match(s[0], /only if you have real experience/);
});

// ---------- pipeline (fake database + fake AI) ----------

const JOB_TEXT = `Backend Developer

Responsibilities
• Build REST APIs using Node.js and PostgreSQL

Requirements
• Strong JavaScript and Node.js skills
• Experience with AWS and PostgreSQL
• 2+ years of experience`;

const RESUME = `Jane Doe

SKILLS
JavaScript, Node.js, PostgreSQL

EXPERIENCE
Developer, Acme Jan 2021 - Dec 2023
Built REST APIs with Node.js and PostgreSQL for internal tools.`;

function makeDb() {
  const state = {
    resume: { id: 'r1', userId: 'u1', fileName: 'jane.pdf', rawText: RESUME, parsedData: parseResumeSections(RESUME) },
    job: { id: 'j1', userId: 'u1', title: 'Backend Developer', company: 'Acme', description: JOB_TEXT, parsedData: null },
    analyses: [],
    created: 0,
    updated: 0,
  };
  const db = {
    resume: { findFirst: async ({ where }) => (where.id === 'r1' && where.userId === 'u1' ? state.resume : null) },
    jobDescription: { findFirst: async ({ where }) => (where.id === 'j1' && where.userId === 'u1' ? state.job : null) },
    analysis: {
      findFirst: async () => state.analyses.at(-1) ?? null,
      create: async ({ data }) => { state.created++; const row = { id: `a${state.created}`, createdAt: new Date(), aiProvider: null, aiAnalysis: null, ...data }; state.analyses.push(row); return row; },
      update: async ({ where, data }) => { state.updated++; const row = state.analyses.find((a) => a.id === where.id); Object.assign(row, data); return row; },
    },
  };
  return { db, state };
}

// A scripted AI. `fail` lists tasks that should throw.
function makeAi({ configured = true, fail = [], rewrites } = {}) {
  const calls = [];
  const provider = { name: 'fake', isConfigured: () => configured, model: () => 'fake-model' };
  const meta = { provider: 'fake', model: 'fake-model', usage: { inputTokens: 10, outputTokens: 5 }, attempts: 1 };
  return {
    calls,
    getProvider: async () => provider,
    generateStructured: async ({ prompt, schema }) => {
      const task = prompt.user.includes('"rewrites"') ? 'improvements' : prompt.user.includes('"headline"') ? 'final_summary' : 'gap_analysis';
      calls.push(task);
      if (fail.includes(task)) throw new AppError('AI down', 502, 'AI_PROVIDER_ERROR');
      const answers = {
        gap_analysis: {
          summary: 'Solid backend match, no cloud experience.',
          strengths: ['Strong Node.js'],
          missingSkills: [{ skill: 'AWS', importance: 'High', reason: 'Required by the job.', recommendation: 'Deploy a project to AWS.' }],
          weakSkills: [],
          suggestions: ['Add an AWS project.'],
        },
        improvements: {
          rewrites: rewrites ?? [{ section: 'Experience', current: 'Built REST APIs with Node.js and PostgreSQL for internal tools.', suggested: 'Built and maintained REST APIs with Node.js and PostgreSQL for internal tools [add measurable result].', note: 'Add usage numbers.' }],
        },
        final_summary: { headline: 'Good fit, one gap', summary: 'Strong backend skills; add cloud experience.', topPriorities: ['AWS', 'Metrics', 'Docker'] },
      };
      return { data: schema.parse(answers[task]), meta };
    },
  };
}
const run = (service, input = { resumeId: 'r1', jobId: 'j1' }) => service.runAnalysis('u1', input);

test('a full analysis combines the score with grounded AI insights and is saved', async () => {
  const { db, state } = makeDb();
  const ai = makeAi();
  const { analysis, cached } = await run(createAnalysisService({ db, ai }));

  assert.equal(cached, false);
  assert.equal(analysis.aiAvailable, true);
  assert.ok(analysis.scores.overall > 0);
  assert.equal(analysis.ai.gap.summary, 'Solid backend match, no cloud experience.');
  assert.equal(analysis.ai.summary.topPriorities.length, 3);
  assert.equal(analysis.ai.improvements.rewrites.length, 1);
  assert.deepEqual(analysis.skills.missing.map((m) => m.skill), ['AWS']);
  assert.equal(analysis.skills.missing[0].recommendation, 'Deploy a project to AWS.');
  assert.deepEqual(ai.calls.sort(), ['final_summary', 'gap_analysis', 'improvements']);
  assert.equal(state.analyses.length, 1);
  assert.equal(state.analyses[0].aiProvider, 'fake');
});

test('the same resume and job are not sent to the AI twice', async () => {
  const { db, state } = makeDb();
  const ai = makeAi();
  const service = createAnalysisService({ db, ai });

  await run(service);
  const callsAfterFirst = ai.calls.length;

  const second = await run(service);
  assert.equal(second.cached, true);
  assert.equal(ai.calls.length, callsAfterFirst); // no new AI calls
  assert.equal(state.analyses.length, 1);

  const forced = await run(service, { resumeId: 'r1', jobId: 'j1', force: true });
  assert.equal(forced.cached, false);
  assert.ok(ai.calls.length > callsAfterFirst);
  assert.equal(state.analyses.length, 2); // a re-run adds to the history
});

test('simultaneous identical requests share one run', async () => {
  const { db } = makeDb();
  const ai = makeAi();
  const service = createAnalysisService({ db, ai });
  const [a, b] = await Promise.all([run(service), run(service)]);
  assert.equal(a.analysis.id, b.analysis.id);
  assert.equal(ai.calls.filter((c) => c === 'gap_analysis').length, 1);
});

test('if the AI is down the score report is still saved, then completed on retry', async () => {
  const { db, state } = makeDb();

  const failing = await run(createAnalysisService({ db, ai: makeAi({ fail: ['gap_analysis'] }) }));
  assert.equal(failing.analysis.aiAvailable, false);
  assert.ok(failing.analysis.scores.overall > 0);
  assert.equal(failing.analysis.aiMeta.error.code, 'AI_PROVIDER_ERROR');
  assert.match(failing.analysis.suggestions[0], /real experience/);
  assert.equal(state.analyses.length, 1);
  assert.equal(state.analyses[0].aiProvider, null); // not treated as cached

  const retry = await run(createAnalysisService({ db, ai: makeAi() }));
  assert.equal(retry.cached, false);
  assert.equal(retry.analysis.aiAvailable, true);
  assert.equal(state.analyses.length, 1); // the same row was completed, not duplicated
  assert.equal(state.updated, 1);
});

test('a missing API key is reported without calling the AI', async () => {
  const { db } = makeDb();
  const ai = makeAi({ configured: false });
  const { analysis } = await run(createAnalysisService({ db, ai }));
  assert.equal(analysis.aiAvailable, false);
  assert.equal(analysis.aiMeta.error.code, 'AI_NOT_CONFIGURED');
  assert.equal(ai.calls.length, 0);
});

test('optional AI steps can fail without losing the main result', async () => {
  const { db } = makeDb();
  const { analysis } = await run(createAnalysisService({ db, ai: makeAi({ fail: ['improvements', 'final_summary'] }) }));
  assert.equal(analysis.aiAvailable, true);
  assert.equal(analysis.ai.improvements, null);
  assert.equal(analysis.ai.summary, null);
  assert.equal(analysis.aiMeta.warnings.length, 2);
});

test('rewrites that invent facts are discarded and reported', async () => {
  const { db } = makeDb();
  const bad = [{ section: 'Experience', current: 'Built REST APIs with Node.js and PostgreSQL for internal tools.', suggested: 'Built REST APIs that reduced latency by 45%.', note: '' }];
  const { analysis } = await run(createAnalysisService({ db, ai: makeAi({ rewrites: bad }) }));
  assert.equal(analysis.ai.improvements.rewrites.length, 0);
  assert.match(analysis.aiMeta.warnings[0], /discarded/);
});

test("users can only analyze their own resumes and jobs", async () => {
  const { db } = makeDb();
  const service = createAnalysisService({ db, ai: makeAi() });
  await assert.rejects(service.runAnalysis('someone-else', { resumeId: 'r1', jobId: 'j1' }), { code: 'NOT_FOUND', statusCode: 404 });
  await assert.rejects(run(service, { resumeId: 'r1', jobId: 'nope' }), { code: 'NOT_FOUND' });
});

test('a job with nothing recognizable is rejected before any AI call', async () => {
  const { db, state } = makeDb();
  state.job.description = 'Join our friendly team. We have free coffee and a lovely office in a nice town by the sea.';
  const ai = makeAi();
  await assert.rejects(run(createAnalysisService({ db, ai })), { code: 'INSUFFICIENT_REQUIREMENTS', statusCode: 422 });
  assert.equal(ai.calls.length, 0);
});
