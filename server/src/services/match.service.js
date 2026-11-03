import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { calculateMatch } from './scoreCalculator.service.js';

// Scores a resume against a job description for the logged-in user. Nothing is saved.
export async function previewMatch(userId, { resumeId, jobId }) {
  // Both lookups are filtered by userId, so users can only compare their own data.
  const [resume, job] = await Promise.all([
    prisma.resume.findFirst({ where: { id: resumeId, userId } }),
    prisma.jobDescription.findFirst({ where: { id: jobId, userId } }),
  ]);
  if (!resume) throw new AppError('Resume not found.', 404, 'NOT_FOUND');
  if (!job) throw new AppError('Job description not found.', 404, 'NOT_FOUND');

  const result = calculateMatch({ resume, job });
  if (result.overallScore === null) {
    throw new AppError(
      "This job description doesn't contain enough recognizable requirements to calculate a match. Try saving the full job posting.",
      422,
      'INSUFFICIENT_REQUIREMENTS'
    );
  }

  return {
    resume: { id: resume.id, fileName: resume.fileName },
    job: { id: job.id, title: job.title, company: job.company },
    result,
  };
}
