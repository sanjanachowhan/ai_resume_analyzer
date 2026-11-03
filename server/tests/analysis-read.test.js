import test from 'node:test';
import assert from 'node:assert/strict';
import { getAnalysisForUser } from '../src/services/analysisPipeline.service.js';

const row = {
  id: 'a1', userId: 'u1', createdAt: new Date(), overallScore: 72, skillScore: 80, keywordScore: 70,
  experienceScore: 100, educationScore: 100, responsibilityScore: 60, softSkillScore: 50,
  matchedSkills: [{ skill: 'React' }], missingSkills: [], suggestions: ['x'], aiAnalysis: null, aiMeta: null, matchDetails: null,
  resume: { id: 'r1', fileName: 'cv.pdf' }, jobDescription: { id: 'j1', title: 'Dev', company: null },
};
const db = { analysis: { findFirst: async ({ where }) => (where.id === 'a1' && where.userId === 'u1' ? row : null) } };

test('an owner can open their saved analysis in the API shape', async () => {
  const analysis = await getAnalysisForUser(db, 'u1', 'a1');
  assert.equal(analysis.scores.overall, 72);
  assert.equal(analysis.resume.fileName, 'cv.pdf');
  assert.equal(analysis.job.title, 'Dev');
  assert.equal(analysis.aiAvailable, false);
  assert.deepEqual(analysis.skills.partial, []); // older/partial rows still produce a complete shape
});

test("someone else's analysis, or a missing one, is a 404", async () => {
  await assert.rejects(getAnalysisForUser(db, 'u2', 'a1'), { code: 'NOT_FOUND', statusCode: 404 });
  await assert.rejects(getAnalysisForUser(db, 'u1', 'nope'), { code: 'NOT_FOUND' });
});
