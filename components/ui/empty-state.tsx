type EmptyStateProps = {
  emoji: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};

export function EmptyState({
  emoji,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-netflix-surface px-6 py-14 text-center shadow-[0_8px_30px_rgba(0,0,0,0.45)] sm:px-10 sm:py-16">
      <div
        aria-hidden="true"
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-3xl"
      >
        {emoji}
      </div>
      <h3 className="mt-5 text-xl font-bold tracking-tight text-white sm:text-2xl">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-netflix-muted sm:text-base">
        {description}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-7 rounded-xl bg-netflix-red px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-netflix-red-hover"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
