import { useEffect } from 'react';

/**
 * Warn before a half-finished student record is lost.
 *
 * A form that has been edited is worth protecting from a stray reload, a closed
 * tab or a back-out to another site — the browser asks on the way out, and the
 * form itself asks before Cancel throws the changes away.
 *
 * What this deliberately is *not*: an in-app navigation blocker. The application
 * renders `BrowserRouter` rather than a data router, so the router cannot veto a
 * navigation from here; pretending otherwise would either need a router rebuild
 * or a half-working listener. Sidebar navigation inside the app is therefore
 * allowed to leave without a prompt — the browser-level guard below covers the
 * exits that cannot be recovered, and the form's Cancel action confirms.
 *
 * `isDirty` should already exclude a form that is submitting: the request is in
 * flight, not unsaved work.
 */
export const useUnsavedChanges = (isDirty) => {
  useEffect(() => {
    if (!isDirty) return undefined;

    const handleBeforeUnload = (event) => {
      // Browsers show their own wording; assigning returnValue is what asks them
      // to. `preventDefault` covers the modern contract.
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);
};
