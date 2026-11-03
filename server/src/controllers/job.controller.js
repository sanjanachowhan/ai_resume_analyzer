import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { extractDocumentText } from '../services/documentText.service.js';
import { createJob, listJobsForUser, getJobForUser, deleteJobForUser } from '../services/job.service.js';

// Upload a document and get its text back, without saving anything.
// The user reviews/edits the text and then saves it with POST /api/jobs.
export const extractJobText = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Please choose a file to upload.', 400, 'NO_FILE');
  }
  const text = await extractDocumentText(req.file);
  res.json({ success: true, text, fileName: req.file.originalname });
});

export const createJobDescription = asyncHandler(async (req, res) => {
  const job = await createJob(req.user.id, req.body);
  res.status(201).json({ success: true, job });
});

export const listJobs = asyncHandler(async (req, res) => {
  const jobs = await listJobsForUser(req.user.id);
  res.json({ success: true, jobs });
});

export const getJob = asyncHandler(async (req, res) => {
  const job = await getJobForUser(req.user.id, req.params.id);
  res.json({ success: true, job });
});

export const deleteJob = asyncHandler(async (req, res) => {
  await deleteJobForUser(req.user.id, req.params.id);
  res.json({ success: true });
});
