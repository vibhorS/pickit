"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Collection } from "@/lib/types";
import { MOTION } from "@/lib/motion";
import { useCollectionStats } from "@/store/collection-stats-selector";

type CollectionCardProps = {
  collection: Collection;
};

export function CollectionCard({ collection }: CollectionCardProps) {
  const stats = useCollectionStats(collection.id);
  const movieCount = stats.totalMovies;
  const movieLabel = movieCount === 1 ? "1 movie" : `${movieCount} movies`;

  return (
    <Link
      href={`/collection/${collection.id}`}
      prefetch
      aria-label={`Open ${collection.name}, ${movieLabel}`}
      className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-netflix-red"
    >
      <motion.article
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.99 }}
        transition={{ duration: MOTION.duration, ease: MOTION.ease }}
        className="group flex w-full flex-col gap-4 rounded-2xl bg-netflix-surface p-5 shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-elevated)] sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-2xl transition-colors duration-200 group-hover:bg-white/[0.07]"
            >
              {collection.emoji}
            </span>
            <div className="min-w-0 text-left">
              <h2 className="truncate text-lg font-semibold tracking-tight text-white sm:text-xl">
                {collection.name}
              </h2>
              <p className="mt-0.5 text-sm text-netflix-muted">{movieLabel}</p>
            </div>
          </div>

          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium tracking-wide ${
              collection.shared
                ? "bg-netflix-red/15 text-netflix-red"
                : "bg-white/[0.05] text-netflix-muted"
            }`}
          >
            {collection.shared ? "Shared" : "Private"}
          </span>
        </div>

        <div className="border-t border-white/5 pt-4">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium text-white">
              <span aria-hidden="true">{stats.readinessEmoji}</span>
              {stats.readinessLabel}
            </span>
            <span className="font-semibold text-netflix-muted">
              {stats.completionPercent}% complete
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-netflix-red transition-[width] duration-300"
              style={{ width: `${stats.completionPercent}%` }}
            />
          </div>
        </div>
      </motion.article>
    </Link>
  );
}
