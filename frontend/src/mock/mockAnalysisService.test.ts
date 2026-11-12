import { describe, expect, it } from 'vitest';
import { AnalysisError } from '../api/errors';
import { type AnalysisRequest, PERIOD_IDS, SENTIMENTS } from '../api/types';
import { createMockAnalysisService, nextPacificMidnight } from './mockAnalysisService';

const NOW = new Date('2026-11-11T18:00:00Z');
const request: AnalysisRequest = {
  channel: '@creatorlab',
  periodA: { start: '2026-05-16', end: '2026-08-13' },
  periodB: { start: '2026-08-14', end: '2026-11-11' },
  groupBy: 'videoPublishedAt',
};

const makeService = () => createMockAnalysisService({ latencyMs: 0, now: () => NOW });

describe('mock analysis service', () => {
  it('is deterministic for the same request', async () => {
    const first = await makeService().runAnalysis(request);
    const second = await makeService().runAnalysis(request);
    expect(second).toEqual(first);
    expect(first.source).toBe('demo');
  });

  it('produces different results for different channels', async () => {
    const service = makeService();
    const a = await service.runAnalysis(request);
    const b = await service.runAnalysis({ ...request, channel: '@anotherchannel' });
    expect(b.periods.A.commentCount).not.toBe(a.periods.A.commentCount);
  });

  it('keeps every aggregate consistent with the underlying comments', async () => {
    const service = makeService();
    const result = await service.runAnalysis(request);

    for (const period of PERIOD_IDS) {
      const summary = result.periods[period];
      const sentimentTotal = SENTIMENTS.reduce((sum, s) => sum + summary.sentiment[s], 0);
      expect(sentimentTotal).toBe(summary.commentCount);
      expect(summary.commentCount).toBeGreaterThan(0);

      const buckets = result.trend.filter((b) => b.period === period);
      expect(buckets.reduce((sum, b) => sum + b.commentCount, 0)).toBe(summary.commentCount);
      expect(buckets.reduce((sum, b) => sum + b.videoCount, 0)).toBe(summary.videoCount);

      const all = await service.getComments(result.key, { period, limit: 1 });
      expect(all.total).toBe(summary.commentCount);

      const praise = await service.getComments(result.key, { period, sentiment: 'praise', limit: 1 });
      expect(praise.total).toBe(summary.sentiment.praise);

      // Every keyword count must match the evidence a user can open.
      for (const keyword of result.keywords[period]) {
        const page = await service.getComments(result.key, { period, keyword: keyword.term, limit: 5 });
        expect(page.total).toBe(keyword.count);
        for (const comment of page.items) expect(comment.text.toLowerCase()).toContain(keyword.term);
      }
    }
  });

  it('uses weekly buckets for short periods and 30-day blocks for long ones', async () => {
    const service = makeService();
    const short = await service.runAnalysis(request);
    expect(short.granularity).toBe('week');
    expect(short.trend.filter((b) => b.period === 'B')).toHaveLength(13);

    const long = await service.runAnalysis({
      ...request,
      periodA: { start: '2025-11-12', end: '2026-05-10' },
      periodB: { start: '2026-05-11', end: '2026-11-06' },
    });
    expect(long.granularity).toBe('month');
  });

  it('paginates comments with a cursor and sorts by likes', async () => {
    const service = makeService();
    const result = await service.runAnalysis(request);
    const first = await service.getComments(result.key, { period: 'B', limit: 10 });
    expect(first.items).toHaveLength(10);
    expect(first.nextCursor).toBe('10');
    const likes = first.items.map((c) => c.likeCount);
    expect(likes).toEqual([...likes].sort((a, b) => b - a));

    const second = await service.getComments(result.key, { period: 'B', limit: 10, cursor: first.nextCursor });
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
    expect(second.items[0]!.likeCount).toBeLessThanOrEqual(first.items[9]!.likeCount);
  });

  it('filters comments to a trend bucket by video publish date', async () => {
    const service = makeService();
    const result = await service.runAnalysis(request);
    const bucket = result.trend.find((b) => b.period === 'A' && b.commentCount > 0)!;
    const page = await service.getComments(result.key, {
      period: 'A',
      videoPublishedFrom: bucket.start,
      videoPublishedTo: bucket.end,
      limit: 100,
    });
    expect(page.total).toBe(bucket.commentCount);
    for (const c of page.items) {
      expect(c.video.publishedAt.slice(0, 10) >= bucket.start).toBe(true);
      expect(c.video.publishedAt.slice(0, 10) <= bucket.end).toBe(true);
    }
  });

  it.each([
    ['@demo-not-found', 'INVALID_CHANNEL'],
    ['@demo-no-comments', 'COMMENTS_UNAVAILABLE'],
    ['@demo-quota', 'QUOTA_EXHAUSTED'],
    ['@demo-offline', 'NETWORK'],
  ])('%s fails with %s', async (channel, code) => {
    const error = await makeService()
      .runAnalysis({ ...request, channel })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AnalysisError);
    expect((error as AnalysisError).code).toBe(code);
  });

  it('reports a quota reset time at the next Pacific midnight', async () => {
    const error = (await makeService()
      .runAnalysis({ ...request, channel: '@demo-quota' })
      .catch((e: unknown) => e)) as AnalysisError;
    // 18:00 UTC on Nov 11 is 10:00 PST, so the reset is 08:00 UTC on Nov 12.
    expect(error.retryAt).toBe('2026-11-12T08:00:00.000Z');
    expect(nextPacificMidnight(new Date('2026-07-01T12:00:00Z')).toISOString()).toBe('2026-07-02T07:00:00.000Z');
  });

  it('reports progress and can be aborted', async () => {
    const service = createMockAnalysisService({ latencyMs: 50, now: () => NOW });
    const steps: string[] = [];
    const controller = new AbortController();
    const pending = service.runAnalysis(request, {
      signal: controller.signal,
      onProgress: (p) => steps.push(p.step ?? ''),
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(steps[0]).toBe('Queued');
  });

  it('rejects comment requests for unknown analyses', async () => {
    await expect(makeService().getComments('missing', {})).rejects.toBeInstanceOf(AnalysisError);
  });
});
