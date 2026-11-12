import { useId } from 'react';
import './components.css';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Hide the group label visually (it is still announced). */
  hideLabel?: boolean;
}

/**
 * Single-choice toggle built from native radio inputs, so arrow-key navigation
 * and screen-reader semantics come for free.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  hideLabel = true,
}: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <fieldset className="segmented">
      <legend className={hideLabel ? 'visually-hidden' : 'segmented__legend'}>{label}</legend>
      <div className="segmented__track">
        {options.map((option) => (
          <label key={option.value} className="segmented__option">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
