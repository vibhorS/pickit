"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Film } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RateCompletion } from "@/components/rate/rate-completion";
import { RateMovieCard } from "@/components/rate/rate-movie-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/ui/fade-in";
import { MovieDetailSkeleton } from "@/components/ui/skeleton";
import { MOTION } from "@/lib/motion";
import type { CollectionMovie } from "@/lib/services/movie-service";
import { countRatedMovies, isMovieRated } from "@/lib/vote-status";
import type { Collection, VoteValue } from "@/lib/types";
import { useCollaborationStore } from "@/store/collaboration-store";
import {
  EMPTY_LOCAL_ITEMS,
  EMPTY_REMOVED_MOVIE_IDS,
  mergeCollectionItems,
  useLocalCollectionStore,
} from "@/store/local-collection-store";
import { useVoteStore } from "@/store/vote-store";
import { useSessionStore } from "@/store/session-store";

type RateSessionProps = {
  collection: Collection;
  items: CollectionMovie[];
};

export function RateSession({
  collection,
  items: serverItems,
}: RateSessionProps) {
  const [hasHydrated, setHasHydrated] = useState(false);
  const votes = useVoteStore((state) => state.votes);
  const voteMovie = useVoteStore((state) => state.voteMovie);
  const activeUserId = useCollaborationStore(
    (state) => state.activeUserId,
  );
  const users = useCollaborationStore((state) => state.users);
  const activeUser = users.find(
    (user) => user.id === activeUserId,
  );
  const recordActivity = useCollaborationStore(
    (state) => state.recordActivity,
  );
  const setCurrentSession = useSessionStore(
    (state) => state.setCurrentSession,
  );
  const clearCurrentSession = useSessionStore(
    (state) => state.clearCurrentSession,
  );
  const localItems = useLocalCollectionStore(
    (state) => state.byCollection[collection.id] ?? EMPTY_LOCAL_ITEMS,
  );
  const removedMovieIds = useLocalCollectionStore(
    (state) =>
      state.collectionOverrides[collection.id]?.removedMovieIds ??
        EMPTY_REMOVED_MOVIE_IDS,
  );
  const items = useMemo(
    () =>
      mergeCollectionItems(
        serverItems,
        localItems,
        removedMovieIds,
      ),
    [serverItems, localItems, removedMovieIds],
  );

  useEffect(() => {
    const finish = () => setHasHydrated(true);
    const unsubVotes = useVoteStore.persist.onFinishHydration(finish);
    const unsubLocal =
      useLocalCollectionStore.persist.onFinishHydration(finish);
    const unsubCollaboration =
      useCollaborationStore.persist.onFinishHydration(finish);

    if (
      useVoteStore.persist.hasHydrated() &&
      useLocalCollectionStore.persist.hasHydrated() &&
      useCollaborationStore.persist.hasHydrated()
    ) {
      queueMicrotask(finish);
    }

    return () => {
      unsubVotes();
      unsubLocal();
      unsubCollaboration();
    };
  }, []);

  const collectionVotes = votes.filter(
    (vote) =>
      vote.collectionId === collection.id &&
      vote.userId === activeUserId,
  );
  const movieIds = items.map((item) => item.movie.id);
  const total = items.length;
  const rated = countRatedMovies(movieIds, collectionVotes);
  const unratedItems = items.filter(
    (item) => !isMovieRated(item.movie.id, collectionVotes),
  );
  const current = unratedItems[0];
  const progress = total > 0 ? Math.round((rated / total) * 100) : 0;
  useEffect(() => {
    if (!hasHydrated) return;
    if (!current) {
      clearCurrentSession("rating");
      if (total > 0) {
        recordActivity({
          collectionId: collection.id,
          userId: activeUserId,
          type: "ratings-completed",
        });
      }
      return;
    }
    setCurrentSession({
      kind: "rating",
      collectionId: collection.id,
      updatedAt: new Date().toISOString(),
    });
  }, [
    clearCurrentSession,
    collection.id,
    current,
    hasHydrated,
    activeUserId,
    recordActivity,
    setCurrentSession,
    total,
  ]);

  function handleVote(vote: VoteValue) {
    if (!current || !collection.id || !current.movie.id) return;
    voteMovie(collection.id, current.movie.id, vote, activeUserId);
  }

  if (!hasHydrated) {
    return (
      <div className="mx-auto w-full max-w-lg py-8">
        <MovieDetailSkeleton />
      </div>
    );
  }

  return (
    <FadeIn className="mx-auto w-full max-w-lg">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Link
          href={`/collection/${collection.id}`}
          prefetch
          className="btn-ghost -ml-3 inline-flex items-center gap-2"
        >
          <span aria-hidden="true">←</span>
          {collection.name}
        </Link>
        <p className="ml-auto text-xs text-netflix-muted">
          Rating as{" "}
          <span className="font-medium text-white">
            {activeUser?.name ?? "current user"}
          </span>
        </p>
        {total > 0 && (
          <p className="text-sm font-medium text-netflix-muted">
            {rated} of {total} rated
          </p>
        )}
      </div>

      {total > 0 && (
        <div className="mb-6 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full bg-netflix-red"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: MOTION.durationSlow, ease: MOTION.ease }}
          />
        </div>
      )}

      {total === 0 ? (
        <div>
          <EmptyState
            icon={<Film className="size-7" strokeWidth={1.5} />}
            title="Nothing to rate"
            description="Add movies to this list first, then come back to rate them."
          />
          <div className="text-center">
            <Link
              href={`/collection/${collection.id}`}
              prefetch
              className="btn-primary"
            >
              Back to Collection
            </Link>
          </div>
        </div>
      ) : !current ? (
        <RateCompletion
          collectionId={collection.id}
          collectionName={collection.name}
        />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={current.movie.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: MOTION.duration, ease: MOTION.ease }}
          >
            <RateMovieCard
              movie={current.movie}
              source={current.source}
              metadata={current.metadata}
              onVote={handleVote}
            />
          </motion.div>
        </AnimatePresence>
      )}
    </FadeIn>
  );
}
