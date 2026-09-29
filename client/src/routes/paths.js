/** Every route in the app, in one place, so links never drift from the router. */
export const paths = {
  home: '/',
  login: '/login',
  dashboard: '/dashboard',
  students: '/students',
  newStudent: '/students/new',
  student: (id = ':id') => `/students/${id}`,
  editStudent: (id = ':id') => `/students/${id}/edit`,
};

export const notFound = '*';
