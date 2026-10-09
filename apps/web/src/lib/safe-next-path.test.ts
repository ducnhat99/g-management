import { describe, expect, it } from 'vitest';
import { safeNextPath } from './safe-next-path';

describe('safeNextPath', () => {
  it.each(['/dashboard', '/purchases/123?tab=edit', '/'])('keeps the local path %s', (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    null,
    undefined,
    '',
    'dashboard',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/login',
    '/login?next=/x',
  ])('falls back to /dashboard for %j', (path) => {
    expect(safeNextPath(path)).toBe('/dashboard');
  });
});
