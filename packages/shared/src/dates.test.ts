import { describe, expect, it } from 'vitest';
import { isIsoDate, todayInVietnam } from './dates';

describe('todayInVietnam', () => {
  it('is already "tomorrow" at 18:00 UTC (01:00 in Vietnam)', () => {
    expect(todayInVietnam(new Date('2026-10-08T18:00:00Z'))).toBe('2026-10-09');
  });

  it('is still "today" at 16:59 UTC (23:59 in Vietnam)', () => {
    expect(todayInVietnam(new Date('2026-10-09T16:59:00Z'))).toBe('2026-10-09');
  });
});

describe('isIsoDate', () => {
  it.each(['2026-10-09', '2024-02-29'])('accepts %s', (value) => {
    expect(isIsoDate(value)).toBe(true);
  });

  it.each(['2026-02-31', '2025-02-29', '2026-13-01', '09/10/2026', '2026-10-9', ''])(
    'rejects %j',
    (value) => {
      expect(isIsoDate(value)).toBe(false);
    },
  );
});
