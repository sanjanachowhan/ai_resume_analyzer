import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import {
  createResumeFromUpload,
  listResumesForUser,
  getResumeForUser,
  deleteResumeForUser,
} from '../services/resume.service.js';

export const uploadResume = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Please choose a resume file to upload.', 400, 'NO_FILE');
  }
  const { resume, duplicate } = await createResumeFromUpload(req.user.id, req.file);
  res.status(duplicate ? 200 : 201).json({ success: true, duplicate, resume });
});

export const listResumes = asyncHandler(async (req, res) => {
  const resumes = await listResumesForUser(req.user.id);
  res.json({ success: true, resumes });
});

export const getResume = asyncHandler(async (req, res) => {
  const resume = await getResumeForUser(req.user.id, req.params.id);
  res.json({ success: true, resume });
});

export const deleteResume = asyncHandler(async (req, res) => {
  await deleteResumeForUser(req.user.id, req.params.id);
  res.json({ success: true });
});
