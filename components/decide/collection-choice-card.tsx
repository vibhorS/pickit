"use client";

import type { Collection } from "@/lib/types";
import { PARTNER_USER } from "@/lib/users";
import type { CollectionStats } from "@/store/collection-stats-selector";

type CollectionChoiceCardProps = {
  collection: Collection;
  movieCount: number;
  stats: CollectionStats;
};

export function CollectionChoiceCard({
  collection,
  movieCount,
  stats,
}: CollectionChoiceCardProps) {
  const movieLabel = movieCount === 1 ? "1 movie" : `${movieCount} movies`;
  const matchLabel =
    stats.mutualMatches === 1
      ? "1 mutual match"
      : `${stats.mutualMatches} mutual matches`;
  const isReady = stats.readinessState === "ready";

  return (
    <div className="flex min-h-[28rem] flex-col justify-between px-6 py-8 sm:min-h-[30rem] sm:px-8 sm:py-10">
      <div className="space-y-6">
        <span
          aria-hidden="true"
          className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/[0.04] text-5xl sm:h-24 sm:w-24 sm:text-6xl"
        >
          {collection.emoji}
        </span>

        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {collection.name}
          </h2>
          <p className="text-sm text-netflix-muted sm:text-base">{movieLabel}</p>
        </div>

        <div className="space-y-3">
          <p className="text-lg font-semibold text-rose-200/90">{matchLabel}</p>
          <p
            className={`inline-flex items-center gap-1.5 text-sm font-medium ${
              isReady ? "text-emerald-300/90" : "text-amber-200/85"
            }`}
          >
            <span aria-hidden="true">{stats.readinessEmoji}</span>
            {stats.readinessLabel}
            <span className="font-normal text-netflix-muted/70">
              · {PARTNER_USER.name}
            </span>
          </p>
          <p className="text-sm text-netflix-muted">
            {stats.completionPercent}% shared completion
          </p>
        </div>
      </div>

      {stats.unratedMine > 0 && (
        <p
          role="status"
          className="mt-8 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90"
        >
          ⚠️ {stats.unratedMine}{" "}
          {stats.unratedMine === 1 ? "movie needs" : "movies need"} your rating
        </p>
      )}
    </div>
  );
}
