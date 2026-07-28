import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const FIELD_CLASS =
  "w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-netflix-red/70 focus:ring-2 focus:ring-netflix-red/40 disabled:opacity-50";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string | null;
};

export function Input({
  label,
  hint,
  error,
  id,
  className = "",
  ...props
}: InputProps) {
  const inputId = id ?? props.name;
  return (
    <label className="block">
      {label && (
        <span className="text-xs font-medium text-netflix-muted">{label}</span>
      )}
      <input
        id={inputId}
        className={`${FIELD_CLASS} ${label ? "mt-1.5" : ""} ${error ? "border-red-400/60" : ""} ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
        }
        {...props}
      />
      {hint && !error && (
        <span
          id={`${inputId}-hint`}
          className="mt-1.5 block text-xs text-netflix-muted"
        >
          {hint}
        </span>
      )}
      {error && (
        <span
          id={`${inputId}-error`}
          role="alert"
          className="mt-1.5 block text-xs text-red-300"
        >
          {error}
        </span>
      )}
    </label>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string | null;
};

export function Textarea({
  label,
  error,
  id,
  className = "",
  ...props
}: TextareaProps) {
  const inputId = id ?? props.name;
  return (
    <label className="block">
      {label && (
        <span className="text-xs font-medium text-netflix-muted">{label}</span>
      )}
      <textarea
        id={inputId}
        className={`${FIELD_CLASS} min-h-28 resize-y ${label ? "mt-1.5" : ""} ${error ? "border-red-400/60" : ""} ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error && (
        <span role="alert" className="mt-1.5 block text-xs text-red-300">
          {error}
        </span>
      )}
    </label>
  );
}
