/** A non-2xx response from our API. `body` is the parsed JSON error, when there is one. */
export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    readonly status: number,
    readonly body: unknown,
    message: string,
  ) {
    super(message);
  }
}

export interface ApiAuth {
  /** The current access token, or null when signed out. */
  getAccessToken(): Promise<string | null>;
  /** Refresh the session; the new access token, or null if refreshing failed. */
  refreshAccessToken(): Promise<string | null>;
  /** Called when the API still says 401 after a refresh: sign out and go to /login. */
  onUnauthorized(): Promise<void> | void;
}

export interface ApiClientOptions {
  baseUrl: string;
  auth: ApiAuth;
  fetch?: typeof fetch;
}

function messageOf(body: unknown, status: number): string {
  const message = (body as { message?: unknown } | null)?.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.join(', ');
  return `Request failed with status ${status}`;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Calls the NestJS API with `Authorization: Bearer <Supabase access token>`. On a 401 it refreshes
 * the session and retries once; if that still fails it calls `onUnauthorized` and throws.
 */
export function createApiClient({ baseUrl, auth, fetch: fetchImpl = fetch }: ApiClientOptions) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const send = (token: string | null) =>
      fetchImpl(`${baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(init.body !== undefined && { 'Content-Type': 'application/json' }),
          ...(token && { Authorization: `Bearer ${token}` }),
          ...init.headers,
        },
      });

    let response = await send(await auth.getAccessToken());
    if (response.status === 401) {
      const refreshed = await auth.refreshAccessToken();
      if (refreshed) {
        response = await send(refreshed);
      }
      if (response.status === 401) {
        await auth.onUnauthorized();
      }
    }

    const body = await parseBody(response);
    if (!response.ok) {
      throw new ApiError(response.status, body, messageOf(body, response.status));
    }
    return body as T;
  }

  const withBody = (method: string) => (path: string, body?: unknown) =>
    request<unknown>(path, {
      method,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });

  return {
    request,
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body?: unknown) => withBody('POST')(path, body) as Promise<T>,
    patch: <T>(path: string, body?: unknown) => withBody('PATCH')(path, body) as Promise<T>,
    delete: (path: string) => request<void>(path, { method: 'DELETE' }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
