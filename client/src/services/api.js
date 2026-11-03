import axios from 'axios';

const TOKEN_KEY = 'resumeiq_token';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// AuthContext registers a callback here so an expired session logs the user out everywhere.
let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isAuthAttempt = url.includes('/auth/login') || url.includes('/auth/register');

    // A 401 outside login/register means the session is no longer valid.
    if (status === 401 && !isAuthAttempt && onUnauthorized) onUnauthorized();

    const body = error.response?.data?.error;
    const userMessage = error.response
      ? body?.message || 'Something went wrong. Please try again.'
      : 'Cannot reach the server. Check your connection and try again.';

    // Map validation details to { fieldName: message } for inline form errors.
    const fieldErrors = {};
    for (const d of body?.details || []) {
      if (d.field && !fieldErrors[d.field]) fieldErrors[d.field] = d.message;
    }

    return Promise.reject(Object.assign(error, { userMessage, fieldErrors }));
  }
);

export default api;
