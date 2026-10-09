import { VIETNAM_TIME_ZONE, formatVND } from '@gold/shared';

const dateTimeParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: VIETNAM_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hourCycle: 'h23',
});

/** ISO instant -> "09:15 09/10/2026" in Vietnam time (the same shape Ngọc Thịnh prints). */
export function formatDateTimeVN(iso: string): string {
  const parts = Object.fromEntries(
    dateTimeParts.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
  return `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}/${parts.year}`;
}

/** "2026-10-09" -> "09/10/2026". */
export function formatDateVN(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

/** Remaining time for the refresh countdown: "59:07", or "1:00:00" for a full hour. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

/** +6.920.000 ₫ / -55.000 ₫ / 0 ₫. */
export function formatSignedVND(amount: number): string {
  return amount > 0 ? `+${formatVND(amount)}` : formatVND(amount);
}

/** Tailwind text colour for a profit/loss: green profit, red loss. */
export function pnlColor(amount: number | null): string {
  if (amount === null || amount === 0) return 'text-stone-700';
  return amount > 0 ? 'text-emerald-700' : 'text-red-700';
}
