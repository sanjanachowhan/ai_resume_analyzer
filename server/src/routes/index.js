import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import resumeRoutes from './resume.routes.js';
import jobRoutes from './job.routes.js';
import analysisRoutes from './analysis.routes.js';
import aiRoutes from './ai.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/resumes', resumeRoutes);
router.use('/jobs', jobRoutes);
router.use('/analysis', analysisRoutes);
router.use('/ai', aiRoutes);

export default router;
