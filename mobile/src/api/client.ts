import axios from 'axios';

// Change to your local IP in dev, Railway URL in production
export const SERVER_ORIGIN = __DEV__
  ? 'http://192.168.1.100:3001'       // ← replace with your machine's local IP
  : 'https://truma-plus-production.up.railway.app';

export const api = axios.create({
  baseURL: `${SERVER_ORIGIN}/api`,
  timeout: 15000,
});
