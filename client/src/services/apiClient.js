import { appConfig } from '../config/app.js';

const TOKEN_STORAGE_KEY = 'campusdesk.auth.token';

/**
 * Normalised failure for every API call, so components can branch on
 * `error.details` (field-level validation) or `error.code` without caring
 * whether the problem was a network failure or a 4xx response.
 */
export class ApiRequestError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN', details = null } = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isNetworkError() {
    return this.code === 'NETWORK_ERROR';
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isValidationError() {
    return this.status === 422;
  }

  /**
   * The caller withdrew the request — a superseded search, a page that moved on
   * or a component that unmounted. It is not a failure, and nothing should tell
   * the user about it.
   */
  get isCancelled() {
    return this.code === 'CANCELLED';
  }
}

/**
 * Session token storage.
 *
 * CampusDesk authenticates with a bearer token that the client keeps and sends
 * on every request. It lives here — not in a component — so there is exactly
 * one place that reads, writes or clears it.
 */
export const authToken = {
  get: () => {
    try {
      return window.localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      /* storage can be unavailable in private browsing — the session simply
         does not persist across reloads. */
    }
  },
  clear: () => {
    try {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
};

/**
 * A 401 from these endpoints means "those credentials are wrong", not "your
 * session ended" — so they must not wipe an existing session.
 */
const CREDENTIAL_ENDPOINTS = ['/auth/login', '/auth/register'];

const unauthorizedListeners = new Set();

/**
 * Called when the API rejects the stored token (expired, revoked account or a
 * token signed for another secret). Whoever owns the session state subscribes
 * and drops it, so the UI can never stay in an authenticated-looking state with
 * a token the API no longer accepts.
 */
export const onUnauthorized = (listener) => {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
};

const notifyUnauthorized = () => {
  authToken.clear();
  unauthorizedListeners.forEach((listener) => listener());
};

const buildUrl = (path) => `${appConfig.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;

const parseBody = async (response) => {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const request = async (path, { method = 'GET', body, query, signal, timeout } = {}) => {
  const url = new URL(buildUrl(path), window.location.origin);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, value);
    });
  }

  const controller = new AbortController();
  // A caller's signal may already be aborted (the request became obsolete before
  // it started), in which case the fetch must not be attempted at all.
  if (signal?.aborted) {
    throw new ApiRequestError('The request was superseded before it was sent.', { code: 'CANCELLED' });
  }

  const abortTimer = setTimeout(() => controller.abort(), timeout ?? appConfig.apiTimeoutMs);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller);

  const token = authToken.get();
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = await parseBody(response);

    if (!response.ok) {
      if (response.status === 401 && token && !CREDENTIAL_ENDPOINTS.includes(path)) {
        notifyUnauthorized();
      }

      throw new ApiRequestError(
        payload?.error?.message ?? `The request failed with status ${response.status}.`,
        {
          status: response.status,
          code: payload?.error?.code ?? 'REQUEST_FAILED',
          details: payload?.error?.details ?? null,
        },
      );
    }

    return { data: payload?.data ?? null, meta: payload?.meta ?? null };
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;

    if (error?.name === 'AbortError') {
      // Distinguish "the caller moved on" from "the server never answered":
      // only the second one is worth showing anybody.
      if (signal?.aborted) {
        throw new ApiRequestError('The request was superseded by a newer one.', { code: 'CANCELLED' });
      }

      throw new ApiRequestError('The request took too long and was cancelled.', {
        code: 'TIMEOUT',
      });
    }

    throw new ApiRequestError(
      'CampusDesk could not reach the API. Make sure the server is running and try again.',
      { code: 'NETWORK_ERROR' },
    );
  } finally {
    clearTimeout(abortTimer);
    signal?.removeEventListener('abort', abortFromCaller);
  }
};

/**
 * `apiRequest` keeps the whole success envelope — `{ data, meta }`. Collection
 * endpoints put pagination in `meta`, so anything that pages through results
 * needs this; everything else uses the `api` helpers below, which unwrap
 * `data` for convenience.
 */
export const apiRequest = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};

const unwrap = (call) => async (path, bodyOrOptions, maybeOptions) => {
  const result = await call(path, bodyOrOptions, maybeOptions);
  return result.data;
};

export const api = {
  get: unwrap(apiRequest.get),
  post: unwrap(apiRequest.post),
  patch: unwrap(apiRequest.patch),
  put: unwrap(apiRequest.put),
  delete: unwrap(apiRequest.delete),
};

/** Turn any thrown value into a message that is safe to show a user. */
export const toErrorMessage = (error) =>
  error instanceof ApiRequestError
    ? error.message
    : 'Something unexpected went wrong. Please try again.';
