import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { uploadResumeFile } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimiters.js';
import { uploadResume, listResumes, getResume, deleteResume } from '../controllers/resume.controller.js';

const router = Router();

// Authenticate first so anonymous requests never get to upload anything.
router.use(requireAuth);

router.post('/upload', uploadLimiter, uploadResumeFile, uploadResume);
router.get('/', listResumes);
router.get('/:id', getResume);
router.delete('/:id', deleteResume);

export default router;
