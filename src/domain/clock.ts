// Server-side timestamps in Opelika local time. Vercel servers run in UTC, so times
// must never come from the process time zone.
export const FLEET_TIME_ZONE = 'America/Chicago';

const timeFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: FLEET_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const dateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: FLEET_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? '00';
}

/** HH:MM:SS in Opelika local time. */
export function localTime(now: Date): string {
  const parts = timeFormat.formatToParts(now);
  return `${part(parts, 'hour')}:${part(parts, 'minute')}:${part(parts, 'second')}`;
}

/** YYYY-MM-DD in Opelika local time. */
export function localDate(now: Date): string {
  const parts = dateFormat.formatToParts(now);
  return `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`;
}
