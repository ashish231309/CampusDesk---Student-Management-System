import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Keeps the scroll position sensible when moving between routes. */
export const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);

  return null;
};
