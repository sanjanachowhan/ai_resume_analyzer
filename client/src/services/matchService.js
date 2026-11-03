import api from './api.js';

export const matchService = {
  // Deterministic match score for one resume and one job description (nothing is saved).
  preview: ({ resumeId, jobId }) => api.post('/analysis/preview', { resumeId, jobId }).then((res) => res.data),
};
