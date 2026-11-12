import type { CommentFilter, PeriodId, Sentiment, TrendBucket, TrendGranularity } from '../api/types';
import { formatRange } from '../lib/dates';
import { SENTIMENT_LABEL } from '../lib/format';

/** What the user clicked to ask "which comments are behind this number?". */
export type EvidenceSelection =
  | { kind: 'keyword'; period: PeriodId; term: string }
  | { kind: 'sentiment'; period: PeriodId; sentiment: Sentiment }
  | { kind: 'bucket'; period: PeriodId; bucket: TrendBucket; granularity: TrendGranularity };

export function selectionId(selection: EvidenceSelection): string {
  switch (selection.kind) {
    case 'keyword':
      return `keyword:${selection.period}:${selection.term}`;
    case 'sentiment':
      return `sentiment:${selection.period}:${selection.sentiment}`;
    case 'bucket':
      return `bucket:${selection.period}:${selection.bucket.index}`;
  }
}

export function isSelected(current: EvidenceSelection | null, candidate: EvidenceSelection): boolean {
  return current !== null && selectionId(current) === selectionId(candidate);
}

/** The base filter for a selection. The sentiment filter is applied on top. */
export function selectionToFilter(selection: EvidenceSelection, sentiment: Sentiment | null): CommentFilter {
  const filter: CommentFilter = { period: selection.period };
  switch (selection.kind) {
    case 'keyword':
      filter.keyword = selection.term;
      break;
    case 'sentiment':
      break;
    case 'bucket':
      filter.videoPublishedFrom = selection.bucket.start;
      filter.videoPublishedTo = selection.bucket.end;
      break;
  }
  const effective = selection.kind === 'sentiment' ? selection.sentiment : sentiment;
  if (effective) filter.sentiment = effective;
  return filter;
}

export function bucketLabel(granularity: TrendGranularity, index: number): string {
  return `${granularity === 'week' ? 'Week' : 'Month'} ${index + 1}`;
}

export function describeSelection(selection: EvidenceSelection): string {
  switch (selection.kind) {
    case 'keyword':
      return `Comments mentioning “${selection.term}” in Period ${selection.period}`;
    case 'sentiment':
      return `${SENTIMENT_LABEL[selection.sentiment]} comments in Period ${selection.period}`;
    case 'bucket':
      return `Comments on videos published ${formatRange(selection.bucket)} (Period ${selection.period}, ${bucketLabel(
        selection.granularity,
        selection.bucket.index,
      )})`;
  }
}
