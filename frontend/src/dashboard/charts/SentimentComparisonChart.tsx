import { Bar, BarChart, CartesianGrid, Cell, LabelList, Tooltip, type TooltipContentProps, XAxis, YAxis } from 'recharts';
import { type AnalysisResult, PERIOD_IDS, type PeriodId, SENTIMENTS, type Sentiment } from '../../api/types';
import { Card } from '../../components/Card';
import { SENTIMENT_LABEL, formatCount, formatPercent, sentimentShare } from '../../lib/format';
import { type EvidenceSelection, isSelected } from '../selection';
import { DataTableDisclosure, PeriodLegend, TooltipFrame } from './ChartParts';
import { PERIOD_COLOR, usePrefersReducedMotion } from './chartUtils';

interface Row {
  sentiment: Sentiment;
  label: string;
  A: number;
  B: number;
  countA: number;
  countB: number;
}

interface Props {
  result: AnalysisResult;
  selection: EvidenceSelection | null;
  onSelect: (selection: EvidenceSelection) => void;
}

export function SentimentComparisonChart({ result, selection, onSelect }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const rows: Row[] = SENTIMENTS.map((sentiment) => ({
    sentiment,
    label: SENTIMENT_LABEL[sentiment],
    A: sentimentShare(result.periods.A.sentiment, sentiment) ?? 0,
    B: sentimentShare(result.periods.B.sentiment, sentiment) ?? 0,
    countA: result.periods.A.sentiment[sentiment],
    countB: result.periods.B.sentiment[sentiment],
  }));
  const max = Math.max(...rows.flatMap((r) => [r.A, r.B]));
  // Even 20-point steps, with headroom for the value labels above the bars.
  const yMax = Math.min(100, Math.ceil((max + 6) / 20) * 20);
  const yTicks = Array.from({ length: yMax / 20 + 1 }, (_, i) => i * 20);

  const select = (period: PeriodId, sentiment: Sentiment) => onSelect({ kind: 'sentiment', period, sentiment });
  const hasSentimentSelection = selection?.kind === 'sentiment';

  return (
    <Card
      title="Sentiment comparison"
      description="Share of analyzed comments in each category. Click a bar to read those comments."
      actions={<PeriodLegend periods={result.periods} />}
    >
      <div className="chart" style={{ height: 280 }}>
        <BarChart
          responsive
          style={{ width: '100%', height: '100%' }}
          data={rows}
          margin={{ top: 24, right: 8, bottom: 0, left: -8 }}
          // Narrow category gaps keep bars at least as wide as their % labels on phones.
          barGap={6}
          barCategoryGap="16%"
          accessibilityLayer
        >
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: 'var(--axis)' }}
            tick={{ fill: 'var(--text-secondary)', fontSize: 13 }}
          />
          <YAxis
            domain={[0, yMax]}
            ticks={yTicks}
            tickFormatter={(v: number) => `${v}%`}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            width={48}
          />
          <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={ComparisonTooltip} />
          {PERIOD_IDS.map((period) => (
            <Bar
              key={period}
              dataKey={period}
              name={`Period ${period}`}
              fill={PERIOD_COLOR[period]}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              cursor="pointer"
              isAnimationActive={!reducedMotion}
              onClick={(_, index) => {
                const row = rows[index];
                if (row) select(period, row.sentiment);
              }}
            >
              {rows.map((row) => (
                <Cell
                  key={row.sentiment}
                  fillOpacity={
                    hasSentimentSelection &&
                    !isSelected(selection, { kind: 'sentiment', period, sentiment: row.sentiment })
                      ? 0.35
                      : 1
                  }
                />
              ))}
              <LabelList
                dataKey={period}
                position="top"
                offset={6}
                fill="var(--text-secondary)"
                fontSize={12}
                formatter={(value) => (typeof value === 'number' ? `${Math.round(value)}%` : '')}
              />
            </Bar>
          ))}
        </BarChart>
      </div>

      <DataTableDisclosure>
        <table className="table">
          <caption className="visually-hidden">Share of comments by sentiment in each period</caption>
          <thead>
            <tr>
              <th scope="col">Sentiment</th>
              <th scope="col">Period A</th>
              <th scope="col">Period B</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.sentiment}>
                <th scope="row">{row.label}</th>
                {PERIOD_IDS.map((period) => {
                  const count = period === 'A' ? row.countA : row.countB;
                  const pressed = isSelected(selection, { kind: 'sentiment', period, sentiment: row.sentiment });
                  return (
                    <td key={period}>
                      <button
                        type="button"
                        className="table-button"
                        aria-pressed={pressed}
                        aria-label={`Show ${formatCount(count)} ${row.label.toLowerCase()} comments from Period ${period}`}
                        onClick={() => select(period, row.sentiment)}
                      >
                        <span className="tabular">{formatPercent(row[period])}</span>
                        <span className="muted tabular">{formatCount(count)}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableDisclosure>
    </Card>
  );
}

function ComparisonTooltip({ active, payload }: TooltipContentProps) {
  const row = payload?.[0]?.payload as Row | undefined;
  if (!active || !row) return null;
  return (
    <TooltipFrame title={row.label} hint="Click a bar to read these comments">
      {PERIOD_IDS.map((period) => (
        <p key={period} className="chart-tooltip__row">
          <span className={`swatch swatch--${period}`} aria-hidden="true" />
          <span>Period {period}</span>
          <strong className="tabular">{formatPercent(row[period])}</strong>
          <span className="muted tabular">{formatCount(period === 'A' ? row.countA : row.countB)} comments</span>
        </p>
      ))}
    </TooltipFrame>
  );
}
