import { useSyncExternalStore } from 'react';
import type { AnalysisResult, TrendBucket } from '../../api/types';
import { share } from '../../lib/format';

export const PERIOD_COLOR = { A: 'var(--period-a)', B: 'var(--period-b)' } as const;

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(callback: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(REDUCED_MOTION).matches : false),
    () => false,
  );
}

export type TrendMetric = 'praise' | 'criticism' | 'volume';

export interface TrendRow {
  index: number;
  label: string;
  A: number | null;
  B: number | null;
  bucketA?: TrendBucket;
  bucketB?: TrendBucket;
}

export function metricValue(bucket: TrendBucket, metric: TrendMetric): number | null {
  if (metric === 'volume') return bucket.commentCount;
  return share(bucket.sentiment[metric], bucket.commentCount);
}

/** One row per bucket index, overlaying both periods. */
export function buildTrendRows(
  trend: readonly TrendBucket[],
  metric: TrendMetric,
  granularity: AnalysisResult['granularity'],
): TrendRow[] {
  const length = Math.max(0, ...trend.map((b) => b.index + 1));
  return Array.from({ length }, (_, index) => {
    const bucketA = trend.find((b) => b.period === 'A' && b.index === index);
    const bucketB = trend.find((b) => b.period === 'B' && b.index === index);
    return {
      index,
      label: `${granularity === 'week' ? 'W' : 'M'}${index + 1}`,
      A: bucketA ? metricValue(bucketA, metric) : null,
      B: bucketB ? metricValue(bucketB, metric) : null,
      bucketA,
      bucketB,
    };
  });
}
