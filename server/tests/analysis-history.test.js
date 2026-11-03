import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeListQuery, toListItem, listAnalyses, getAnalysisStats, deleteAnalysis,
} from '../src/services/analysisHistory.service.js';

test('list queries are clamped to safe values', () => {
  assert.deepEqual(normalizeListQuery({}), { page: 1, pageSize: 10, sort: 'date', q: '' });
  assert.deepEqual(normalizeListQuery({ page: '-5', pageSize: '9999', sort: 'DROP TABLE', q: '  react  ' }), { page: 1, pageSize: 50, sort: 'date', q: 'react' });
  assert.equal(normalizeListQuery({ page: 'abc' }).page, 1);
  assert.equal(normalizeListQuery({ pageSize: '0' }).pageSize, 10);
  assert.equal(normalizeListQuery({ sort: 'score' }).sort, 'score');
  assert.equal(normalizeListQuery({ q: 'x'.repeat(500) }).q.length, 100);
  assert.equal(normalizeListQuery({ q: ['a', 'b'] }).q, ''); // repeated params are ignored
});

const row = (n) => ({
  id: `a${n}`, createdAt: new Date(2026, 0, n), overallScore: 50 + n, aiProvider: n % 2 ? 'gemini' : null,
  matchedSkills: [{}, {}], missingSkills: [{}], resume: { id: 'r', fileName: 'cv.pdf' }, jobDescription: { id: 'j', title: `Job ${n}`, company: 'Acme' },
});

test('list rows become small API items', () => {
  const item = toListItem(row(1));
  assert.deepEqual(item, {
    id: 'a1', createdAt: row(1).createdAt, score: 51, aiAvailable: true, matchedCount: 2, missingCount: 1,
    resume: { id: 'r', fileName: 'cv.pdf' }, job: { id: 'j', title: 'Job 1', company: 'Acme' },
  });
  assert.equal(toListItem({ ...row(2), matchedSkills: null }).matchedCount, 0);
});

test('listing is scoped to the user, paginated, sorted and searchable', async () => {
  const seen = [];
  const db = {
    analysis: {
      count: async (args) => { seen.push(['count', args]); return 23; },
      findMany: async (args) => { seen.push(['findMany', args]); return [row(1), row(2)]; },
    },
  };

  const result = await listAnalyses(db, 'u1', { page: '3', pageSize: '10', sort: 'score', q: 'React' });
  assert.equal(result.total, 23);
  assert.equal(result.totalPages, 3);
  assert.equal(result.page, 3);
  assert.equal(result.items.length, 2);

  const [, find] = seen.find(([name]) => name === 'findMany');
  assert.equal(find.where.userId, 'u1');
  assert.equal(find.skip, 20);
  assert.equal(find.take, 10);
  assert.deepEqual(find.orderBy, [{ overallScore: 'desc' }, { createdAt: 'desc' }]);
  assert.equal(find.where.OR.length, 3); // title, company, resume file name
  assert.equal(find.where.OR[0].jobDescription.title.contains, 'React');

  const [, count] = seen.find(([name]) => name === 'count');
  assert.equal(count.where.userId, 'u1'); // the total uses the same filter
});

test('without a search term there is no OR filter, and an empty history has one page', async () => {
  let where;
  const db = { analysis: { count: async (a) => { where = a.where; return 0; }, findMany: async () => [] } };
  const result = await listAnalyses(db, 'u1', {});
  assert.deepEqual(where, { userId: 'u1' });
  assert.deepEqual([result.total, result.totalPages, result.items.length], [0, 1, 0]);
});

test('dashboard stats: totals, average, best match, recent runs and an oldest-first trend', async () => {
  const filters = [];
  const db = {
    analysis: {
      aggregate: async (a) => { filters.push(a.where); return { _count: { _all: 3 }, _avg: { overallScore: 66.67 } }; },
      findFirst: async (a) => { filters.push(a.where); return { id: 'a3', overallScore: 90, jobDescription: { title: 'Best Job', company: null } }; },
      findMany: async (a) => {
        filters.push(a.where);
        return a.take === 5 ? [row(3), row(2), row(1)] : [{ id: 'a3', createdAt: new Date(2026, 0, 3), overallScore: 90 }, { id: 'a1', createdAt: new Date(2026, 0, 1), overallScore: 40 }];
      },
    },
  };
  const stats = await getAnalysisStats(db, 'u1');

  assert.equal(stats.total, 3);
  assert.equal(stats.averageScore, 67);
  assert.deepEqual(stats.highest, { id: 'a3', score: 90, jobTitle: 'Best Job', company: null });
  assert.equal(stats.recent.length, 3);
  assert.deepEqual(stats.trend.map((t) => t.score), [40, 90]); // oldest first
  assert.ok(filters.every((w) => w.userId === 'u1'));
});

test('stats for a new user are empty, not zero', async () => {
  const db = {
    analysis: {
      aggregate: async () => ({ _count: { _all: 0 }, _avg: { overallScore: null } }),
      findFirst: async () => null,
      findMany: async () => [],
    },
  };
  const stats = await getAnalysisStats(db, 'u1');
  assert.deepEqual([stats.total, stats.averageScore, stats.highest, stats.recent, stats.trend], [0, null, null, [], []]);
});

test("deleting is limited to the user's own analyses", async () => {
  let args;
  const db = { analysis: { deleteMany: async (a) => { args = a; return { count: a.where.userId === 'u1' ? 1 : 0 }; } } };
  await deleteAnalysis(db, 'u1', 'a1');
  assert.deepEqual(args.where, { id: 'a1', userId: 'u1' });
  await assert.rejects(deleteAnalysis(db, 'someone-else', 'a1'), { code: 'NOT_FOUND', statusCode: 404 });
});
