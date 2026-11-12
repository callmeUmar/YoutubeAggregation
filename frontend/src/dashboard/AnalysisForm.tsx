import { type FormEvent, useState } from 'react';
import type { AnalysisRequest, DateRange, PeriodId } from '../api/types';
import { COMPARISON_PRESETS, presetRanges } from '../lib/dates';
import {
  type AnalysisFormValues,
  EARLIEST_DATE,
  type FieldKey,
  type FormErrors,
  hasErrors,
  parseChannelInput,
  validateAnalysisForm,
} from '../lib/validation';
import './AnalysisForm.css';

export const CHANNEL_INPUT_ID = 'channel-input';

const FIELD_ORDER: readonly FieldKey[] = [
  'channel',
  'periodA.start',
  'periodA.end',
  'periodA',
  'periodB.start',
  'periodB.end',
  'periodB',
];

const FIELD_ELEMENT: Record<FieldKey, string> = {
  channel: CHANNEL_INPUT_ID,
  'periodA.start': 'periodA-start',
  'periodA.end': 'periodA-end',
  periodA: 'periodA-start',
  'periodB.start': 'periodB-start',
  'periodB.end': 'periodB-end',
  periodB: 'periodB-start',
};

interface AnalysisFormProps {
  values: AnalysisFormValues;
  onChange: (values: AnalysisFormValues) => void;
  onSubmit: (request: AnalysisRequest) => void;
  isRunning: boolean;
  today: string;
  /** Shortcuts for demo scenarios. Pass only while using demo data. */
  demoChannels?: readonly string[];
}

export function AnalysisForm({ values, onChange, onSubmit, isRunning, today, demoChannels = [] }: AnalysisFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [channelTouched, setChannelTouched] = useState(false);

  const allErrors = validateAnalysisForm(values, today);
  // Before the first submit, only show the channel error once the user has left the field.
  const errors: FormErrors = submitted
    ? allErrors
    : channelTouched && values.channel.trim()
      ? { channel: allErrors.channel }
      : {};

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const channel = parseChannelInput(values.channel);
    if (hasErrors(allErrors) || !channel.ok) {
      const first = FIELD_ORDER.find((key) => allErrors[key]);
      if (first) document.getElementById(FIELD_ELEMENT[first])?.focus();
      return;
    }
    onSubmit({
      channel: channel.channel.value,
      periodA: values.periodA,
      periodB: values.periodB,
      groupBy: 'videoPublishedAt',
    });
  }

  const setPeriod = (period: 'periodA' | 'periodB', range: DateRange) => onChange({ ...values, [period]: range });

  return (
    <form className="analysis-form" noValidate onSubmit={handleSubmit} aria-label="Analysis settings">
      <div className="analysis-form__grid">
        <div className="field field--channel">
          <label className="field__label" htmlFor={CHANNEL_INPUT_ID}>
            YouTube channel
          </label>
          <input
            id={CHANNEL_INPUT_ID}
            className="input"
            type="text"
            name="channel"
            value={values.channel}
            placeholder="@creatorlab"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={errors.channel ? true : undefined}
            aria-describedby={`channel-hint${errors.channel ? ' channel-error' : ''}`}
            onChange={(e) => onChange({ ...values, channel: e.target.value })}
            onBlur={() => setChannelTouched(true)}
          />
          {errors.channel ? (
            <p id="channel-error" className="field__error">
              {errors.channel}
            </p>
          ) : null}
          <p id="channel-hint" className="field__hint">
            Handle, channel link, or channel ID (UC…)
          </p>
        </div>

        <DateRangeFieldset
          period="A"
          range={values.periodA}
          errors={errors}
          today={today}
          onChange={(range) => setPeriod('periodA', range)}
        />
        <DateRangeFieldset
          period="B"
          range={values.periodB}
          errors={errors}
          today={today}
          onChange={(range) => setPeriod('periodB', range)}
        />

        <div className="analysis-form__submit">
          <button type="submit" className="btn btn--primary analysis-form__button" aria-busy={isRunning || undefined}>
            {isRunning ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
      </div>

      <div className="analysis-form__footer">
        <div className="chip-row" role="group" aria-labelledby="presets-label">
          <span id="presets-label" className="chip-row__label">
            Quick compare
          </span>
          {COMPARISON_PRESETS.map((preset) => {
            const ranges = presetRanges(preset.days, today);
            const active =
              ranges.periodA.start === values.periodA.start &&
              ranges.periodA.end === values.periodA.end &&
              ranges.periodB.start === values.periodB.start &&
              ranges.periodB.end === values.periodB.end;
            return (
              <button
                key={preset.id}
                type="button"
                className="chip"
                aria-pressed={active}
                onClick={() => onChange({ ...values, ...ranges })}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        {demoChannels.length > 0 && (
          <div className="chip-row" role="group" aria-labelledby="demo-channels-label">
            <span id="demo-channels-label" className="chip-row__label">
              Demo channels
            </span>
            {demoChannels.map((channel) => (
              <button
                key={channel}
                type="button"
                className="chip"
                aria-pressed={values.channel.trim().toLowerCase() === channel}
                onClick={() => onChange({ ...values, channel })}
              >
                {channel}
              </button>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}

interface DateRangeFieldsetProps {
  period: PeriodId;
  range: DateRange;
  errors: FormErrors;
  today: string;
  onChange: (range: DateRange) => void;
}

function DateRangeFieldset({ period, range, errors, today, onChange }: DateRangeFieldsetProps) {
  const key = `period${period}` as const;
  const startError = errors[`${key}.start`];
  const endError = errors[`${key}.end`];
  const groupError = errors[key];
  const groupErrorId = `${key}-error`;

  const describedBy = (fieldErrorId: string | null) =>
    [fieldErrorId, groupError ? groupErrorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <fieldset className="field date-range" aria-describedby={groupError ? groupErrorId : undefined}>
      <legend className="field__label date-range__legend">
        <span className={`swatch swatch--${period}`} aria-hidden="true" />
        Period {period}
      </legend>
      <div className="date-range__inputs">
        <div className="date-range__input">
          <label className="date-range__sub" htmlFor={`${key}-start`}>
            From
          </label>
          <input
            id={`${key}-start`}
            className="input"
            type="date"
            value={range.start}
            min={EARLIEST_DATE}
            max={today}
            aria-invalid={startError || groupError ? true : undefined}
            aria-describedby={describedBy(startError ? `${key}-start-error` : null)}
            onChange={(e) => onChange({ ...range, start: e.target.value })}
          />
          {startError && (
            <p id={`${key}-start-error`} className="field__error">
              {startError}
            </p>
          )}
        </div>
        <div className="date-range__input">
          <label className="date-range__sub" htmlFor={`${key}-end`}>
            To
          </label>
          <input
            id={`${key}-end`}
            className="input"
            type="date"
            value={range.end}
            min={EARLIEST_DATE}
            max={today}
            aria-invalid={endError || groupError ? true : undefined}
            aria-describedby={describedBy(endError ? `${key}-end-error` : null)}
            onChange={(e) => onChange({ ...range, end: e.target.value })}
          />
          {endError && (
            <p id={`${key}-end-error`} className="field__error">
              {endError}
            </p>
          )}
        </div>
      </div>
      {groupError && (
        <p id={groupErrorId} className="field__error">
          {groupError}
        </p>
      )}
    </fieldset>
  );
}
