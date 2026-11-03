import { createHash } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { detectFileType } from '../utils/fileValidation.js';
import { parseResume } from './resumeParser.service.js';

// Light fields for list views (rawText can be large).
const listSelect = {
  id: true, fileName: true, fileType: true, fileSize: true, parsedData: true, createdAt: true,
};

export async function createResumeFromUpload(userId, file) {
  const fileType = detectFileType(file.buffer, file.originalname);
  if (!fileType) {
    throw new AppError(
      'Only PDF and DOCX files are supported, and the file content must match its extension.',
      400,
      'INVALID_FILE_TYPE'
    );
  }

  const { text, parsedData } = await parseResume({ buffer: file.buffer, fileType });

  // Same text already uploaded by this user? Reuse it instead of storing a duplicate.
  const contentHash = createHash('sha256').update(text).digest('hex');
  const existing = await prisma.resume.findFirst({ where: { userId, contentHash } });
  if (existing) return { resume: existing, duplicate: true };

  const resume = await prisma.resume.create({
    data: {
      userId,
      fileName: file.originalname.slice(0, 255),
      fileType,
      fileSize: file.size,
      rawText: text,
      contentHash,
      parsedData,
    },
  });
  return { resume, duplicate: false };
}

export function listResumesForUser(userId) {
  return prisma.resume.findMany({
    where: { userId },
    select: listSelect,
    orderBy: { createdAt: 'desc' },
  });
}

// Always filter by userId so one user can never read another user's resume.
export async function getResumeForUser(userId, id) {
  const resume = await prisma.resume.findFirst({ where: { id, userId } });
  if (!resume) throw new AppError('Resume not found.', 404, 'NOT_FOUND');
  return resume;
}

export async function deleteResumeForUser(userId, id) {
  const { count } = await prisma.resume.deleteMany({ where: { id, userId } });
  if (count === 0) throw new AppError('Resume not found.', 404, 'NOT_FOUND');
}
