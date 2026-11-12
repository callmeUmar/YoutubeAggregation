import type { Sentiment } from '../api/types';
import { SENTIMENT_LABEL } from '../lib/format';
import './components.css';

/** Sentiment label: a colored mark beside text, so meaning never relies on color alone. */
export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  return (
    <span className={`sentiment-badge sentiment-badge--${sentiment}`}>
      <span className={`swatch swatch--${sentiment}`} aria-hidden="true" />
      {SENTIMENT_LABEL[sentiment]}
    </span>
  );
}

export function PeriodTag({ period }: { period: 'A' | 'B' }) {
  return (
    <span className="period-tag">
      <span className={`swatch swatch--${period}`} aria-hidden="true" />
      Period {period}
    </span>
  );
}

export function DemoTag() {
  return <span className="demo-tag">Demo data</span>;
}
