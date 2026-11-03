import { prisma } from '../config/prisma.js';
import { generateStructured, getProvider } from '../ai/aiService.js';
import { createAnalysisService, getAnalysisForUser } from './analysisPipeline.service.js';
import { listAnalyses, getAnalysisStats, deleteAnalysis } from './analysisHistory.service.js';

// The real database and AI wired into the services.
export const { runAnalysis } = createAnalysisService({ db: prisma, ai: { generateStructured, getProvider } });

export const getAnalysis = (userId, id) => getAnalysisForUser(prisma, userId, id);
export const listUserAnalyses = (userId, query) => listAnalyses(prisma, userId, query);
export const getUserStats = (userId) => getAnalysisStats(prisma, userId);
export const removeAnalysis = (userId, id) => deleteAnalysis(prisma, userId, id);
