import { createElement } from "react";
import { CalendarDays, FileText, UserRound } from "lucide-react";
import {
  formatRelativeSavedDate,
  formatWaitingTime,
  sourceFromMetadata,
} from "@/lib/recommendation-metadata";
import { getSourceIcon } from "@/lib/recommendation-source";
import type {
  RecommendationMetadata,
  RecommendationSource,
} from "@/lib/types";

type RecommendationContextProps = {
  metadata?: RecommendationMetadata;
  source: RecommendationSource;
  variant?: "compact" | "detail" | "movie-night";
  className?: string;
};

export function RecommendationContext({
  metadata,
  source,
  variant = "compact",
  className = "",
}: RecommendationContextProps) {
  const displaySource = sourceFromMetadata(metadata, source);
  const savedLabel = formatRelativeSavedDate(metadata?.savedAt);
  const waitingLabel = formatWaitingTime(metadata?.savedAt);
  const sourceHref = /^https?:\/\//i.test(metadata?.sourceUrl ?? "")
    ? metadata?.sourceUrl
    : undefined;
  const sourceIcon = createElement(getSourceIcon(displaySource.type), {
    className: variant === "compact" ? "size-3" : "size-4",
    strokeWidth: 2,
    "aria-hidden": true,
  });
  const hasContext =
    Boolean(displaySource.label) ||
    Boolean(metadata?.recommendedBy) ||
    Boolean(metadata?.notes) ||
    Boolean(savedLabel);

  if (!hasContext) return null;

  if (variant === "detail") {
    return (
      <section className={`rounded-2xl bg-white/[0.035] px-5 py-5 ${className}`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
          Recommendation
        </h2>
        <div className="mt-4 space-y-3 text-sm text-netflix-muted">
          {metadata?.recommendedBy && (
            <p className="flex items-center gap-2">
              <UserRound className="size-4 shrink-0" strokeWidth={1.8} />
              Recommended by{" "}
              <span className="font-medium text-white">
                {metadata.recommendedBy}
              </span>
            </p>
          )}
          <p className="flex items-center gap-2">
            {sourceIcon}
            Saved from{" "}
            {sourceHref ? (
              <a
                href={sourceHref}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-white underline decoration-white/25 underline-offset-4 transition hover:decoration-white/70"
              >
                {displaySource.label}
              </a>
            ) : (
              <span className="font-medium text-white">
                {displaySource.label}
              </span>
            )}
          </p>
          {savedLabel && (
            <p className="flex items-center gap-2">
              <CalendarDays className="size-4 shrink-0" strokeWidth={1.8} />
              {savedLabel}
            </p>
          )}
          {metadata?.notes && (
            <div className="flex items-start gap-2 pt-1">
              <FileText className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-netflix-muted/70">
                  Original Note
                </p>
                <blockquote className="mt-1 text-sm leading-relaxed text-white/90">
                  “{metadata.notes}”
                </blockquote>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  if (variant === "movie-night") {
    return (
      <div className={`space-y-1.5 text-xs text-netflix-muted ${className}`}>
        <p className="flex items-center gap-1.5">
          {sourceIcon}
          Saved from {displaySource.label}
        </p>
        {metadata?.recommendedBy && (
          <p className="flex items-center gap-1.5">
            <UserRound className="size-3.5" strokeWidth={1.8} />
            Recommended by {metadata.recommendedBy}
          </p>
        )}
        {waitingLabel && (
          <p className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" strokeWidth={1.8} />
            {waitingLabel}
          </p>
        )}
        {metadata?.notes && (
          <p className="line-clamp-2 flex items-start gap-1.5 text-white/75">
            <FileText className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.8} />
            “{metadata.notes}”
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-1 text-[0.6875rem] leading-snug text-netflix-muted/75 ${className}`}>
      <p className="flex min-w-0 items-center gap-1">
        {sourceIcon}
        <span className="truncate">{displaySource.label}</span>
        {savedLabel && (
          <>
            <span aria-hidden="true">•</span>
            <span className="shrink-0">
              {savedLabel.replace(/^Saved /, "")}
            </span>
          </>
        )}
      </p>
      {metadata?.recommendedBy && (
        <p className="flex items-center gap-1">
          <UserRound className="size-3 shrink-0" strokeWidth={1.8} />
          <span className="truncate">{metadata.recommendedBy}</span>
        </p>
      )}
      {metadata?.notes && (
        <p className="line-clamp-2 flex items-start gap-1 text-white/65">
          <FileText className="mt-0.5 size-3 shrink-0" strokeWidth={1.8} />
          “{metadata.notes}”
        </p>
      )}
    </div>
  );
}
