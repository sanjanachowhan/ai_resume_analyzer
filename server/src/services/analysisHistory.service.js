import { AppError } from '../utils/AppError.js';

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;

// Only the columns the list needs. The big AI text stays out of list responses.
const listSelect = {
  id: true,
  createdAt: true,
  overallScore: true,
  aiProvider: true,
  matchedSkills: true,
  missingSkills: true,
  resume: { select: { id: true, fileName: true } },
  jobDescription: { select: { id: true, title: true, company: true } },
};

// Query-string values are untrusted: clamp everything to safe ranges.
export function normalizeListQuery(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(query.pageSize, 10) || DEFAULT_PAGE_SIZE));
  const sort = query.sort === 'score' ? 'score' : 'date';
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
  return { page, pageSize, sort, q };
}

export function toListItem(row) {
  return {
    id: row.id,
    createdAt: row.createdAt,
    score: row.overallScore,
    aiAvailable: Boolean(row.aiProvider),
    matchedCount: Array.isArray(row.matchedSkills) ? row.matchedSkills.length : 0,
    missingCount: Array.isArray(row.missingSkills) ? row.missingSkills.length : 0,
    resume: row.resume,
    job: row.jobDescription,
  };
}

// db is injected (Prisma in the app, a fake in tests). Every query is filtered by userId.
export async function listAnalyses(db, userId, query) {
  const { page, pageSize, sort, q } = normalizeListQuery(query);

  const search = q
    ? {
        OR: [
          { jobDescription: { title: { contains: q, mode: 'insensitive' } } },
          { jobDescription: { company: { contains: q, mode: 'insensitive' } } },
          { resume: { fileName: { contains: q, mode: 'insensitive' } } },
        ],
      }
    : {};
  const where = { userId, ...search };
  const orderBy = sort === 'score' ? [{ overallScore: 'desc' }, { createdAt: 'desc' }] : [{ createdAt: 'desc' }];

  const [total, rows] = await Promise.all([
    db.analysis.count({ where }),
    db.analysis.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, select: listSelect }),
  ]);

  return {
    items: rows.map(toListItem),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// Numbers for the dashboard home: totals, average, best match, latest runs and a score trend.
export async function getAnalysisStats(db, userId) {
  const where = { userId };
  const [aggregate, best, recent, trendRows] = await Promise.all([
    db.analysis.aggregate({ where, _count: { _all: true }, _avg: { overallScore: true } }),
    db.analysis.findFirst({
      where,
      orderBy: [{ overallScore: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, overallScore: true, jobDescription: { select: { title: true, company: true } } },
    }),
    db.analysis.findMany({ where, orderBy: { createdAt: 'desc' }, take: 5, select: listSelect }),
    db.analysis.findMany({ where, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, createdAt: true, overallScore: true } }),
  ]);

  const total = aggregate._count._all;
  return {
    total,
    averageScore: total ? Math.round(aggregate._avg.overallScore) : null,
    highest: best ? { id: best.id, score: best.overallScore, jobTitle: best.jobDescription.title, company: best.jobDescription.company } : null,
    recent: recent.map(toListItem),
    trend: [...trendRows].reverse().map((r) => ({ id: r.id, date: r.createdAt, score: r.overallScore })), // oldest first for the chart
  };
}

export async function deleteAnalysis(db, userId, id) {
  const { count } = await db.analysis.deleteMany({ where: { id, userId } });
  if (count === 0) throw new AppError('Analysis not found.', 404, 'NOT_FOUND');
}
