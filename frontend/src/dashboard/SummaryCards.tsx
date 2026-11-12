import { type AnalysisResult, PERIOD_IDS, type PeriodId, type Sentiment } from '../api/types';
import { Icon } from '../components/Icon';
import {
  SENTIMENT_LABEL,
  formatCount,
  formatPercent,
  formatPointDelta,
  formatRelativeDelta,
  sentimentShare,
} from '../lib/format';
import './SummaryCards.css';

type Polarity = 'upIsGood' | 'upIsBad' | 'neutral';

interface TileProps {
  label: string;
  values: Record<PeriodId, string>;
  delta: { text: string; direction: 'up' | 'down' | 'flat'; polarity: Polarity } | null;
  note?: string;
  swatch?: Sentiment;
}

function Tile({ label, values, delta, note, swatch }: TileProps) {
  const tone =
    !delta || delta.direction === 'flat' || delta.polarity === 'neutral'
      ? 'neutral'
      : (delta.direction === 'up') === (delta.polarity === 'upIsGood')
        ? 'good'
        : 'bad';
  const spokenDirection = delta?.direction === 'up' ? 'up' : delta?.direction === 'down' ? 'down' : 'no change';

  return (
    <li className="tile">
      <h3 className="tile__label">
        {swatch && <span className={`swatch swatch--${swatch}`} aria-hidden="true" />}
        {label}
      </h3>
      <dl className="tile__values">
        {PERIOD_IDS.map((period) => (
          <div key={period} className="tile__row">
            <dt>
              <span className={`swatch swatch--${period}`} aria-hidden="true" />
              <span className="visually-hidden">Period </span>
              {period}
            </dt>
            <dd className={period === 'B' ? 'tile__value tile__value--primary' : 'tile__value'}>{values[period]}</dd>
          </div>
        ))}
      </dl>
      {delta && (
        <p className={`tile__delta tile__delta--${tone}`}>
          {delta.direction !== 'flat' && <Icon name={delta.direction === 'up' ? 'arrowUp' : 'arrowDown'} size={14} />}
          <span className="visually-hidden">{spokenDirection}: </span>
          {delta.text}
          <span className="tile__delta-context"> vs A</span>
        </p>
      )}
      {note && <p className="tile__note">{note}</p>}
    </li>
  );
}

function countDelta(from: number, to: number): TileProps['delta'] {
  const text = formatRelativeDelta(from, to);
  if (text === null) return null;
  return { text, direction: to > from ? 'up' : to < from ? 'down' : 'flat', polarity: 'neutral' };
}

function shareDelta(from: number | null, to: number | null, polarity: Polarity): TileProps['delta'] {
  if (from === null || to === null) return null;
  const diff = to - from;
  const rounded = Math.round(diff * 10) / 10;
  return { text: formatPointDelta(diff), direction: rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat', polarity };
}

const SENTIMENT_POLARITY: Record<Sentiment, Polarity> = {
  praise: 'upIsGood',
  neutral: 'neutral',
  criticism: 'upIsBad',
};

export function SummaryCards({ result }: { result: AnalysisResult }) {
  const { A, B } = result.periods;
  const skipped = A.videosSkipped + B.videosSkipped;

  return (
    <section aria-labelledby="summary-title" className="summary">
      <h2 id="summary-title" className="visually-hidden">
        Summary
      </h2>
      <ul className="summary__grid">
        <Tile
          label="Videos analyzed"
          values={{ A: formatCount(A.videoCount), B: formatCount(B.videoCount) }}
          delta={countDelta(A.videoCount, B.videoCount)}
          note={
            skipped > 0 ? `${formatCount(skipped)} skipped (comments off)` : undefined
          }
        />
        <Tile
          label="Comments analyzed"
          values={{ A: formatCount(A.commentCount), B: formatCount(B.commentCount) }}
          delta={countDelta(A.commentCount, B.commentCount)}
        />
        {(['praise', 'neutral', 'criticism'] as const).map((sentiment) => {
          const a = sentimentShare(A.sentiment, sentiment);
          const b = sentimentShare(B.sentiment, sentiment);
          return (
            <Tile
              key={sentiment}
              label={SENTIMENT_LABEL[sentiment]}
              swatch={sentiment}
              values={{ A: formatPercent(a), B: formatPercent(b) }}
              delta={shareDelta(a, b, SENTIMENT_POLARITY[sentiment])}
            />
          );
        })}
      </ul>
    </section>
  );
}
