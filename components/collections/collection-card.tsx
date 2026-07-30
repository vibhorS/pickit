"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Collection } from "@/lib/types";
import { getCollectionSharingState } from "@/lib/collaboration";
import { Badge } from "@/components/ui/badge";
import { MOTION } from "@/lib/motion";
import { useCollaborationStore } from "@/store/collaboration-store";
import { useCollectionStats } from "@/store/collection-stats-selector";
import { useLocalCollectionStore, EMPTY_LOCAL_ITEMS } from "@/store/local-collection-store";

type CollectionCardProps = {
  collection: Collection;
};

export function CollectionCard({ collection }: CollectionCardProps) {
  const stats = useCollectionStats(collection.id);
  const movieCount = stats.totalMovies;
  const movieLabel = movieCount === 1 ? "1 movie" : `${movieCount} movies`;
  const localItems = useLocalCollectionStore(
    (state) => state.byCollection[collection.id] ?? EMPTY_LOCAL_ITEMS,
  );
  const posterUrls = localItems
    .map((item) => item.movie.posterUrl)
    .filter((url) => Boolean(url))
    .slice(0, 3) as string[];
  const memberships = useCollaborationStore(
    (state) => state.memberships,
  );
  const invitations = useCollaborationStore(
    (state) => state.invitations,
  );
  const sharingState = getCollectionSharingState(
    collection.id,
    memberships,
    invitations,
  );
  const sharingLabel =
    sharingState === "connected"
      ? "Connected"
      : sharingState === "invitation-pending"
        ? "Invitation Pending"
        : "Not Shared";

  const sharingTone =
    sharingState === "connected"
      ? "accent"
      : sharingState === "invitation-pending"
        ? "warning"
        : "neutral";

  return (
    <Link
      href={`/collection/${collection.id}`}
      prefetch
      aria-label={`Open ${collection.name}, ${movieLabel}, ${sharingLabel}`}
      className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-netflix-red"
    >
      <motion.article
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.99 }}
        transition={{ duration: MOTION.duration, ease: MOTION.ease }}
        className="group flex w-full flex-col gap-4 rounded-2xl bg-netflix-surface p-4 shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-elevated)]"
      >
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/30">
          <div className="grid h-28 grid-cols-3 gap-1.5 p-1.5">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-md bg-white/[0.06]"
              >
                {posterUrls[index] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={posterUrls[index]}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg text-white/40">
                    {collection.emoji}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 text-left">
            <h2 className="truncate text-lg font-semibold tracking-tight text-white">
              {collection.name}
            </h2>
            <p className="mt-0.5 text-sm text-netflix-muted">{movieLabel}</p>
          </div>
          <Badge tone={sharingTone}>{sharingLabel}</Badge>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-white">
            <span aria-hidden="true">{stats.readinessEmoji}</span>
            {stats.readinessLabel}
          </span>
          <span className="truncate text-netflix-muted">
            {stats.mutualMatches} mutual matches
          </span>
        </div>
      </motion.article>
    </Link>
  );
}
