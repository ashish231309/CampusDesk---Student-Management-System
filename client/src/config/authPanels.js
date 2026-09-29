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
    eyebrow: 'Welcome back',
    heading: 'The register your campus actually keeps up with.',
    intro:
      'Sign in to pick up exactly where the records left off — the same search, filters and student history you closed yesterday.',
    highlights: [
      'One record per student, from registration to graduation.',
      'Search, filter and review the whole register in seconds.',
      'Enrolment numbers that reconcile without a spreadsheet.',
    ],
    back: { to: paths.home, label: 'Back to home', short: 'Home' },
  },

  [paths.register]: {
    eyebrow: 'Create your account',
    heading: 'Two minutes now, a tidy register later.',
    intro:
      'New accounts start with staff access to the student register. An administrator can raise that access later.',
    highlights: [
      'Create your own account — no provisioning ticket needed.',
      'Staff accounts manage the register; administrators can do more.',
      'Your session stays signed in across refreshes until you sign out.',
    ],
    back: { to: paths.login, label: 'Back to sign in', short: 'Sign in' },
  },
};
