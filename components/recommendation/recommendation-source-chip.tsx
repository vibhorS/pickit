"use client";

import type { MouseEvent } from "react";
import { getSourceIcon } from "@/lib/recommendation-source";

type RecommendationSourceChipProps = {
  type: string;
  label: string;
};

export function RecommendationSourceChip({
  type,
  label,
}: RecommendationSourceChipProps) {
  function handleClick(event: MouseEvent) {
    event.stopPropagation();
    // TODO: Open the original recommendation source (deep-link / modal).
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Recommendation source: ${label}`}
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.6875rem] font-medium text-netflix-muted transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white/80"
    >
      <span aria-hidden="true" className="shrink-0">
        {getSourceIcon(type)}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}
