import type { DateRange } from '../api/types';
import { isIsoDate, rangeLengthDays, rangesOverlap } from './dates';

/* ------------------------------------------------------------------ */
/* Channel input                                                       */
/* ------------------------------------------------------------------ */

export type ChannelRef = { kind: 'handle'; value: string } | { kind: 'id'; value: string };

export type ChannelParseResult = { ok: true; channel: ChannelRef } | { ok: false; error: string };

/** YouTube channel IDs: `UC` followed by 22 URL-safe base64 characters. */
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
/** Handles: 3–30 letters (any script), digits, `_`, `-` or `.`. */
const HANDLE = /^[\p{L}\p{N}_.-]{3,30}$/u;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);

/**
 * Accepts `@handle`, a bare handle, a `UC…` channel ID, or a youtube.com URL
 * containing either. Returns a normalized reference: handles are lowercased
 * with a leading `@` (handles are case-insensitive); IDs keep their case.
 */
export function parseChannelInput(raw: string): ChannelParseResult {
  const input = raw.trim();
  if (!input) return fail('Enter a YouTube channel handle, ID, or URL.');

  if (looksLikeUrl(input)) return parseChannelUrl(input);
  if (/\s/.test(input)) return fail('Channel handles can’t contain spaces.');
  if (CHANNEL_ID.test(input)) return { ok: true, channel: { kind: 'id', value: input } };
  if (/^uc[A-Za-z0-9_-]{22}$/i.test(input)) {
    return fail('Channel IDs start with an uppercase “UC”. Check the ID and try again.');
  }
  return parseHandle(input.startsWith('@') ? input.slice(1) : input);
}

/**
 * A scheme, or a `domain.tld/…` prefix (e.g. `youtube.com/@x`). A bare
 * `name.tld` without a path is treated as a handle, since handles may contain dots.
 */
function looksLikeUrl(input: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(input) || /^([a-z0-9-]+\.)+[a-z]{2,}\//i.test(input);
}

function parseHandle(handle: string): ChannelParseResult {
  if (handle.length < 3 || handle.length > 30) {
    return fail('Handles are 3–30 characters long, like @creatorlab.');
  }
  if (!HANDLE.test(handle)) {
    return fail('Handles can only use letters, numbers, underscores (_), hyphens (-) and periods (.).');
  }
  return { ok: true, channel: { kind: 'handle', value: `@${handle.toLowerCase()}` } };
}

function parseChannelUrl(input: string): ChannelParseResult {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return fail('That doesn’t look like a valid YouTube link.');
  }
  const host = url.hostname.toLowerCase();
  if (host === 'youtu.be' || url.pathname === '/watch' || url.pathname.startsWith('/shorts/')) {
    return fail('That’s a video link. Paste the channel’s @handle or channel URL instead.');
  }
  if (!YOUTUBE_HOSTS.has(host)) return fail('That doesn’t look like a YouTube channel link.');

  const [first = '', second = ''] = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (first.startsWith('@')) return parseHandle(first.slice(1));
  if (first === 'channel' && CHANNEL_ID.test(second)) return { ok: true, channel: { kind: 'id', value: second } };
  if (first === 'c' || first === 'user') {
    return fail('Legacy /c/ and /user/ links aren’t supported. Use the channel’s @handle instead.');
  }
  return fail('Couldn’t find a channel in that link. Use a link like youtube.com/@creatorlab.');
}

function fail(error: string): ChannelParseResult {
  return { ok: false, error };
}

/* ------------------------------------------------------------------ */
/* Whole form                                                          */
/* ------------------------------------------------------------------ */

export interface AnalysisFormValues {
  channel: string;
  periodA: DateRange;
  periodB: DateRange;
}

export type FieldKey =
  | 'channel'
  | 'periodA.start'
  | 'periodA.end'
  | 'periodB.start'
  | 'periodB.end'
  | 'periodA'
  | 'periodB';

export type FormErrors = Partial<Record<FieldKey, string>>;

/** YouTube launched in 2005; no channel has videos before this. */
export const EARLIEST_DATE = '2005-04-23';
/** Upper bound per period, to keep YouTube API quota use predictable. */
export const MAX_PERIOD_DAYS = 366;

/** Validates the whole form. `today` is `YYYY-MM-DD` in the viewer's time zone. */
export function validateAnalysisForm(values: AnalysisFormValues, today: string): FormErrors {
  const errors: FormErrors = {};

  const channel = parseChannelInput(values.channel);
  if (!channel.ok) errors.channel = channel.error;

  const aValid = validatePeriod('periodA', 'Period A', values.periodA, today, errors);
  const bValid = validatePeriod('periodB', 'Period B', values.periodB, today, errors);

  if (aValid && bValid && rangesOverlap(values.periodA, values.periodB)) {
    errors.periodB = 'The two periods overlap. Pick ranges that don’t share any days.';
  }
  return errors;
}

function validatePeriod(
  key: 'periodA' | 'periodB',
  label: string,
  range: DateRange,
  today: string,
  errors: FormErrors,
): boolean {
  const startKey = `${key}.start` as const;
  const endKey = `${key}.end` as const;
  let ok = true;

  for (const [field, value, name] of [
    [startKey, range.start, 'start'],
    [endKey, range.end, 'end'],
  ] as const) {
    if (!value) {
      errors[field] = `Choose a ${name} date for ${label}.`;
      ok = false;
    } else if (!isIsoDate(value)) {
      errors[field] = `Enter a valid ${name} date.`;
      ok = false;
    } else if (value > today) {
      errors[field] = 'Dates can’t be in the future.';
      ok = false;
    } else if (value < EARLIEST_DATE) {
      errors[field] = 'Dates must be after YouTube launched (April 2005).';
      ok = false;
    }
  }
  if (!ok) return false;

  if (range.start > range.end) {
    errors[key] = `${label} starts after it ends. Swap the dates or pick a new range.`;
    return false;
  }
  if (rangeLengthDays(range) > MAX_PERIOD_DAYS) {
    errors[key] = `${label} is longer than ${MAX_PERIOD_DAYS} days. Pick a shorter range.`;
    return false;
  }
  return true;
}

export function hasErrors(errors: FormErrors): boolean {
  return Object.values(errors).some(Boolean);
}
