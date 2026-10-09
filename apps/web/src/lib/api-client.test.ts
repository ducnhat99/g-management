import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { ApiError, createApiClient, type ApiAuth } from './api-client';

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('createApiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  let auth: {
    getAccessToken: Mock<ApiAuth['getAccessToken']>;
    refreshAccessToken: Mock<ApiAuth['refreshAccessToken']>;
    onUnauthorized: Mock<ApiAuth['onUnauthorized']>;
  };

  const client = () => createApiClient({ baseUrl: 'http://api.test', auth, fetch: fetchMock });
  const authHeaderOfCall = (n: number) =>
    new Headers(fetchMock.mock.calls[n]?.[1]?.headers).get('Authorization');

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    auth = {
      getAccessToken: vi.fn<ApiAuth['getAccessToken']>().mockResolvedValue('token-1'),
      refreshAccessToken: vi.fn<ApiAuth['refreshAccessToken']>().mockResolvedValue('token-2'),
      onUnauthorized: vi.fn<ApiAuth['onUnauthorized']>(),
    };
  });

  it('sends the access token as a Bearer header and returns the JSON body', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true }));
    await expect(client().get('/portfolio/summary')).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://api.test/portfolio/summary');
    expect(authHeaderOfCall(0)).toBe('Bearer token-1');
  });

  it('on 401, refreshes the session and retries once with the new token', async () => {
    fetchMock.mockResolvedValueOnce(json(401)).mockResolvedValueOnce(json(200, { ok: true }));
    await expect(client().get('/purchases')).resolves.toEqual({ ok: true });
    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(authHeaderOfCall(1)).toBe('Bearer token-2');
    expect(auth.onUnauthorized).not.toHaveBeenCalled();
  });

  it('still 401 after the refresh: calls onUnauthorized and throws', async () => {
    fetchMock.mockResolvedValue(json(401, { message: 'Invalid or expired token' }));
    const error = await client()
      .get('/purchases')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, message: 'Invalid or expired token' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(auth.onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('refresh fails (signed out): does not retry, calls onUnauthorized', async () => {
    auth.refreshAccessToken.mockResolvedValue(null);
    fetchMock.mockResolvedValue(json(401));
    await expect(client().get('/purchases')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(auth.onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('sends no Authorization header without a session', async () => {
    auth.getAccessToken.mockResolvedValue(null);
    fetchMock.mockResolvedValue(json(200, []));
    await client().get('/purchases');
    expect(authHeaderOfCall(0)).toBeNull();
  });

  it('throws ApiError with the server message for other errors, without refreshing', async () => {
    fetchMock.mockResolvedValue(
      json(429, { statusCode: 429, message: 'too soon', nextRefreshAt: '2026-10-09T08:00:00Z' }),
    );
    const error = await client()
      .post('/prices/refresh')
      .catch((e: unknown) => e);
    expect(error).toMatchObject({
      status: 429,
      message: 'too soon',
      body: { nextRefreshAt: '2026-10-09T08:00:00Z' },
    });
    expect(auth.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('sends JSON bodies and handles 204 No Content', async () => {
    fetchMock.mockResolvedValueOnce(json(201, { id: 'p1' })).mockResolvedValueOnce(json(204));
    await expect(client().post('/purchases', { quantity: '1' })).resolves.toEqual({ id: 'p1' });
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"quantity":"1"}');
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
    await expect(client().delete('/purchases/p1')).resolves.toBeUndefined();
  });
});
