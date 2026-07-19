"use client";

import { motion } from "framer-motion";
import { MOTION } from "@/lib/motion";
import type { Collection } from "@/lib/types";
import type {
  CollectionReadinessState,
  CollectionStats,
} from "@/store/collection-stats-selector";

type CollectionPickerCardProps = {
  collection: Collection;
  movieCount: number;
  stats: CollectionStats;
  onSelect: () => void;
};

function CompletionRing({ percent }: { percent: number }) {
  const size = 44;
  const stroke = 3.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-label={`${percent}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-netflix-red transition-[stroke-dashoffset] duration-300"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[0.625rem] font-semibold text-white">
        {percent}%
      </span>
    </div>
  );
}

function readinessStyles(level: CollectionReadinessState) {
  if (level === "ready") {
    return "bg-emerald-500/15 text-emerald-300";
  }
  if (
    level === "needs-my-ratings" ||
    level === "waiting-for-partner"
  ) {
    return "bg-amber-500/15 text-amber-200";
  }
  return "bg-white/[0.05] text-netflix-muted";
}

export function CollectionPickerCard({
  collection,
  movieCount,
  stats,
  onSelect,
}: CollectionPickerCardProps) {
  const movieLabel = movieCount === 1 ? "1 movie" : `${movieCount} movies`;
  const matchLabel =
    stats.mutualMatches === 1
      ? "1 mutual match"
      : `${stats.mutualMatches} mutual matches`;

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: MOTION.duration, ease: MOTION.ease }}
      className="w-full rounded-2xl bg-netflix-surface p-5 text-left shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-elevated)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-netflix-red sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/[0.04] text-3xl sm:h-16 sm:w-16 sm:text-4xl"
          >
            {collection.emoji}
          </span>
          <div className="min-w-0 space-y-1.5 pt-0.5">
            <h2 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
              {collection.name}
            </h2>
            <p className="text-sm text-netflix-muted">{movieLabel}</p>
            <p className="text-sm font-medium text-rose-200/85">{matchLabel}</p>
          </div>
        </div>

        <CompletionRing percent={stats.completionPercent} />
      </div>

      <p
        className={`mt-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${readinessStyles(stats.readinessState)}`}
      >
        <span aria-hidden="true">{stats.readinessEmoji}</span>
        {stats.readinessLabel}
      </p>
    </motion.button>
  );
}
