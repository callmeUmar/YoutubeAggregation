import type { DateRange } from '../api/types';

/**
 * Calendar-date helpers. Dates travel as ISO `YYYY-MM-DD` strings and are
 * treated as UTC midnights, so arithmetic never shifts across time zones.
 */

const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(ms) && toIsoDate(ms) === value;
}

export function parseIsoDate(value: string): number {
  return Date.parse(`${value}T00:00:00Z`);
}

export function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toIsoDate(parseIsoDate(iso) + days * DAY_MS);
}

/** Number of calendar days covered by an inclusive range. */
export function rangeLengthDays(range: DateRange): number {
  return Math.round((parseIsoDate(range.end) - parseIsoDate(range.start)) / DAY_MS) + 1;
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

export function isWithin(iso: string, range: DateRange): boolean {
  const day = iso.slice(0, 10);
  return day >= range.start && day <= range.end;
}

/** Today's date in the viewer's local time zone, as `YYYY-MM-DD`. */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const longDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** `Mar 4, 2026` */
export function formatDate(iso: string): string {
  return longDate.format(parseIsoDate(iso.slice(0, 10)));
}

/** `Mar 4` */
export function formatShortDate(iso: string): string {
  return shortDate.format(parseIsoDate(iso.slice(0, 10)));
}

/** `Mar 4 – Apr 2, 2026`, or with both years when they differ. */
export function formatRange(range: DateRange): string {
  const sameYear = range.start.slice(0, 4) === range.end.slice(0, 4);
  const start = sameYear ? formatShortDate(range.start) : formatDate(range.start);
  return `${start} – ${formatDate(range.end)}`;
}

export interface ComparisonPreset {
  id: string;
  label: string;
  days: number;
}

export const COMPARISON_PRESETS: readonly ComparisonPreset[] = [
  { id: '30', label: 'Last 30 days vs previous 30', days: 30 },
  { id: '90', label: 'Last 90 days vs previous 90', days: 90 },
  { id: '180', label: 'Last 180 days vs previous 180', days: 180 },
];

/** Period B ends today; period A is the same length immediately before it. */
export function presetRanges(days: number, today: string): { periodA: DateRange; periodB: DateRange } {
  const periodB = { start: addDays(today, -(days - 1)), end: today };
  const periodA = { start: addDays(periodB.start, -days), end: addDays(periodB.start, -1) };
  return { periodA, periodB };
}
