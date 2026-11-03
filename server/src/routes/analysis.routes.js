import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { aiLimiter } from '../middleware/rateLimiters.js';
import { previewSchema, analyzeSchema } from '../validators/analysis.validators.js';
import { preview, create, list, stats, getOne, remove } from '../controllers/analysis.controller.js';

const router = Router();

router.use(requireAuth);

// Instant, deterministic score only (no AI, nothing saved).
router.post('/preview', validate(previewSchema), preview);

// Score + AI gap analysis, saved.
router.post('/', aiLimiter, validate(analyzeSchema), create);

// History. "/stats" must come before "/:id" so it is not mistaken for an id.
router.get('/stats', stats);
router.get('/', list);
router.get('/:id', getOne);
router.delete('/:id', remove);

export default router;
