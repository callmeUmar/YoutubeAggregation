import type { Sentiment, SentimentCounts } from '../api/types';

const integer = new Intl.NumberFormat('en-US');
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export function formatCount(value: number): string {
  return integer.format(value);
}

/** 1,284 / 12.9K / 4.2M — for large standalone figures and axis ticks. */
export function formatCompact(value: number): string {
  return Math.abs(value) < 10_000 ? integer.format(value) : compact.format(value);
}

/** Share of `part` in `total` as a percentage, or null when total is 0. */
export function share(part: number, total: number): number | null {
  return total > 0 ? (part / total) * 100 : null;
}

export function formatPercent(value: number | null, digits = 1): string {
  return value === null ? '—' : `${value.toFixed(digits)}%`;
}

export function sentimentShare(counts: SentimentCounts, sentiment: Sentiment): number | null {
  return share(counts[sentiment], counts.praise + counts.neutral + counts.criticism);
}

/** Signed difference in percentage points, e.g. `+4.2 pp`. */
export function formatPointDelta(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) return '0.0 pp';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1)} pp`;
}

/** Signed relative change, e.g. `+12%`. Null when the base is 0. */
export function formatRelativeDelta(from: number, to: number): string | null {
  if (from === 0) return null;
  const pct = Math.round(((to - from) / from) * 100);
  if (pct === 0) return '0%';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
}

export const SENTIMENT_LABEL: Record<Sentiment, string> = {
  praise: 'Praise',
  neutral: 'Neutral',
  criticism: 'Criticism',
};
