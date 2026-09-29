/**
 * Client-side application configuration.
 * Anything that differs between environments is read from Vite env vars;
 * everything else is a product-level constant.
 */
export const appConfig = {
  name: 'CampusDesk',
  tagline: 'Student Management System',
  year: new Date().getFullYear(),

  /** Empty by default so requests go through the Vite proxy as `/api/...`. */
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, ''),
  apiTimeoutMs: Number(import.meta.env.VITE_API_TIMEOUT_MS) || 15000,

  /**
   * Development-only convenience: lets the application shell be reviewed while
   * the authentication endpoints are still being built. It never applies to a
   * production build, and it is removed in the authentication stage together
   * with the sample student data.
   */
  previewSession: import.meta.env.DEV && import.meta.env.VITE_PREVIEW_SESSION !== 'false',
};
