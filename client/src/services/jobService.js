import api from './api.js';

export const jobService = {
  // Upload a PDF/DOCX and get its extracted text back (nothing is saved yet).
  extract(file) {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/jobs/extract', formData, { timeout: 60000 }).then((res) => res.data);
  },
  create: (payload) => api.post('/jobs', payload).then((res) => res.data),
  list: () => api.get('/jobs').then((res) => res.data.jobs),
  get: (id) => api.get(`/jobs/${id}`).then((res) => res.data.job),
  remove: (id) => api.delete(`/jobs/${id}`).then((res) => res.data),
};
