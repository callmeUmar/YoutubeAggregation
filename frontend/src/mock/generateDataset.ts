import type {
  AnalysisRequest,
  AnalysisResult,
  ChannelInfo,
  CommentEvidence,
  DateRange,
  KeywordStat,
  PeriodId,
  PeriodSummary,
  Sentiment,
  SentimentCounts,
  TrendBucket,
  TrendGranularity,
} from '../api/types';
import { addDays, parseIsoDate, rangeLengthDays } from '../lib/dates';
import { AUTHOR_PARTS, GENERIC_TEMPLATES, TITLE_COUNTS, TOPICS, videoTitle } from './corpus';
import { createRng, hashString } from './random';

/**
 * Deterministic DEMO DATA generator.
 *
 * Videos are seeded per (channel, calendar day) and comments per video, so the
 * same video always has the same comments no matter which date range includes
 * it. Sentiment and topic mix drift slowly over calendar time, so any two
 * periods show plausible differences. Every aggregate in the result is computed
 * from the generated comments, so counts, keywords and evidence always agree.
 */

export interface MockVideo {
  id: string;
  title: string;
  publishedAt: string;
  period: PeriodId;
  commentsDisabled: boolean;
}

export interface MockDataset {
  result: AnalysisResult;
  comments: CommentEvidence[];
}

export const KEYWORDS_PER_PERIOD = 10;
const WEEKLY_MAX_DAYS = 120;
const DAY_MS = 86_400_000;

interface ChannelProfile {
  uploadProbability: number;
  commentsPerVideo: number;
  praiseBase: number;
  criticismBase: number;
  wavePeriodDays: number;
  wavePhase: number;
  topicWeights: number[];
  topicPhases: number[];
  topicCriticismBias: number[];
}

function channelProfile(channel: string): ChannelProfile {
  const rng = createRng(`profile:${channel}`);
  return {
    uploadProbability: rng.between(0.2, 0.45),
    commentsPerVideo: rng.int(60, 180),
    praiseBase: rng.between(0.44, 0.56),
    criticismBase: rng.between(0.14, 0.22),
    wavePeriodDays: rng.int(160, 320),
    wavePhase: rng.between(0, Math.PI * 2),
    topicWeights: TOPICS.map(() => rng.between(0.4, 1.6)),
    topicPhases: TOPICS.map(() => rng.between(0, Math.PI * 2)),
    topicCriticismBias: TOPICS.map(() => rng.between(-0.08, 0.14)),
  };
}

export function demoChannelInfo(channel: string): ChannelInfo {
  const rng = createRng(`channel:${channel}`);
  if (channel.startsWith('@')) {
    const handle = channel.slice(1);
    const title = handle
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    return {
      id: `UC${rng.id(22)}`,
      handle: channel,
      title: title || handle,
      url: `https://www.youtube.com/${channel}`,
    };
  }
  return { id: channel, handle: null, title: 'Demo channel', url: `https://www.youtube.com/channel/${channel}` };
}

function wave(dayNumber: number, periodDays: number, phase: number): number {
  return Math.sin((2 * Math.PI * dayNumber) / periodDays + phase);
}

function videosForRange(channel: string, profile: ChannelProfile, range: DateRange, period: PeriodId): MockVideo[] {
  const videos: MockVideo[] = [];
  for (let day = range.start; day <= range.end; day = addDays(day, 1)) {
    const rng = createRng(`video:${channel}:${day}`);
    if (!rng.chance(profile.uploadProbability)) continue;
    const hour = rng.int(13, 22);
    const minute = rng.int(0, 59);
    videos.push({
      id: rng.id(11),
      title: videoTitle(rng.int(0, TITLE_COUNTS.openers - 1), rng.int(0, TITLE_COUNTS.subjects - 1)),
      publishedAt: `${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`,
      period,
      commentsDisabled: rng.chance(0.05),
    });
  }
  return videos;
}

function sentimentProbabilities(profile: ChannelProfile, dayNumber: number, noise: number, bias: number): number[] {
  const drift = 0.1 * wave(dayNumber, profile.wavePeriodDays, profile.wavePhase);
  const praise = clamp(profile.praiseBase + drift + noise - bias, 0.15, 0.8);
  const criticism = clamp(profile.criticismBase - drift * 0.8 - noise + bias, 0.04, 0.6);
  const neutral = Math.max(0.08, 1 - praise - criticism);
  return [praise, neutral, criticism];
}

const SENTIMENT_ORDER: readonly Sentiment[] = ['praise', 'neutral', 'criticism'];

function commentsForVideo(
  channel: string,
  profile: ChannelProfile,
  video: MockVideo,
  today: string,
): CommentEvidence[] {
  if (video.commentsDisabled) return [];
  const rng = createRng(`comments:${channel}:${video.id}`);
  const videoDay = video.publishedAt.slice(0, 10);
  const dayNumber = Math.round(parseIsoDate(videoDay) / DAY_MS);

  const viral = rng.chance(0.06) ? rng.between(2.5, 4) : 1;
  const count = Math.round(profile.commentsPerVideo * rng.between(0.35, 1.6) * viral);
  const videoNoise = rng.between(-0.05, 0.05);
  const topicWeights = profile.topicWeights.map(
    (weight, i) => weight * (1 + 0.75 * wave(dayNumber, 140 + i * 9, profile.topicPhases[i] ?? 0)),
  );
  const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;

  const comments: CommentEvidence[] = [];
  for (let i = 0; i < count; i += 1) {
    const hasTopic = rng.chance(0.72);
    const topicIndex = hasTopic ? rng.weightedIndex(topicWeights) : -1;
    const topic = TOPICS[topicIndex];
    const bias = topic ? (profile.topicCriticismBias[topicIndex] ?? 0) : 0;
    const sentiment =
      SENTIMENT_ORDER[rng.weightedIndex(sentimentProbabilities(profile, dayNumber, videoNoise, bias))] ?? 'neutral';
    const text = rng.pick(topic ? topic.templates[sentiment] : GENERIC_TEMPLATES[sentiment]);

    const ageDays = Math.min(Math.floor(-Math.log(1 - rng.next()) * 2), 60);
    const commentDay = minIso(addDays(videoDay, ageDays), today);
    const seconds = rng.int(0, 86_399);
    const publishedAt = new Date(parseIsoDate(commentDay) + seconds * 1000).toISOString();

    const likeCount = rng.chance(0.03) ? rng.int(200, 2400) : Math.floor(Math.exp(rng.next() * 5)) - 1;
    const author = `@${rng.pick(AUTHOR_PARTS.first)}${rng.pick(AUTHOR_PARTS.second)}${rng.chance(0.5) ? rng.int(1, 99) : ''}`;
    const id = `Ugx${rng.id(21)}`;

    comments.push({
      id,
      text,
      authorName: author,
      likeCount,
      publishedAt,
      sentiment,
      period: video.period,
      isReply: rng.chance(0.12),
      video: { id: video.id, title: video.title, publishedAt: video.publishedAt, url: videoUrl },
      url: `${videoUrl}&lc=${id}`,
    });
  }
  return comments;
}

export function emptyCounts(): SentimentCounts {
  return { praise: 0, neutral: 0, criticism: 0 };
}

/** Case-insensitive whole-word match, shared with the comment filter. */
export function mentionsTerm(text: string, term: string): boolean {
  return new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').test(text);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function summarize(period: PeriodId, range: DateRange, videos: MockVideo[], comments: CommentEvidence[]): PeriodSummary {
  const sentiment = emptyCounts();
  for (const comment of comments) sentiment[comment.sentiment] += 1;
  const skipped = videos.filter((v) => v.commentsDisabled).length;
  return {
    period,
    range,
    videoCount: videos.length - skipped,
    videosSkipped: skipped,
    commentCount: comments.length,
    sentiment,
  };
}

function bucketRanges(range: DateRange, granularity: TrendGranularity): DateRange[] {
  const size = granularity === 'week' ? 7 : 30;
  const buckets: DateRange[] = [];
  for (let start = range.start; start <= range.end; start = addDays(start, size)) {
    const end = addDays(start, size - 1);
    buckets.push({ start, end: end > range.end ? range.end : end });
  }
  return buckets;
}

function trendFor(
  period: PeriodId,
  range: DateRange,
  granularity: TrendGranularity,
  videos: MockVideo[],
  comments: CommentEvidence[],
): TrendBucket[] {
  return bucketRanges(range, granularity).map((bucket, index) => {
    const inBucket = (iso: string) => iso.slice(0, 10) >= bucket.start && iso.slice(0, 10) <= bucket.end;
    const sentiment = emptyCounts();
    let commentCount = 0;
    for (const comment of comments) {
      if (inBucket(comment.video.publishedAt)) {
        sentiment[comment.sentiment] += 1;
        commentCount += 1;
      }
    }
    return {
      period,
      index,
      start: bucket.start,
      end: bucket.end,
      videoCount: videos.filter((v) => !v.commentsDisabled && inBucket(v.publishedAt)).length,
      commentCount,
      sentiment,
    };
  });
}

function keywordsFor(comments: CommentEvidence[]): KeywordStat[] {
  return TOPICS.map(({ term }) => {
    const sentiment = emptyCounts();
    let count = 0;
    for (const comment of comments) {
      if (mentionsTerm(comment.text, term)) {
        sentiment[comment.sentiment] += 1;
        count += 1;
      }
    }
    return { term, count, sentiment };
  })
    .filter((k) => k.count > 0)
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, KEYWORDS_PER_PERIOD);
}

export function analysisKey(request: AnalysisRequest): string {
  const raw = [request.channel, request.periodA.start, request.periodA.end, request.periodB.start, request.periodB.end, request.groupBy].join('|');
  return `demo-${hashString(raw).toString(16).padStart(8, '0')}`;
}

export function generateDataset(request: AnalysisRequest, today: string, generatedAt: string): MockDataset {
  const profile = channelProfile(request.channel);
  const longest = Math.max(rangeLengthDays(request.periodA), rangeLengthDays(request.periodB));
  const granularity: TrendGranularity = longest <= WEEKLY_MAX_DAYS ? 'week' : 'month';

  const perPeriod = (period: PeriodId, range: DateRange) => {
    const videos = videosForRange(request.channel, profile, range, period);
    const comments = videos.flatMap((video) => commentsForVideo(request.channel, profile, video, today));
    return { range, videos, comments };
  };
  const a = perPeriod('A', request.periodA);
  const b = perPeriod('B', request.periodB);

  const result: AnalysisResult = {
    key: analysisKey(request),
    source: 'demo',
    channel: demoChannelInfo(request.channel),
    groupBy: request.groupBy,
    generatedAt,
    granularity,
    periods: {
      A: summarize('A', a.range, a.videos, a.comments),
      B: summarize('B', b.range, b.videos, b.comments),
    },
    trend: [
      ...trendFor('A', a.range, granularity, a.videos, a.comments),
      ...trendFor('B', b.range, granularity, b.videos, b.comments),
    ],
    keywords: { A: keywordsFor(a.comments), B: keywordsFor(b.comments) },
  };
  return { result, comments: [...a.comments, ...b.comments] };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function minIso(a: string, b: string): string {
  return a < b ? a : b;
}
