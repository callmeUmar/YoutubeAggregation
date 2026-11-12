import { SENTIMENTS, type SentimentCounts } from '../api/types';
import './components.css';

interface SentimentBarProps {
  counts: SentimentCounts;
  /** 0–1: bar length relative to its container, so bars can also encode volume. */
  scale?: number;
}

/**
 * Thin segmented bar (praise | neutral | criticism). Decorative: callers must
 * expose the same numbers as text or via an accessible label.
 */
export function SentimentBar({ counts, scale = 1 }: SentimentBarProps) {
  const total = counts.praise + counts.neutral + counts.criticism;
  return (
    <span className="sentiment-bar" style={{ width: `${Math.max(scale, 0.02) * 100}%` }} aria-hidden="true">
      {total > 0 &&
        SENTIMENTS.map((sentiment) =>
          counts[sentiment] > 0 ? (
            <span
              key={sentiment}
              className={`sentiment-bar__part swatch--${sentiment}`}
              style={{ flexGrow: counts[sentiment] }}
            />
          ) : null,
        )}
    </span>
  );
}
