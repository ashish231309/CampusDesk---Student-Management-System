import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { routeTitle } from '../routes/routeMeta.js';

/**
 * Keeps the browser tab honest. Every route has a title in `routeMeta`, and a
 * page may pass its own once it knows something the URL cannot say — a student's
 * name on a detail screen, for instance.
 */
export const useDocumentTitle = (title) => {
  const { pathname } = useLocation();
  const resolved = title ?? routeTitle(pathname);

  useEffect(() => {
    if (document.title !== resolved) document.title = resolved;
  }, [resolved]);
};
