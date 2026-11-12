import { type AnalysisResult, PERIOD_IDS, type KeywordStat, type PeriodId } from '../api/types';
import { Card } from '../components/Card';
import { SentimentBar } from '../components/SentimentBar';
import { formatRange } from '../lib/dates';
import { formatCount, formatPercent, sentimentShare } from '../lib/format';
import { type EvidenceSelection, isSelected } from './selection';
import './KeywordPanel.css';

interface Props {
  result: AnalysisResult;
  selection: EvidenceSelection | null;
  onSelect: (selection: EvidenceSelection) => void;
}

function keywordLabel(keyword: KeywordStat, period: PeriodId): string {
  const s = keyword.sentiment;
  return (
    `${keyword.term}: ${formatCount(keyword.count)} comments in Period ${period}. ` +
    `${formatPercent(sentimentShare(s, 'praise'), 0)} praise, ` +
    `${formatPercent(sentimentShare(s, 'neutral'), 0)} neutral, ` +
    `${formatPercent(sentimentShare(s, 'criticism'), 0)} criticism.`
  );
}

export function KeywordPanel({ result, selection, onSelect }: Props) {
  // One scale for both periods so bar lengths are comparable side by side.
  const maxCount = Math.max(1, ...PERIOD_IDS.flatMap((p) => result.keywords[p].map((k) => k.count)));

  return (
    <Card
      title="Top keywords"
      description="How many comments mention each term. Bar color shows the sentiment mix. Select a keyword to read the comments."
      actions={
        <ul className="legend" aria-label="Sentiment legend">
          <li>
            <span className="swatch swatch--praise" aria-hidden="true" /> Praise
          </li>
          <li>
            <span className="swatch swatch--neutral" aria-hidden="true" /> Neutral
          </li>
          <li>
            <span className="swatch swatch--criticism" aria-hidden="true" /> Criticism
          </li>
        </ul>
      }
    >
      <div className="keywords">
        {PERIOD_IDS.map((period) => {
          const other = new Set(result.keywords[period === 'A' ? 'B' : 'A'].map((k) => k.term));
          const keywords = result.keywords[period];
          const headingId = `keywords-${period}`;
          return (
            <div key={period} className="keywords__column">
              <h3 id={headingId} className="keywords__heading">
                <span className={`swatch swatch--${period}`} aria-hidden="true" />
                Period {period}
                <span className="keywords__range">{formatRange(result.periods[period].range)}</span>
              </h3>
              {keywords.length === 0 ? (
                <p className="keywords__empty">No keywords. This period has no analyzed comments.</p>
              ) : (
                <ol className="keywords__list" aria-labelledby={headingId}>
                  {keywords.map((keyword) => {
                    const candidate: EvidenceSelection = { kind: 'keyword', period, term: keyword.term };
                    const isNew = !other.has(keyword.term);
                    return (
                      <li key={keyword.term}>
                        <button
                          type="button"
                          className="keyword"
                          aria-pressed={isSelected(selection, candidate)}
                          aria-label={`${keywordLabel(keyword, period)}${isNew ? ` Not in Period ${period === 'A' ? 'B' : 'A'}’s top keywords.` : ''}`}
                          onClick={() => onSelect(candidate)}
                        >
                          <span className="keyword__term">
                            {keyword.term}
                            {isNew && <span className="keyword__new">{period === 'B' ? 'New' : 'Dropped'}</span>}
                          </span>
                          <span className="keyword__count tabular">{formatCount(keyword.count)}</span>
                          <span className="keyword__bar">
                            <SentimentBar counts={keyword.sentiment} scale={keyword.count / maxCount} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
