/**
 * Domain types shared by the UI and every AnalysisService implementation.
 *
 * These mirror the *proposed* JSON contract in `docs/api-contract.md`. The
 * backend schema has not been agreed yet; change these types (and that doc)
 * together once it is. All JSON is camelCase, matching the backend's Pydantic
 * convention described in the root README.
 */

export const SENTIMENTS = ['praise', 'neutral', 'criticism'] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const PERIOD_IDS = ['A', 'B'] as const;
export type PeriodId = (typeof PERIOD_IDS)[number];

/** Inclusive calendar-date range. Both ends are ISO `YYYY-MM-DD`. */
export interface DateRange {
  start: string;
  end: string;
}

/**
 * Which timestamp decides whether a comment belongs to a period.
 * Phase 1 always sends `videoPublishedAt` (the agreed design); the backend
 * stores both dates, so `commentPublishedAt` is reserved for later.
 */
export type GroupBy = 'videoPublishedAt' | 'commentPublishedAt';

/** Body of `POST /analyses`. */
export interface AnalysisRequest {
  /** Normalized channel reference: `@handle` (lowercase) or a `UC…` channel ID. */
  channel: string;
  periodA: DateRange;
  periodB: DateRange;
  groupBy: GroupBy;
}

/** Where the numbers came from. The UI labels anything but `youtube` as demo data. */
export type DataSource = 'demo' | 'youtube';

export type SentimentCounts = Record<Sentiment, number>;

export interface ChannelInfo {
  id: string;
  handle: string | null;
  title: string;
  url: string;
}

export interface PeriodSummary {
  period: PeriodId;
  range: DateRange;
  /** Videos published in the range whose comments were analyzed. */
  videoCount: number;
  /** Videos published in the range that were skipped (e.g. comments disabled). */
  videosSkipped: number;
  /** Comments analyzed. Always equals the sum of `sentiment`. */
  commentCount: number;
  sentiment: SentimentCounts;
}

export type TrendGranularity = 'week' | 'month';

/** One time bucket inside a period, grouped by video publication date. */
export interface TrendBucket {
  period: PeriodId;
  /** 0-based position inside its period, so periods can be overlaid. */
  index: number;
  start: string;
  end: string;
  videoCount: number;
  commentCount: number;
  sentiment: SentimentCounts;
}

export interface KeywordStat {
  term: string;
  /** Number of comments in the period that mention the term. */
  count: number;
  sentiment: SentimentCounts;
}

/** The finished result of an analysis (`status: "done"`). */
export interface AnalysisResult {
  key: string;
  source: DataSource;
  channel: ChannelInfo;
  groupBy: GroupBy;
  generatedAt: string;
  granularity: TrendGranularity;
  periods: Record<PeriodId, PeriodSummary>;
  /** Buckets for both periods, ordered by period then index. */
  trend: TrendBucket[];
  /** Top keywords per period, highest count first. */
  keywords: Record<PeriodId, KeywordStat[]>;
}

export type AnalysisStatus = 'queued' | 'running' | 'done' | 'error';

/** Progress of a running analysis, matching the backend's `analyses` table. */
export interface AnalysisProgress {
  status: AnalysisStatus;
  /** 0–100. */
  progress: number;
  /** Human-readable step, e.g. "Fetching comments". */
  step: string | null;
}

/** Query for `GET /analyses/{key}/comments`. Every field narrows the set. */
export interface CommentFilter {
  period?: PeriodId;
  sentiment?: Sentiment;
  keyword?: string;
  /** Only comments on videos published on or after this date (trend bucket). */
  videoPublishedFrom?: string;
  /** Only comments on videos published on or before this date (trend bucket). */
  videoPublishedTo?: string;
  cursor?: string | null;
  limit?: number;
}

export interface VideoRef {
  id: string;
  title: string;
  publishedAt: string;
  url: string;
}

export interface CommentEvidence {
  id: string;
  text: string;
  authorName: string;
  likeCount: number;
  publishedAt: string;
  sentiment: Sentiment;
  period: PeriodId;
  isReply: boolean;
  video: VideoRef;
  /** Link to the comment on YouTube (`watch?v=…&lc=…`). */
  url: string;
}

export interface CommentPage {
  items: CommentEvidence[];
  /** Total comments matching the filter, across all pages. */
  total: number;
  nextCursor: string | null;
}
