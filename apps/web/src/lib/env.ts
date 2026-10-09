// NEXT_PUBLIC_* values are inlined at build time, so each must be read as a literal
// `process.env.NEXT_PUBLIC_...` expression. Read lazily so a missing value fails where it is used,
// with a clear message, instead of at import time.

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is not set. Copy apps/web/.env.example to apps/web/.env.local.`);
  }
  return value;
}

export function publicEnv() {
  return {
    supabaseUrl: required(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
    supabaseKey: required(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    ),
    apiUrl: required(process.env.NEXT_PUBLIC_API_URL, 'NEXT_PUBLIC_API_URL').replace(/\/+$/, ''),
  };
}
