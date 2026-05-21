import axios from 'axios';

// In production: client is served by the same Express server → use relative URL
// In development: Vite proxies /api to localhost:3001 → also use relative URL
const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('dp_token');
      localStorage.removeItem('dp_role');
    }
    return Promise.reject(err);
  }
);

export default api;
