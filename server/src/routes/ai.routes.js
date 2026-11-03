import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { aiLimiter } from '../middleware/rateLimiters.js';
import { analyzeSchema } from '../validators/analysis.validators.js';
import { status, testConnection, analyze } from '../controllers/ai.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/status', status);
router.post('/test', aiLimiter, testConnection);
router.post('/analyze', aiLimiter, validate(analyzeSchema), analyze);

export default router;
