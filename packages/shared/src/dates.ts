export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

// en-CA formats dates as YYYY-MM-DD.
const vietnamDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: VIETNAM_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's calendar date in Vietnam as YYYY-MM-DD, whatever the machine's time zone. */
export function todayInVietnam(now: Date = new Date()): string {
  return vietnamDateFormat.format(now);
}

/** True for a real calendar date written as YYYY-MM-DD (rejects 2026-02-31). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
