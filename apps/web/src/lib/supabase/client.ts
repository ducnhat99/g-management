import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from '../env';

let client: SupabaseClient | undefined;

/** Supabase client for Client Components. Used only for auth; data goes through our API. */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!client) {
    const { supabaseUrl, supabaseKey } = publicEnv();
    client = createBrowserClient(supabaseUrl, supabaseKey);
  }
  return client;
}
