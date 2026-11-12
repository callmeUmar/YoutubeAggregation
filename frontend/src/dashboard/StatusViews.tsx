import type { AnalysisError, AnalysisErrorCode } from '../api/errors';
import type { AnalysisProgress } from '../api/types';
import { Icon, type IconName } from '../components/Icon';
import './StatusViews.css';

/* ------------------------------------------------------------------ */
/* Demo banner                                                         */
/* ------------------------------------------------------------------ */

export function DemoBanner() {
  return (
    <div className="demo-banner" role="note" aria-label="Demo data notice">
      <Icon name="flask" size={18} />
      <p>
        <strong>DEMO DATA.</strong> These numbers and comments are generated locally from a fixed seed so the
        dashboard can be reviewed before the backend is ready. They are <strong>not</strong> from the YouTube API and
        don’t describe any real channel.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Idle                                                                */
/* ------------------------------------------------------------------ */

const STEPS = [
  { title: 'Enter a channel', body: 'Use the channel’s @handle, its link, or its UC… channel ID.' },
  { title: 'Pick two periods', body: 'Videos are grouped by the date they were published.' },
  { title: 'Follow the evidence', body: 'Click any keyword, bar, or trend point to read the comments behind it.' },
];

export function IdleState() {
  return (
    <section className="status-panel idle" aria-labelledby="idle-title">
      <div className="status-panel__icon">
        <Icon name="bars" size={22} />
      </div>
      <h2 id="idle-title" className="status-panel__title">
        Compare how viewers responded across two periods
      </h2>
      <p className="status-panel__body">
        Every number is a count of labeled comments (praise, neutral, or criticism), and every number links back to
        the comments it came from.
      </p>
      <ol className="idle__steps">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <span className="idle__step-number" aria-hidden="true">
              {i + 1}
            </span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

export function LoadingState({ channel, progress }: { channel: string; progress: AnalysisProgress }) {
  return (
    <section className="status-panel loading" aria-labelledby="loading-title" aria-busy="true">
      <h2 id="loading-title" className="status-panel__title">
        Analyzing {channel}
      </h2>
      <div
        className="progress"
        role="progressbar"
        aria-labelledby="loading-title"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.progress}
        aria-valuetext={`${progress.progress}% · ${progress.step ?? 'Working'}`}
      >
        <div className="progress__fill" style={{ width: `${Math.max(progress.progress, 4)}%` }} />
      </div>
      <p className="status-panel__body" aria-live="polite">
        {progress.step ?? 'Working'}…
      </p>
      <div className="skeleton-grid" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skeleton skeleton--tile" />
        ))}
        <div className="skeleton skeleton--chart" />
        <div className="skeleton skeleton--chart" />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

interface ErrorCopy {
  icon: IconName;
  title: string;
  body: string;
  action: 'editChannel' | 'editDates' | 'retry' | null;
  actionLabel?: string;
}

const ERROR_COPY: Record<AnalysisErrorCode, ErrorCopy> = {
  INVALID_CHANNEL: {
    icon: 'search',
    title: 'We couldn’t find that channel',
    body: 'Check the spelling of the handle or paste the channel’s link from YouTube. Handles look like @creatorlab.',
    action: 'editChannel',
    actionLabel: 'Edit channel',
  },
  COMMENTS_UNAVAILABLE: {
    icon: 'chat',
    title: 'No comments to analyze',
    body: 'Comments are turned off, or no videos were published in these periods. Try wider date ranges.',
    action: 'editDates',
    actionLabel: 'Change dates',
  },
  QUOTA_EXHAUSTED: {
    icon: 'clock',
    title: 'Daily YouTube quota reached',
    body: 'The app has used today’s YouTube API allowance, so new channels can’t be fetched right now. Analyses that were already run can still be opened.',
    action: null,
  },
  NETWORK: {
    icon: 'offline',
    title: 'Can’t reach the analysis service',
    body: 'Check your internet connection and try again. If the problem continues, the service may be down.',
    action: 'retry',
    actionLabel: 'Try again',
  },
  UNKNOWN: {
    icon: 'alert',
    title: 'Something went wrong',
    body: 'The analysis didn’t finish. Trying again usually helps.',
    action: 'retry',
    actionLabel: 'Try again',
  },
};

interface ErrorStateProps {
  error: AnalysisError;
  onRetry: () => void;
  onEditChannel: () => void;
  onEditDates: () => void;
}

export function ErrorState({ error, onRetry, onEditChannel, onEditDates }: ErrorStateProps) {
  const copy = ERROR_COPY[error.code];
  const handler = { editChannel: onEditChannel, editDates: onEditDates, retry: onRetry };
  return (
    <section className={`status-panel error error--${error.code}`} role="alert" aria-labelledby="error-title">
      <div className="status-panel__icon status-panel__icon--error">
        <Icon name={copy.icon} size={22} />
      </div>
      <h2 id="error-title" className="status-panel__title">
        {copy.title}
      </h2>
      <p className="status-panel__body">{copy.body}</p>
      {error.code === 'QUOTA_EXHAUSTED' && error.retryAt && (
        <p className="status-panel__meta">
          Quota resets at midnight Pacific time ({formatRetry(error.retryAt)}).
        </p>
      )}
      <p className="status-panel__detail">
        <span className="visually-hidden">Details: </span>
        {error.message}
      </p>
      {copy.action && (
        <button type="button" className="btn btn--primary" onClick={handler[copy.action]}>
          {copy.actionLabel}
        </button>
      )}
    </section>
  );
}

function formatRetry(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(
    new Date(iso),
  );
}
