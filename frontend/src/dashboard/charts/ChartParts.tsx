import type { ReactNode } from 'react';
import { PERIOD_IDS, type PeriodSummary } from '../../api/types';
import { formatRange } from '../../lib/dates';
import './charts.css';

/** Legend for the two comparison periods, with their date ranges. */
export function PeriodLegend({ periods }: { periods: Record<'A' | 'B', PeriodSummary> }) {
  return (
    <ul className="legend" aria-label="Legend">
      {PERIOD_IDS.map((period) => (
        <li key={period}>
          <span className={`swatch swatch--${period}`} aria-hidden="true" />
          <span>
            <strong className="legend__name">Period {period}</strong>{' '}
            <span className="muted">{formatRange(periods[period].range)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Collapsible accessible table that mirrors a chart, with selectable cells. */
export function DataTableDisclosure({ summary = 'View as table', children }: { summary?: string; children: ReactNode }) {
  return (
    <details className="data-table">
      <summary>{summary}</summary>
      <div className="data-table__scroll">{children}</div>
    </details>
  );
}

export function TooltipFrame({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__title">{title}</p>
      {children}
      {hint && <p className="chart-tooltip__hint">{hint}</p>}
    </div>
  );
}
