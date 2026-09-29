import { api } from './apiClient.js';

/**
 * Thin wrapper over the authentication endpoints. The API currently answers
 * these with 501 until the authentication stage lands; the call signatures are
 * final so only the provider has to change later.
 */
export const authService = {
  register: (payload) => api.post('/auth/register', payload),
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  me: (options) => api.get('/auth/me', options),
};
