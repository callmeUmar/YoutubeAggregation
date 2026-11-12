import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import type { AnalysisService } from './api/service';
import type { AnalysisResult } from './api/types';
import { formatCount, formatPercent, sentimentShare } from './lib/format';
import { createMockAnalysisService } from './mock/mockAnalysisService';

const TODAY = '2026-11-11';
const NOW = new Date('2026-11-11T18:00:00Z');

function setup(service: AnalysisService = createMockAnalysisService({ latencyMs: 0, now: () => NOW })) {
  const user = userEvent.setup();
  render(<App service={service} today={TODAY} />);
  return { user, service };
}

/** Runs the default form (last 90 vs previous 90 days) and returns the same result the UI shows. */
async function analyze(user: ReturnType<typeof userEvent.setup>, channel: string) {
  const input = screen.getByLabelText('YouTube channel');
  await user.clear(input);
  await user.type(input, channel);
  await user.click(screen.getByRole('button', { name: 'Analyze' }));
}

async function expectedResult(channel = '@creatorlab'): Promise<AnalysisResult> {
  return createMockAnalysisService({ latencyMs: 0, now: () => NOW }).runAnalysis({
    channel,
    periodA: { start: '2026-05-16', end: '2026-08-13' },
    periodB: { start: '2026-08-14', end: '2026-11-11' },
    groupBy: 'videoPublishedAt',
  });
}

function evidencePanel() {
  return screen.getByRole('complementary', { name: /Evidence/ });
}

describe('analysis form validation', () => {
  it('blocks submission and focuses the channel field when it is empty', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Analyze' }));

    const input = screen.getByLabelText('YouTube channel');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveFocus();
    expect(input).toHaveAccessibleDescription(/Enter a YouTube channel handle/);
    // Still idle: nothing was analyzed.
    expect(screen.getByRole('heading', { name: /Compare how viewers responded/ })).toBeInTheDocument();
  });

  it('explains invalid handles and video links, then clears the error once fixed', async () => {
    const { user } = setup();
    const input = screen.getByLabelText('YouTube channel');

    await user.type(input, '@ab');
    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    expect(screen.getByText(/Handles are 3–30 characters long/)).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'https://youtu.be/dQw4w9WgXcQ');
    expect(screen.getByText(/That’s a video link/)).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, '@creatorlab');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('validates date ranges: order and overlap', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('YouTube channel'), '@creatorlab');

    const periodB = screen.getByRole('group', { name: 'Period B' });
    fireEvent.change(within(periodB).getByLabelText('From'), { target: { value: '2026-11-01' } });
    fireEvent.change(within(periodB).getByLabelText('To'), { target: { value: '2026-10-01' } });
    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    expect(screen.getByText(/Period B starts after it ends/)).toBeInTheDocument();
    expect(within(periodB).getByLabelText('From')).toHaveFocus();

    fireEvent.change(within(periodB).getByLabelText('From'), { target: { value: '2026-08-01' } });
    fireEvent.change(within(periodB).getByLabelText('To'), { target: { value: '2026-09-01' } });
    expect(screen.getByText(/The two periods overlap/)).toBeInTheDocument();
  });

  it('applies quick-compare presets', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Last 30 days vs previous 30' }));
    const periodB = screen.getByRole('group', { name: 'Period B' });
    expect(within(periodB).getByLabelText('From')).toHaveValue('2026-10-13');
    expect(within(periodB).getByLabelText('To')).toHaveValue(TODAY);
    expect(screen.getByRole('button', { name: 'Last 30 days vs previous 30' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('demo analysis rendering', () => {
  it('labels results as demo data and shows summary numbers from the analysis', async () => {
    const { user } = setup();
    expect(screen.getByText('Demo mode')).toBeInTheDocument();
    await analyze(user, '@CreatorLab');

    expect(await screen.findByRole('note', { name: 'Demo data notice' })).toHaveTextContent(
      /DEMO DATA.*not from the YouTube API/,
    );
    expect(screen.getByRole('heading', { name: /Creatorlab/ })).toBeInTheDocument();

    const expected = await expectedResult();
    const summary = screen.getByRole('region', { name: 'Summary' });

    const videos = within(summary).getByRole('heading', { name: 'Videos analyzed' }).closest('li')!;
    expect(videos).toHaveTextContent(formatCount(expected.periods.A.videoCount));
    expect(videos).toHaveTextContent(formatCount(expected.periods.B.videoCount));

    const comments = within(summary).getByRole('heading', { name: 'Comments analyzed' }).closest('li')!;
    expect(comments).toHaveTextContent(formatCount(expected.periods.B.commentCount));

    const praise = within(summary).getByRole('heading', { name: 'Praise' }).closest('li')!;
    expect(praise).toHaveTextContent(formatPercent(sentimentShare(expected.periods.A.sentiment, 'praise')));
    expect(praise).toHaveTextContent(formatPercent(sentimentShare(expected.periods.B.sentiment, 'praise')));

    for (const title of ['Sentiment comparison', 'Trend within each period', 'Top keywords']) {
      expect(screen.getByRole('region', { name: title })).toBeInTheDocument();
    }
    const topB = expected.keywords.B[0]!;
    expect(
      screen.getByRole('button', { name: new RegExp(`^${topB.term}: ${formatCount(topB.count)} comments in Period B`) }),
    ).toBeInTheDocument();
  });

  it('shows a loading state while the analysis runs', async () => {
    const { user } = setup(createMockAnalysisService({ latencyMs: 300, now: () => NOW }));
    await analyze(user, '@creatorlab');
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyzing…' })).toBeInTheDocument();
    expect(await screen.findByRole('note', { name: 'Demo data notice' }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});

describe('comment evidence', () => {
  it('shows matching comments with video links when a keyword is selected', async () => {
    const { user } = setup();
    await analyze(user, '@creatorlab');
    const expected = await expectedResult();
    const keyword = expected.keywords.B[0]!;

    const panel = await screen.findByRole('complementary', { name: /Evidence/ });
    expect(within(panel).getByText(/Select a keyword, a bar, or a trend point/)).toBeInTheDocument();

    const button = screen.getByRole('button', { name: new RegExp(`^${keyword.term}: .* in Period B\\.`) });
    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');

    expect(within(panel).getByText(`Comments mentioning “${keyword.term}” in Period B`)).toBeInTheDocument();
    const list = await within(panel).findByRole('list', { name: 'Comments' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(Math.min(20, keyword.count));
    expect(within(panel).getByText(`Showing ${items.length} of ${formatCount(keyword.count)} comments, most liked first`)).toBeInTheDocument();

    for (const item of items) {
      expect(item.querySelector('mark')).toHaveTextContent(new RegExp(keyword.term, 'i'));
      // Demo video IDs are fictional, so they must never link to youtube.com.
      expect(within(item).getByText('(demo video, not linked)')).toBeInTheDocument();
    }
    expect(within(panel).queryAllByRole('link')).toHaveLength(0);
    expect(within(panel).getByText(/videos aren’t linked to YouTube/)).toBeInTheDocument();
  });

  it('links evidence to YouTube videos only for real (non-demo) results', async () => {
    const base = createMockAnalysisService({ latencyMs: 0, now: () => NOW });
    const real: AnalysisService = {
      ...base,
      source: 'youtube',
      runAnalysis: async (request, options) => ({ ...(await base.runAnalysis(request, options)), source: 'youtube' }),
    };
    const { user } = setup(real);
    await analyze(user, '@creatorlab');
    const expected = await expectedResult();
    const keyword = expected.keywords.B[0]!;

    await user.click(await screen.findByRole('button', { name: new RegExp(`^${keyword.term}: .* in Period B\\.`) }));
    const list = await within(evidencePanel()).findByRole('list', { name: 'Comments' });
    expect(screen.queryByRole('note', { name: 'Demo data notice' })).not.toBeInTheDocument();
    for (const item of within(list).getAllByRole('listitem')) {
      const link = within(item).getByRole('link', { name: /opens in a new tab/ });
      expect(link).toHaveAttribute('href', expect.stringMatching(/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/));
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('tags keywords missing from the other period as New (B) or Dropped (A)', async () => {
    const { user } = setup();
    await analyze(user, '@creatorlab');
    const expected = await expectedResult();
    const inA = new Set(expected.keywords.A.map((k) => k.term));
    const inB = new Set(expected.keywords.B.map((k) => k.term));
    const dropped = expected.keywords.A.find((k) => !inB.has(k.term))!;
    const added = expected.keywords.B.find((k) => !inA.has(k.term))!;

    const keywords = await screen.findByRole('region', { name: 'Top keywords' });
    const term = (name: string, period: string) =>
      within(keywords).getByRole('button', { name: new RegExp(`^${name}: .* in Period ${period}\\.`) });
    expect(term(dropped.term, 'A')).toHaveTextContent('Dropped');
    expect(term(added.term, 'B')).toHaveTextContent('New');
  });

  it('narrows evidence by sentiment and loads more pages', async () => {
    const { user } = setup();
    await analyze(user, '@creatorlab');
    const expected = await expectedResult();
    const keyword = expected.keywords.A[0]!;

    await user.click(screen.getByRole('button', { name: new RegExp(`^${keyword.term}: .*Period A`) }));
    const panel = evidencePanel();
    await within(panel).findByRole('list', { name: 'Comments' });

    await user.click(within(panel).getByRole('radio', { name: 'Criticism' }));
    await within(panel).findByText(
      `Showing ${Math.min(20, keyword.sentiment.criticism)} of ${formatCount(keyword.sentiment.criticism)} comments, most liked first`,
    );
    const badges = within(within(panel).getByRole('list', { name: 'Comments' })).getAllByText('Criticism');
    expect(badges.length).toBe(Math.min(20, keyword.sentiment.criticism));

    await user.click(within(panel).getByRole('radio', { name: 'All' }));
    await within(panel).findByText(new RegExp(`^Showing 20 of ${formatCount(keyword.count)}`));
    await user.click(within(panel).getByRole('button', { name: 'Load more comments' }));
    await within(panel).findByText(new RegExp(`^Showing ${Math.min(40, keyword.count)} of ${formatCount(keyword.count)}`));
  });

  it('opens sentiment evidence from the chart’s data table and clears it', async () => {
    const { user } = setup();
    await analyze(user, '@creatorlab');
    const expected = await expectedResult();
    const praiseA = expected.periods.A.sentiment.praise;

    const chart = await screen.findByRole('region', { name: 'Sentiment comparison' });
    await user.click(within(chart).getByText('View as table'));
    await user.click(
      within(chart).getByRole('button', { name: `Show ${formatCount(praiseA)} praise comments from Period A` }),
    );

    const panel = evidencePanel();
    expect(within(panel).getByText('Praise comments in Period A')).toBeInTheDocument();
    await within(panel).findByText(`Showing 20 of ${formatCount(praiseA)} comments, most liked first`);
    // The sentiment is fixed by the selection, so no sentiment filter is offered.
    expect(within(panel).queryByRole('radio', { name: 'Criticism' })).not.toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Clear' }));
    expect(within(panel).getByText(/Select a keyword, a bar, or a trend point/)).toBeInTheDocument();
  });

  it('opens trend-bucket evidence from the trend table', async () => {
    const { user } = setup();
    await analyze(user, '@creatorlab');
    const expected = await expectedResult();
    const bucket = expected.trend.find((b) => b.period === 'B' && b.commentCount > 0)!;

    const trend = await screen.findByRole('region', { name: 'Trend within each period' });
    await user.click(within(trend).getByText('View as table'));
    await user.click(
      within(trend).getByRole('button', { name: new RegExp(`^Show comments for Period B, Week ${bucket.index + 1},`) }),
    );

    const panel = evidencePanel();
    expect(within(panel).getByText(new RegExp(`Period B, Week ${bucket.index + 1}`))).toBeInTheDocument();
    await within(panel).findByText(new RegExp(`of ${formatCount(bucket.commentCount)} comments`));
  });
});

describe('error states', () => {
  it('explains an unknown channel and returns focus to the channel field', async () => {
    const { user } = setup();
    await analyze(user, '@demo-not-found');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We couldn’t find that channel');
    await user.click(within(alert).getByRole('button', { name: 'Edit channel' }));
    expect(screen.getByLabelText('YouTube channel')).toHaveFocus();
  });

  it('explains when comments are unavailable', async () => {
    const { user } = setup();
    await analyze(user, '@demo-no-comments');
    expect(await screen.findByRole('alert')).toHaveTextContent('No comments to analyze');
  });

  it('explains an exhausted quota with the Pacific-time reset', async () => {
    const { user } = setup();
    await analyze(user, '@demo-quota');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Daily YouTube quota reached');
    expect(alert).toHaveTextContent(/resets at midnight Pacific time/);
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers a retry for network failures', async () => {
    let calls = 0;
    const base = createMockAnalysisService({ latencyMs: 0, now: () => NOW });
    const flaky: AnalysisService = {
      ...base,
      runAnalysis: (request, options) => {
        calls += 1;
        return calls === 1 ? Promise.reject(new TypeError('Failed to fetch')) : base.runAnalysis(request, options);
      },
    };
    const { user } = setup(flaky);
    await analyze(user, '@creatorlab');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Can’t reach the analysis service');
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByRole('note', { name: 'Demo data notice' })).toBeInTheDocument());
    expect(calls).toBe(2);
  });
});
