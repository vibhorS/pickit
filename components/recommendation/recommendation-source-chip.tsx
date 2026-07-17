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
      className="inline-flex max-w-full items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-[0.625rem] font-medium text-netflix-muted/75 transition-colors duration-200 hover:bg-white/[0.07] hover:text-netflix-muted"
    >
      <span aria-hidden="true" className="shrink-0 text-[0.6875rem]">
        {getSourceIcon(type)}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}
