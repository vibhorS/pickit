"use client";

import { motion } from "framer-motion";
import { PosterImage } from "@/components/ui/poster-image";
import { MOTION } from "@/lib/motion";
import type { Collection } from "@/lib/types";
import type { CollectionStats } from "@/store/collection-stats-selector";

type CollectionPickerCardProps = {
  collection: Collection;
  movieCount: number;
  posterUrls: string[];
  stats: CollectionStats;
  onSelect: () => void;
  disabled?: boolean;
};

function readinessCopy(stats: CollectionStats): string {
  if (stats.readinessState === "ready") return "🍿 Ready";
  if (stats.readinessState === "waiting-for-you") {
    return "⭐ Waiting for You";
  }
  if (stats.readinessState === "waiting-for-members") {
    const name = stats.waitingMemberNames[0];
    return name ? `⏳ Waiting for ${name}` : "⏳ Waiting for a member";
  }
  if (stats.readinessState === "no-mutual-matches") {
    return "🚫 No Matches Yet";
  }
  return "＋ Add Recommendations";
}

export function CollectionPickerCard({
  collection,
  movieCount,
  posterUrls,
  stats,
  onSelect,
  disabled = false,
}: CollectionPickerCardProps) {
  const movieLabel = movieCount === 1 ? "1 movie" : `${movieCount} movies`;

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -3 }}
      whileTap={disabled ? undefined : { scale: 0.99 }}
      transition={{ duration: MOTION.duration, ease: MOTION.ease }}
      className="group relative min-h-64 w-full overflow-hidden rounded-3xl bg-netflix-surface text-left shadow-[var(--shadow-card)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-netflix-red disabled:cursor-wait disabled:opacity-70"
    >
      {posterUrls.length > 0 && (
        <div
          aria-hidden="true"
          className="absolute inset-0 grid grid-cols-3 opacity-80 transition duration-500 group-hover:scale-[1.025] group-hover:opacity-100 sm:grid-cols-6"
        >
          {posterUrls.slice(0, 9).map((posterUrl, index) => (
            <div
              key={`${posterUrl}-${index}`}
              className="min-h-32 overflow-hidden"
            >
              <PosterImage src={posterUrl} alt="" />
            </div>
          ))}
        </div>
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(0deg,rgba(10,10,10,0.98)_0%,rgba(10,10,10,0.68)_48%,rgba(10,10,10,0.08)_100%)]"
      />

      <div className="relative z-10 flex min-h-64 flex-col justify-end p-6 sm:p-8">
        <div className="flex items-end justify-between gap-5">
          <div className="min-w-0">
            <span aria-hidden="true" className="text-3xl">
              {collection.emoji}
            </span>
            <h2 className="mt-2 truncate text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {collection.name}
            </h2>
            <p className="mt-2 text-sm font-medium text-white/75">
              <span className="capitalize">{movieLabel}</span>
              <span aria-hidden="true"> · </span>
              {readinessCopy(stats)}
            </p>
          </div>
          <span
            aria-hidden="true"
            className="mb-1 text-2xl text-white/60 transition group-hover:translate-x-1 group-hover:text-white"
          >
            →
          </span>
        </div>
      </div>
    </motion.button>
  );
}
