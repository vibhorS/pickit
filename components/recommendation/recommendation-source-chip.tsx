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
  const Icon = getSourceIcon(type);

  function handleClick(event: MouseEvent) {
    event.stopPropagation();
    // TODO: Open the original recommendation source (deep-link / modal).
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Recommendation source: ${label}`}
      className="inline-flex max-w-full items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-[0.625rem] font-medium text-netflix-muted/75 transition-colors duration-200 hover:bg-white/[0.07] hover:text-netflix-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-netflix-red"
    >
      <Icon aria-hidden="true" className="size-3 shrink-0 opacity-80" strokeWidth={2} />
      <span className="truncate">{label}</span>
    </button>
  );
}
