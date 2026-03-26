import ExampleNumberField from './ui/number-field-1';

export default function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder = '',
  className = '',
  suffix = '',
  size = 'md',
  label = 'Numeric value',
  disabled = false,
}) {
  return (
    <div className={`ni-wrap ${className}`.trim()}>
      <ExampleNumberField
        label={label}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={value ?? null}
        placeholder={placeholder}
        onValueChange={onChange}
        compact
        showScrubArea={false}
        size={size}
      />
      {suffix ? <span className="ni-suffix">{suffix}</span> : null}
    </div>
  );
}
