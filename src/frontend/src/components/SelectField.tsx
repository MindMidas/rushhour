import { useEffect, useId, useRef, useState } from "react";

export type SelectOption<Value extends string> = readonly [Value, string];

interface Props<Value extends string> {
  label?: string;
  ariaLabel?: string;
  value: Value;
  options: SelectOption<Value>[];
  onChange: (value: Value) => void;
  disabled?: boolean;
  className?: string;
}

export function SelectField<Value extends string>({ label, ariaLabel, value, options, onChange, disabled = false, className = "" }: Props<Value>) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find(([optionValue]) => optionValue === value)?.[1] ?? value;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div className={`select-field ${className}`.trim()} ref={rootRef}>
      {label ? <label className="select-label" htmlFor={listboxId} id={`${listboxId}-label`}>{label}</label> : null}
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label ? undefined : ariaLabel}
        aria-labelledby={label ? `${listboxId}-label` : undefined}
        className="select-trigger"
        disabled={disabled}
        id={listboxId}
        onClick={() => setOpen(current => !current)}
        type="button"
      >
        <span className="select-trigger-label">{selectedLabel}</span>
        <span aria-hidden className="select-chevron">
          <svg viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          </svg>
        </span>
      </button>
      {open && !disabled && (
        <ul aria-labelledby={label ? `${listboxId}-label` : undefined} className="select-menu" role="listbox">
          {options.map(([optionValue, optionLabel]) => (
            <li key={optionValue} role="none">
              <button
                aria-selected={optionValue === value}
                className={optionValue === value ? "active" : ""}
                onClick={() => {
                  onChange(optionValue);
                  setOpen(false);
                }}
                role="option"
                type="button"
              >
                {optionLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
