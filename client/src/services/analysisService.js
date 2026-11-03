import api from './api.js';

export const analysisService = {
  // Score + AI gap analysis, saved on the server. AI calls can be slow, so allow up to two minutes.
  run: ({ resumeId, jobId, force = false }) =>
    api.post('/analysis', { resumeId, jobId, force }, { timeout: 120000 }).then((res) => res.data),
  get: (id) => api.get(`/analysis/${id}`).then((res) => res.data.analysis),
  // params: { page, pageSize, sort: 'date' | 'score', q }
  list: (params) => api.get('/analysis', { params }).then((res) => res.data),
  stats: () => api.get('/analysis/stats').then((res) => res.data),
  remove: (id) => api.delete(`/analysis/${id}`).then((res) => res.data),
};
