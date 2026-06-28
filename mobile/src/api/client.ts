import axios from 'axios';

// Change to your local IP in dev, Railway URL in production
const BASE_URL = __DEV__
  ? 'http://192.168.1.100:3001/api'   // ← replace with your machine's local IP
  : 'https://truma-plus-production.up.railway.app/api';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});
