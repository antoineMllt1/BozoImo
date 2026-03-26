import * as React from 'react';
import { NumberField } from '@base-ui/react/number-field';
import { ArrowLeftRight, Minus, Plus } from 'lucide-react';

type NumberFieldStep = number | 'any';
type NumberFieldSize = 'xs' | 'sm' | 'md';

export interface NumberField1Props {
  id?: string;
  label?: string;
  name?: string;
  value?: number | null;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: NumberFieldStep;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  size?: NumberFieldSize;
  compact?: boolean;
  showScrubArea?: boolean;
  onValueChange?: (value: number | null) => void;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function ExampleNumberField({
  id: providedId,
  label = 'Amount',
  name,
  value,
  defaultValue = 100,
  min,
  max,
  step = 1,
  disabled = false,
  placeholder,
  className,
  size = 'md',
  compact = false,
  showScrubArea = true,
  onValueChange,
}: NumberField1Props) {
  const generatedId = React.useId();
  const id = providedId ?? generatedId;
  const displayLabel = showScrubArea && !compact;

  return (
    <NumberField.Root
      id={id}
      name={name}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      value={value}
      defaultValue={value === undefined ? defaultValue : undefined}
      onValueChange={onValueChange}
      className={cx('nf1', compact && 'nf1-compact', `nf1-${size}`, className)}
    >
      {displayLabel ? (
        <NumberField.ScrubArea className="nf1-scrub">
          <label htmlFor={id} className="nf1-label">
            {label}
          </label>
          <NumberField.ScrubAreaCursor className="nf1-cursor">
            <ArrowLeftRight className="nf1-cursor-icon" strokeWidth={2.1} />
          </NumberField.ScrubAreaCursor>
        </NumberField.ScrubArea>
      ) : null}

      <NumberField.Group className="nf1-group">
        <NumberField.Decrement className="nf1-btn nf1-btn-dec" aria-label={`Diminuer ${label}`}>
          <Minus className="nf1-btn-icon" strokeWidth={2.2} />
        </NumberField.Decrement>

        <NumberField.Input
          aria-label={label}
          placeholder={placeholder}
          className="nf1-input"
        />

        <NumberField.Increment className="nf1-btn nf1-btn-inc" aria-label={`Augmenter ${label}`}>
          <Plus className="nf1-btn-icon" strokeWidth={2.2} />
        </NumberField.Increment>
      </NumberField.Group>
    </NumberField.Root>
  );
}
