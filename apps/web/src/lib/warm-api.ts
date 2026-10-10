import { publicEnv } from './env';

let warmed = false;

/**
 * Pings the API's public /health once per page load, so a sleeping API host (Render free plan)
 * starts waking up while the user is still on the login page or the page is rendering.
 * Fire-and-forget: `no-cors` because only the request matters, never the response, and every error
 * is ignored.
 */
export function warmApi(fetchImpl: typeof fetch = fetch): void {
  if (warmed) return;
  warmed = true;
  try {
    void fetchImpl(`${publicEnv().apiUrl}/health`, { mode: 'no-cors', cache: 'no-store' }).catch(
      () => {},
    );
  } catch {
    // Missing env or no fetch: nothing to warm.
  }
}

/** Test helper. */
export function resetWarmApiForTests(): void {
  warmed = false;
}
