import { createApiClient, type ApiClient } from './api-client';
import { publicEnv } from './env';
import { getSupabaseBrowserClient } from './supabase/client';

let api: ApiClient | undefined;

/** API client for Client Components, authenticated with the browser's Supabase session. */
export function getApi(): ApiClient {
  if (!api) {
    const supabase = getSupabaseBrowserClient();
    api = createApiClient({
      baseUrl: publicEnv().apiUrl,
      auth: {
        async getAccessToken() {
          const { data } = await supabase.auth.getSession();
          return data.session?.access_token ?? null;
        },
        async refreshAccessToken() {
          const { data } = await supabase.auth.refreshSession();
          return data.session?.access_token ?? null;
        },
        async onUnauthorized() {
          await supabase.auth.signOut();
          // A full reload on purpose: it drops every cached query of the signed-out session, and
          // this runs outside React, where useRouter() is not available.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign('/login');
        },
      },
    });
  }
  return api;
}
