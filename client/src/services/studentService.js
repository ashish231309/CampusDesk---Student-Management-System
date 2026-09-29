import { api } from './apiClient.js';

/** Student endpoints. `list` accepts the search / filter / pagination query. */
export const studentService = {
  list: ({ search, status, year, department, page, limit, sort } = {}, options) =>
    api.get('/students', {
      ...options,
      query: { search, status, year, department, page, limit, sort },
    }),
  stats: (options) => api.get('/students/stats', options),
  getById: (id, options) => api.get(`/students/${id}`, options),
  create: (payload) => api.post('/students', payload),
  update: (id, payload) => api.patch(`/students/${id}`, payload),
  remove: (id) => api.delete(`/students/${id}`),
};
