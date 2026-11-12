import { type Ref, useMemo, useState } from 'react';
import type { AnalysisService } from '../api/service';
import type { CommentEvidence, Sentiment } from '../api/types';
import { Icon } from '../components/Icon';
import { type SegmentOption, SegmentedControl } from '../components/SegmentedControl';
import { DemoTag, PeriodTag, SentimentBadge } from '../components/SentimentBadge';
import { useComments } from '../hooks/useComments';
import { formatDate } from '../lib/dates';
import { formatCount } from '../lib/format';
import { type EvidenceSelection, describeSelection, selectionId, selectionToFilter } from './selection';
import './EvidencePanel.css';

type SentimentFilter = Sentiment | 'all';

const SENTIMENT_FILTERS: readonly SegmentOption<SentimentFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'praise', label: 'Praise' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'criticism', label: 'Criticism' },
];

interface Props {
  service: AnalysisService;
  analysisKey: string;
  isDemo: boolean;
  selection: EvidenceSelection | null;
  onClear: () => void;
  ref?: Ref<HTMLElement>;
}

export function EvidencePanel({ service, analysisKey, isDemo, selection, onClear, ref }: Props) {
  return (
    <aside ref={ref} className="evidence" aria-labelledby="evidence-title">
      <header className="evidence__header">
        <h2 id="evidence-title" className="evidence__title">
          Evidence
          {isDemo && <DemoTag />}
        </h2>
        {selection && (
          <button type="button" className="btn btn--ghost btn--small" onClick={onClear}>
            <Icon name="close" size={14} />
            Clear
          </button>
        )}
      </header>

      {selection ? (
        <EvidenceResults
          key={selectionId(selection)}
          service={service}
          analysisKey={analysisKey}
          selection={selection}
          isDemo={isDemo}
        />
      ) : (
        <div className="evidence__empty">
          <Icon name="chat" size={22} />
          <p>
            Select a keyword, a bar, or a trend point to read the comments behind that number.
          </p>
        </div>
      )}

      {isDemo && (
        <p className="evidence__demo-note">
          Demo comments, authors and video titles are synthetic, so videos aren’t linked to YouTube.
        </p>
      )}
    </aside>
  );
}

function EvidenceResults({
  service,
  analysisKey,
  selection,
  isDemo,
}: {
  service: AnalysisService;
  analysisKey: string;
  selection: EvidenceSelection;
  isDemo: boolean;
}) {
  const [sentiment, setSentiment] = useState<SentimentFilter>('all');
  const filter = useMemo(
    () => selectionToFilter(selection, sentiment === 'all' ? null : sentiment),
    [selection, sentiment],
  );
  const comments = useComments(service, analysisKey, filter);
  const term = selection.kind === 'keyword' ? selection.term : null;

  return (
    <div className="evidence__body">
      <p className="evidence__context" aria-live="polite">
        {describeSelection(selection)}
      </p>

      {selection.kind !== 'sentiment' && (
        <SegmentedControl label="Filter by sentiment" options={SENTIMENT_FILTERS} value={sentiment} onChange={setSentiment} />
      )}

      <div aria-live="polite" aria-busy={comments.status === 'loading'}>
        {comments.status === 'loading' && (
          <p className="evidence__count" role="status">
            Loading comments…
          </p>
        )}
        {comments.status === 'error' && (
          <div className="evidence__error" role="alert">
            <p>Couldn’t load comments. {comments.error?.message}</p>
            <button type="button" className="btn btn--small" onClick={comments.retry}>
              Try again
            </button>
          </div>
        )}
        {comments.status === 'success' && (
          <p className="evidence__count">
            {comments.total === 0
              ? 'No comments match this selection.'
              : `Showing ${formatCount(comments.items.length)} of ${formatCount(comments.total)} comments, most liked first`}
          </p>
        )}
      </div>

      {comments.status === 'loading' && (
        <ul className="evidence__list" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="comment comment--skeleton" />
          ))}
        </ul>
      )}

      {comments.status === 'success' && comments.items.length > 0 && (
        <ol className="evidence__list" aria-label="Comments">
          {comments.items.map((comment) => (
            <CommentCard key={comment.id} comment={comment} term={term} isDemo={isDemo} />
          ))}
        </ol>
      )}

      {comments.nextCursor && (
        <button
          type="button"
          className="btn evidence__more"
          onClick={comments.loadMore}
          disabled={comments.loadingMore}
          aria-busy={comments.loadingMore || undefined}
        >
          {comments.loadingMore ? 'Loading…' : 'Load more comments'}
        </button>
      )}
      {comments.loadMoreError && (
        <p className="evidence__error" role="alert">
          Couldn’t load more comments. {comments.loadMoreError.message}
        </p>
      )}
    </div>
  );
}

function CommentCard({ comment, term, isDemo }: { comment: CommentEvidence; term: string | null; isDemo: boolean }) {
  return (
    <li className="comment">
      <div className="comment__meta">
        <span className="comment__author">{comment.authorName}</span>
        {comment.isReply && <span className="comment__reply">Reply</span>}
        <time dateTime={comment.publishedAt}>{formatDate(comment.publishedAt)}</time>
        <span className="comment__likes">
          <Icon name="thumb" size={13} />
          <span className="tabular">{formatCount(comment.likeCount)}</span>
          <span className="visually-hidden"> likes</span>
        </span>
      </div>
      <p className="comment__text">
        <Highlight text={comment.text} term={term} />
      </p>
      <div className="comment__footer">
        <SentimentBadge sentiment={comment.sentiment} />
        <PeriodTag period={comment.period} />
        {isDemo ? (
          // Demo video IDs are made up: never link them to youtube.com, where they could pass for real videos.
          <span className="comment__video comment__video--demo">
            <span className="comment__video-title" title={comment.video.title}>
              {comment.video.title}
            </span>
            <span className="comment__video-demo">(demo video, not linked)</span>
          </span>
        ) : (
          <a className="comment__video" href={comment.video.url} target="_blank" rel="noopener noreferrer">
            <span className="comment__video-title" title={comment.video.title}>
              {comment.video.title}
            </span>
            <Icon name="external" size={12} />
            <span className="visually-hidden"> (video, opens in a new tab)</span>
          </a>
        )}
      </div>
    </li>
  );
}

/** Wraps whole-word, case-insensitive matches of `term` in <mark>. */
export function Highlight({ text, term }: { text: string; term: string | null }) {
  if (!term) return <>{text}</>;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(\\b${escaped}\\b)`, 'gi'));
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part))}
    </>
  );
}
