import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { analyzeJobDescription } from './jobAnalyzer.service.js';

const PREVIEW_LENGTH = 200;

// Skill extraction must never stop a job description from being saved; the text is stored either way.
function safeAnalyze(description) {
  try {
    return analyzeJobDescription(description);
  } catch (err) {
    console.error('Job description analysis failed:', err.message);
    return undefined;
  }
}

export function createJob(userId, { title, company, description }) {
  return prisma.jobDescription.create({
    data: { userId, title, company, description, parsedData: safeAnalyze(description) },
  });
}

export async function listJobsForUser(userId) {
  const jobs = await prisma.jobDescription.findMany({
    where: { userId },
    select: { id: true, title: true, company: true, description: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  // List views get a short preview instead of the whole text.
  return jobs.map(({ description, ...job }) => ({ ...job, preview: description.slice(0, PREVIEW_LENGTH) }));
}

// Always filter by userId so one user can never read another user's data.
export async function getJobForUser(userId, id) {
  const job = await prisma.jobDescription.findFirst({ where: { id, userId } });
  if (!job) throw new AppError('Job description not found.', 404, 'NOT_FOUND');
  return job;
}

export async function deleteJobForUser(userId, id) {
  const { count } = await prisma.jobDescription.deleteMany({ where: { id, userId } });
  if (count === 0) throw new AppError('Job description not found.', 404, 'NOT_FOUND');
}
