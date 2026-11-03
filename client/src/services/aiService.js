import api from './api.js';

export const aiService = {
  status: () => api.get('/ai/status').then((res) => res.data),
  // AI calls can take a while, so allow more time than the default
  test: () => api.post('/ai/test', null, { timeout: 90000 }).then((res) => res.data),
};
