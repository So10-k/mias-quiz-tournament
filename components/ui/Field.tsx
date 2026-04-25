import { type InputHTMLAttributes, type ReactNode } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
};

export function Field({ label, hint, id, className = "", ...rest }: Props) {
  const inputId = id ?? `f-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        className="font-display text-body-lead text-ink"
      >
        {label}
      </label>
      <input
        id={inputId}
        {...rest}
        className={
          "w-full px-3 py-2 bg-paper border border-ink rounded-sm font-input text-body text-ink " +
          "outline-none focus:border-accent-red focus:ring-0 " +
          className
        }
      />
      {hint ? (
        <p className="font-hand text-caption-md text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}
