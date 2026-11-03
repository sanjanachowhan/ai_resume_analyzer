import { asyncHandler } from '../utils/asyncHandler.js';
import { previewMatch } from '../services/match.service.js';
import {
  runAnalysis, getAnalysis, listUserAnalyses, getUserStats, removeAnalysis,
} from '../services/analysis.service.js';

export const preview = asyncHandler(async (req, res) => {
  const data = await previewMatch(req.user.id, req.body);
  res.json({ success: true, ...data });
});

// Full analysis: score + AI gap analysis, saved to the database.
export const create = asyncHandler(async (req, res) => {
  const { analysis, cached } = await runAnalysis(req.user.id, req.body);
  res.status(cached ? 200 : 201).json({ success: true, cached, analysis });
});

export const list = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await listUserAnalyses(req.user.id, req.query)) });
});

export const stats = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await getUserStats(req.user.id)) });
});

export const getOne = asyncHandler(async (req, res) => {
  const analysis = await getAnalysis(req.user.id, req.params.id);
  res.json({ success: true, analysis });
});

export const remove = asyncHandler(async (req, res) => {
  await removeAnalysis(req.user.id, req.params.id);
  res.json({ success: true });
});
