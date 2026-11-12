import { useRef, useState } from 'react';
import type { AnalysisService } from '../api/service';
import type { AnalysisResult } from '../api/types';
import { DemoTag } from '../components/SentimentBadge';
import { SentimentComparisonChart } from './charts/SentimentComparisonChart';
import { TrendChart } from './charts/TrendChart';
import { EvidencePanel } from './EvidencePanel';
import { KeywordPanel } from './KeywordPanel';
import type { EvidenceSelection } from './selection';
import { DemoBanner } from './StatusViews';
import { SummaryCards } from './SummaryCards';
import './Dashboard.css';

interface Props {
  result: AnalysisResult;
  service: AnalysisService;
}

/**
 * Results for one analysis. Remount it (via `key={result.key}`) for a new
 * result so the evidence selection resets.
 */
export function Dashboard({ result, service }: Props) {
  const [selection, setSelection] = useState<EvidenceSelection | null>(null);
  const evidenceRef = useRef<HTMLElement>(null);
  const isDemo = result.source !== 'youtube';

  const select = (next: EvidenceSelection) => {
    setSelection(next);
    revealIfOffscreen(evidenceRef.current);
  };

  return (
    <div className="dashboard">
      {isDemo && <DemoBanner />}

      <header className="dashboard__header">
        <div>
          <h2 className="dashboard__channel">
            {result.channel.title}
            {isDemo && <DemoTag />}
          </h2>
          <p className="dashboard__meta">
            {result.channel.handle ?? result.channel.id} · Periods matched by video publish date · Generated{' '}
            {new Date(result.generatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
      </header>

      <SummaryCards result={result} />

      <div className="dashboard__grid">
        <div className="dashboard__main">
          <SentimentComparisonChart result={result} selection={selection} onSelect={select} />
          <TrendChart result={result} selection={selection} onSelect={select} />
          <KeywordPanel result={result} selection={selection} onSelect={select} />
        </div>
        <div className="dashboard__aside">
          <EvidencePanel
            ref={evidenceRef}
            service={service}
            analysisKey={result.key}
            isDemo={isDemo}
            selection={selection}
            onClear={() => setSelection(null)}
          />
        </div>
      </div>
    </div>
  );
}

/** On stacked (mobile) layouts the evidence panel is below the fold; bring it into view. */
function revealIfOffscreen(element: HTMLElement | null) {
  if (!element || typeof element.scrollIntoView !== 'function') return;
  const { top } = element.getBoundingClientRect();
  if (top > window.innerHeight * 0.6 || top < 0) {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
}
