import { paths } from '../routes/paths.js';

/**
 * The copy the brand panel changes between the two public account screens.
 *
 * It lives here, rather than in the layout file, because it is data: the layout
 * renders it, the route table points at it, and neither of the forms knows it
 * exists.
 */
export const authPanels = {
  [paths.login]: {
    heading: 'The register your campus actually keeps up with.',
    highlights: [
      'One record per student, from registration to graduation.',
      'Search, filter and review the whole register in seconds.',
      'Enrolment numbers that reconcile without a spreadsheet.',
    ],
    back: { to: paths.home, label: 'Back to home' },
  },

  [paths.register]: {
    heading: 'Two minutes now, a tidy register later.',
    highlights: [
      'Create your own account in a minute — no provisioning ticket needed.',
      'Staff accounts manage the student register; administrators can do more.',
      'Your session stays signed in across refreshes until you sign out.',
    ],
    back: { to: paths.login, label: 'Back to sign in' },
  },
};
