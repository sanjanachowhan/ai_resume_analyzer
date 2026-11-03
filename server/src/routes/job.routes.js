import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadJobFile } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimiters.js';
import { createJobSchema } from '../validators/job.validators.js';
import {
  extractJobText, createJobDescription, listJobs, getJob, deleteJob,
} from '../controllers/job.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/extract', uploadLimiter, uploadJobFile, extractJobText);
router.post('/', validate(createJobSchema), createJobDescription);
router.get('/', listJobs);
router.get('/:id', getJob);
router.delete('/:id', deleteJob);

export default router;
