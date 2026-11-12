import { Suspense, lazy, useState } from 'react';
import type { AnalysisService } from './api/service';
import { AnalysisForm, CHANNEL_INPUT_ID } from './dashboard/AnalysisForm';
import { ErrorState, IdleState, LoadingState } from './dashboard/StatusViews';
import { useAnalysis } from './hooks/useAnalysis';
import { localToday, presetRanges } from './lib/dates';
import type { AnalysisFormValues } from './lib/validation';
import { DEMO_ERROR_CHANNELS, DEMO_SUCCESS_CHANNEL } from './mock/mockAnalysisService';
import './App.css';

// Charts (Recharts) are only needed once a result exists; keep them out of the first load.
const Dashboard = lazy(() => import('./dashboard/Dashboard').then((m) => ({ default: m.Dashboard })));

const DEFAULT_PRESET_DAYS = 90;
const RENDERING = { status: 'done', progress: 100, step: 'Preparing charts' } as const;
const DEMO_CHANNELS = [DEMO_SUCCESS_CHANNEL, ...Object.keys(DEMO_ERROR_CHANNELS)];

interface AppProps {
  service: AnalysisService;
  /** `YYYY-MM-DD`; injectable so tests are independent of the real date. */
  today?: string;
}

export function App({ service, today = localToday() }: AppProps) {
  const [values, setValues] = useState<AnalysisFormValues>(() => ({
    channel: '',
    ...presetRanges(DEFAULT_PRESET_DAYS, today),
  }));
  const { state, run } = useAnalysis(service);
  const isDemo = service.source === 'demo';

  const focus = (id: string) => document.getElementById(id)?.focus();

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <div className="container app-header__inner">
          <div className="brand">
            <span className="brand__mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M6 18v-6M12 18V6M18 18v-4" />
              </svg>
            </span>
            <div>
              <h1 className="brand__name">Comment Analyzer</h1>
              <p className="brand__tagline">
                See how viewer sentiment and talking points changed between two periods, and read the comments behind
                every number.
              </p>
            </div>
          </div>
          {isDemo && (
            <span className="mode-pill" title="No backend connected. All results are generated demo data.">
              <span className="mode-pill__dot" aria-hidden="true" />
              Demo mode
            </span>
          )}
        </div>
      </header>

      <main id="main" className="container app-main" tabIndex={-1}>
        <AnalysisForm
          values={values}
          onChange={setValues}
          onSubmit={run}
          isRunning={state.status === 'loading'}
          today={today}
          demoChannels={isDemo ? DEMO_CHANNELS : undefined}
        />

        {state.status === 'idle' && <IdleState />}
        {state.status === 'loading' && <LoadingState channel={state.request.channel} progress={state.progress} />}
        {state.status === 'error' && (
          <ErrorState
            error={state.error}
            onRetry={() => run(state.request)}
            onEditChannel={() => focus(CHANNEL_INPUT_ID)}
            onEditDates={() => focus('periodA-start')}
          />
        )}
        {state.status === 'success' && (
          <Suspense fallback={<LoadingState channel={state.request.channel} progress={RENDERING} />}>
            <Dashboard key={state.result.key} result={state.result} service={service} />
          </Suspense>
        )}
      </main>

      <footer className="container app-footer">
        <p>
          No generative AI: every figure is a count of comments labeled praise, neutral, or criticism.
          {isDemo && ' Currently showing demo data only.'}
        </p>
      </footer>
    </>
  );
}
