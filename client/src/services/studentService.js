import { api, apiRequest } from './apiClient.js';

/**
 * The only place the frontend talks to the student endpoints.
 *
 * Pages and hooks call these functions; none of them build URLs, read the
 * response envelope or know about pagination metadata. The API's own parameter
 * names are mapped here rather than in components, so the query the server
 * receives stays in step with the allowlists in `server/src/validators`.
 */

/** Drop empty entries so a blank filter is simply not sent. */
const cleanQuery = (query) =>
  Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== '' && value !== undefined && value !== null),
  );

/**
 * Anything that changes the register announces itself here, so a screen that is
 * already open (the dashboard's statistics, for instance) can refresh instead of
 * showing numbers that no longer match the list. It is a plain listener set
 * rather than a state library: the pages still fetch their own data.
 */
const changeListeners = new Set();

export const onStudentsChanged = (listener) => {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
};

const announceChange = () => changeListeners.forEach((listener) => listener());

export const studentService = {
  /**
   * One page of the register. Returns the rows plus the API's pagination
   * metadata, so callers never compute totals themselves.
   */
  list: async (query = {}, options) => {
    const { data, meta } = await apiRequest.get('/students', {
      ...options,
      query: cleanQuery({
        search: query.search,
        status: query.status,
        year: query.year,
        department: query.department,
        course: query.course,
        sort: query.sort,
        order: query.order,
        page: query.page,
        limit: query.limit,
      }),
    });

    return { students: data?.students ?? [], meta };
  },

  /** Dashboard totals, distributions and recent registrations. */
  stats: (options) => api.get('/students/stats', options).then((data) => data?.stats ?? null),

  /**
   * Values for the filter controls. Courses and departments come back from the
   * data itself, so a course entered yesterday is filterable today.
   */
  filters: (options) => api.get('/students/filters', options).then((data) => data?.options ?? null),

  getById: (id, options) =>
    api.get(`/students/${id}`, options).then((data) => data?.student ?? null),

  create: (payload) =>
    api.post('/students', payload).then((data) => {
      announceChange();
      return data?.student ?? null;
    }),

  update: (id, payload) =>
    api.patch(`/students/${id}`, payload).then((data) => {
      announceChange();
      return data?.student ?? null;
    }),

  remove: (id) =>
    api.delete(`/students/${id}`).then((data) => {
      announceChange();
      return data;
    }),
};
