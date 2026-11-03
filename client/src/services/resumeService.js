import api from './api.js';

export const resumeService = {
  // onProgress receives axios upload progress events
  upload(file, onProgress) {
    const formData = new FormData();
    formData.append('resume', file);
    return api
      .post('/resumes/upload', formData, { onUploadProgress: onProgress, timeout: 60000 })
      .then((res) => res.data);
  },
  list: () => api.get('/resumes').then((res) => res.data.resumes),
  get: (id) => api.get(`/resumes/${id}`).then((res) => res.data.resume),
  remove: (id) => api.delete(`/resumes/${id}`).then((res) => res.data),
};
