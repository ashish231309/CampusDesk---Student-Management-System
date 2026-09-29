import { api } from './apiClient.js';

/**
 * Thin wrapper over the authentication endpoints. Every authentication request
 * in the app goes through here — components never call `api.post('/auth/...')`
 * themselves, so the endpoint names and payload shapes live in one file.
 */
export const authService = {
  register: (payload) => api.post('/auth/register', payload),
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  me: (options) => api.get('/auth/me', options),
};
