import { AnalysisError } from '../api/errors';
import type { AnalysisService, RequestOptions, RunAnalysisOptions } from '../api/service';
import type { AnalysisProgress, AnalysisRequest, AnalysisResult, CommentFilter, CommentPage } from '../api/types';
import { localToday } from '../lib/dates';
import { analysisKey, generateDataset, mentionsTerm, type MockDataset } from './generateDataset';

/**
 * Reserved demo handles that reproduce each failure the UI must explain.
 * They let us demo and test error states without a backend.
 */
export const DEMO_ERROR_CHANNELS = {
  '@demo-not-found': 'INVALID_CHANNEL',
  '@demo-no-comments': 'COMMENTS_UNAVAILABLE',
  '@demo-quota': 'QUOTA_EXHAUSTED',
  '@demo-offline': 'NETWORK',
} as const;

export const DEMO_SUCCESS_CHANNEL = '@creatorlab';

export interface MockServiceOptions {
  /** Total simulated duration of an analysis, spread across its steps. */
  latencyMs?: number;
  /** Injectable clock, for deterministic tests. */
  now?: () => Date;
}

const STEPS: readonly AnalysisProgress[] = [
  { status: 'queued', progress: 0, step: 'Queued' },
  { status: 'running', progress: 12, step: 'Resolving channel' },
  { status: 'running', progress: 30, step: 'Listing videos in both periods' },
  { status: 'running', progress: 55, step: 'Fetching comments' },
  { status: 'running', progress: 78, step: 'Classifying sentiment' },
  { status: 'running', progress: 92, step: 'Extracting keywords' },
];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const CACHE_LIMIT = 6;

export function createMockAnalysisService(options: MockServiceOptions = {}): AnalysisService {
  const latencyMs = options.latencyMs ?? 1200;
  const now = options.now ?? (() => new Date());
  const cache = new Map<string, MockDataset>();

  function remember(key: string, dataset: MockDataset) {
    cache.delete(key);
    cache.set(key, dataset);
    if (cache.size > CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
  }

  return {
    source: 'demo',

    async runAnalysis(request: AnalysisRequest, { signal, onProgress }: RunAnalysisOptions = {}): Promise<AnalysisResult> {
      const stepDelay = latencyMs / STEPS.length;
      for (const [index, step] of STEPS.entries()) {
        onProgress?.(step);
        await delay(stepDelay, signal);
        if (index === 1) throwScenarioError(request.channel, now());
      }

      const key = analysisKey(request);
      const dataset = cache.get(key) ?? generateDataset(request, localToday(now()), now().toISOString());
      if (dataset.result.periods.A.commentCount + dataset.result.periods.B.commentCount === 0) {
        throw new AnalysisError(
          'COMMENTS_UNAVAILABLE',
          'No comments were found on videos published in either period.',
        );
      }
      remember(key, dataset);
      onProgress?.({ status: 'done', progress: 100, step: 'Done' });
      return dataset.result;
    },

    async getComments(key: string, filter: CommentFilter, { signal }: RequestOptions = {}): Promise<CommentPage> {
      await delay(Math.min(latencyMs / 4, 250), signal);
      const dataset = cache.get(key);
      if (!dataset) {
        throw new AnalysisError('UNKNOWN', 'This analysis has expired. Run it again to load comments.');
      }
      const matches = dataset.comments
        .filter((c) => !filter.period || c.period === filter.period)
        .filter((c) => !filter.sentiment || c.sentiment === filter.sentiment)
        .filter((c) => !filter.keyword || mentionsTerm(c.text, filter.keyword))
        .filter((c) => !filter.videoPublishedFrom || c.video.publishedAt.slice(0, 10) >= filter.videoPublishedFrom)
        .filter((c) => !filter.videoPublishedTo || c.video.publishedAt.slice(0, 10) <= filter.videoPublishedTo)
        .sort(
          (a, b) =>
            b.likeCount - a.likeCount || b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id),
        );

      const limit = Math.min(Math.max(filter.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
      const offset = filter.cursor ? Number.parseInt(filter.cursor, 10) || 0 : 0;
      const items = matches.slice(offset, offset + limit);
      const nextOffset = offset + items.length;
      return {
        items,
        total: matches.length,
        nextCursor: nextOffset < matches.length ? String(nextOffset) : null,
      };
    },
  };
}

function throwScenarioError(channel: string, now: Date): void {
  const code = DEMO_ERROR_CHANNELS[channel as keyof typeof DEMO_ERROR_CHANNELS];
  switch (code) {
    case undefined:
      return;
    case 'INVALID_CHANNEL':
      throw new AnalysisError(code, `No YouTube channel matches ${channel}.`);
    case 'COMMENTS_UNAVAILABLE':
      throw new AnalysisError(code, 'Comments are turned off on every video in these periods.');
    case 'QUOTA_EXHAUSTED':
      throw new AnalysisError(code, 'The daily YouTube API quota has been used up.', {
        retryAt: nextPacificMidnight(now).toISOString(),
      });
    case 'NETWORK':
      throw new AnalysisError(code, 'The analysis service could not be reached.');
  }
}

/** The YouTube quota day resets at midnight America/Los_Angeles. */
export function nextPacificMidnight(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const elapsed = (get('hour') * 3600 + get('minute') * 60 + get('second')) * 1000 + now.getMilliseconds();
  return new Date(now.getTime() + 86_400_000 - elapsed);
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
