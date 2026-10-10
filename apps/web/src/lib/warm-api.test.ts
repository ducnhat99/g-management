import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetWarmApiForTests, warmApi } from './warm-api';

describe('warmApi', () => {
  beforeEach(() => {
    resetWarmApiForTests();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com/');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('pings /health once per page load, without CORS or caching', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    warmApi(fetchMock);
    warmApi(fetchMock);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/health', {
      mode: 'no-cors',
      cache: 'no-store',
    });
  });

  it('ignores network errors', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('offline'));
    expect(() => warmApi(fetchMock)).not.toThrow();
    await Promise.resolve();
  });

  it('does nothing harmful when the API URL is not configured', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    const fetchMock = vi.fn();
    expect(() => warmApi(fetchMock)).not.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
