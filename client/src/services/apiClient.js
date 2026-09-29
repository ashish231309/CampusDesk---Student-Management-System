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

  get isNotImplemented() {
    return this.status === 501;
  }

  get isUnauthorized() {
    return this.status === 401;
  }
}

/** Session token storage. Used by the authentication stage; kept here so every
 * request path shares one implementation. */
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
      credentials: 'include',
      signal: controller.signal,
    });

    const payload = await parseBody(response);

    if (!response.ok) {
      throw new ApiRequestError(
        payload?.error?.message ?? `The request failed with status ${response.status}.`,
        {
          status: response.status,
          code: payload?.error?.code ?? 'REQUEST_FAILED',
          details: payload?.error?.details ?? null,
        },
      );
    }

    return payload?.data ?? null;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;

    if (error?.name === 'AbortError') {
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

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};

/** Turn any thrown value into a message that is safe to show a user. */
export const toErrorMessage = (error) =>
  error instanceof ApiRequestError
    ? error.message
    : 'Something unexpected went wrong. Please try again.';
