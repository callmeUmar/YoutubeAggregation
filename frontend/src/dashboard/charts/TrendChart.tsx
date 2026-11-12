import { useState } from 'react';
import {
  CartesianGrid,
  type DotItemDotProps,
  Line,
  LineChart,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts';
import { type AnalysisResult, PERIOD_IDS, type PeriodId, type TrendBucket } from '../../api/types';
import { Card } from '../../components/Card';
import { type SegmentOption, SegmentedControl } from '../../components/SegmentedControl';
import { formatRange } from '../../lib/dates';
import { formatCompact, formatCount, formatPercent } from '../../lib/format';
import { type EvidenceSelection, bucketLabel, isSelected } from '../selection';
import { DataTableDisclosure, PeriodLegend, TooltipFrame } from './ChartParts';
import { PERIOD_COLOR, type TrendMetric, type TrendRow, buildTrendRows, usePrefersReducedMotion } from './chartUtils';

const METRICS: readonly SegmentOption<TrendMetric>[] = [
  { value: 'praise', label: 'Praise %' },
  { value: 'criticism', label: 'Criticism %' },
  { value: 'volume', label: 'Comments' },
];

/** Shares from fewer comments than this are flagged as unreliable. */
const LOW_VOLUME = 30;

function formatMetric(value: number | null, metric: TrendMetric): string {
  if (value === null) return 'No comments';
  return metric === 'volume' ? formatCount(value) : formatPercent(value);
}

interface Props {
  result: AnalysisResult;
  selection: EvidenceSelection | null;
  onSelect: (selection: EvidenceSelection) => void;
}

export function TrendChart({ result, selection, onSelect }: Props) {
  const [metric, setMetric] = useState<TrendMetric>('praise');
  const reducedMotion = usePrefersReducedMotion();
  const rows = buildTrendRows(result.trend, metric, result.granularity);
  const unit = result.granularity === 'week' ? 'week' : '30-day block';

  const selectBucket = (period: PeriodId, bucket: TrendBucket | undefined) => {
    if (bucket && bucket.commentCount > 0) {
      onSelect({ kind: 'bucket', period, bucket, granularity: result.granularity });
    }
  };

  // Recharts calls this as a plain render function (not a component) per point.
  const renderDot =
    (period: PeriodId) =>
    ({ cx, cy, index }: DotItemDotProps) => {
      const row = rows[index];
      const bucket = period === 'A' ? row?.bucketA : row?.bucketB;
      if (cx == null || cy == null || !bucket || row?.[period] == null) return <g key={`${period}-${index}`} />;
      const selected = isSelected(selection, { kind: 'bucket', period, bucket, granularity: result.granularity });
      const color = PERIOD_COLOR[period];
      return (
        <g key={`${period}-${index}`} className="trend-dot" onClick={() => selectBucket(period, bucket)}>
          <circle cx={cx} cy={cy} r={12} fill="transparent" />
          {selected && <circle cx={cx} cy={cy} r={9} fill="none" stroke={color} strokeWidth={2} />}
          <circle cx={cx} cy={cy} r={selected ? 5.5 : 4} fill={color} stroke="var(--surface)" strokeWidth={2} />
        </g>
      );
    };

  return (
    <Card
      title="Trend within each period"
      description={`Each point groups videos by the ${unit} they were published, counted from the start of its period. Click a point to read its comments.`}
      actions={<SegmentedControl label="Trend metric" options={METRICS} value={metric} onChange={setMetric} />}
    >
      <PeriodLegend periods={result.periods} />
      <div className="chart" style={{ height: 280 }}>
        <LineChart
          responsive
          style={{ width: '100%', height: '100%' }}
          data={rows}
          margin={{ top: 16, right: 16, bottom: 0, left: -8 }}
          accessibilityLayer
        >
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: 'var(--axis)' }}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            domain={metric === 'volume' ? [0, 'auto'] : [0, 100]}
            tickFormatter={(v: number) => (metric === 'volume' ? formatCompact(v) : `${v}%`)}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            width={48}
          />
          <Tooltip
            cursor={{ stroke: 'var(--axis)', strokeWidth: 1 }}
            content={(props) => <TrendTooltip {...props} metric={metric} granularity={result.granularity} />}
          />
          {PERIOD_IDS.map((period) => (
            <Line
              key={`${period}-${metric}`}
              type="linear"
              dataKey={period}
              name={`Period ${period}`}
              stroke={PERIOD_COLOR[period]}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={renderDot(period)}
              activeDot={false}
              connectNulls={false}
              isAnimationActive={!reducedMotion}
            />
          ))}
        </LineChart>
      </div>
      <p className="chart-caption">
        {result.granularity === 'week' ? 'Weeks' : '30-day blocks'} since the start of each period
      </p>

      <DataTableDisclosure>
        <table className="table">
          <caption className="visually-hidden">
            {METRICS.find((m) => m.value === metric)?.label} per {unit} in each period
          </caption>
          <thead>
            <tr>
              <th scope="col">{result.granularity === 'week' ? 'Week' : 'Block'}</th>
              <th scope="col">Period A</th>
              <th scope="col">Period B</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.index}>
                <th scope="row">{row.index + 1}</th>
                {PERIOD_IDS.map((period) => {
                  const bucket = period === 'A' ? row.bucketA : row.bucketB;
                  if (!bucket) return <td key={period} className="muted">—</td>;
                  const label = bucketLabel(result.granularity, row.index);
                  return (
                    <td key={period}>
                      <button
                        type="button"
                        className="table-button"
                        disabled={bucket.commentCount === 0}
                        aria-pressed={isSelected(selection, { kind: 'bucket', period, bucket, granularity: result.granularity })}
                        aria-label={`Show comments for Period ${period}, ${label}, ${formatRange(bucket)}: ${formatMetric(row[period], metric)}`}
                        onClick={() => selectBucket(period, bucket)}
                      >
                        <span className="tabular">{formatMetric(row[period], metric)}</span>
                        <span className="muted">{formatRange(bucket)}</span>
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

interface TrendTooltipProps extends TooltipContentProps {
  metric: TrendMetric;
  granularity: AnalysisResult['granularity'];
}

function TrendTooltip({ active, payload, metric, granularity }: TrendTooltipProps) {
  const row = payload?.[0]?.payload as TrendRow | undefined;
  if (!active || !row) return null;
  return (
    <TooltipFrame title={bucketLabel(granularity, row.index)} hint="Click a point to read its comments">
      {PERIOD_IDS.map((period) => {
        const bucket = period === 'A' ? row.bucketA : row.bucketB;
        if (!bucket) return null;
        const low = metric !== 'volume' && bucket.commentCount > 0 && bucket.commentCount < LOW_VOLUME;
        return (
          <div key={period} className="chart-tooltip__block">
            <p className="chart-tooltip__row">
              <span className={`swatch swatch--${period}`} aria-hidden="true" />
              <span>Period {period}</span>
              <strong className="tabular">{formatMetric(row[period], metric)}</strong>
            </p>
            <p className="chart-tooltip__sub">
              {formatRange(bucket)} · {formatCount(bucket.videoCount)} videos · {formatCount(bucket.commentCount)}{' '}
              comments{low ? ' · low volume' : ''}
            </p>
          </div>
        );
      })}
    </TooltipFrame>
  );
}
