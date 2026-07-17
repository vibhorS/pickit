"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RateCompletion } from "@/components/rate/rate-completion";
import { RateMovieCard } from "@/components/rate/rate-movie-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { CollectionMovie } from "@/lib/services/movie-service";
import { countRatedMovies, isMovieRated } from "@/lib/vote-status";
import type { Collection, VoteValue } from "@/lib/types";
import { CURRENT_USER } from "@/lib/users";
import { useVoteStore } from "@/store/vote-store";

type RateSessionProps = {
  collection: Collection;
  items: CollectionMovie[];
};

export function RateSession({ collection, items }: RateSessionProps) {
  const [hasHydrated, setHasHydrated] = useState(false);
  const votes = useVoteStore((state) => state.votes);
  const voteMovie = useVoteStore((state) => state.voteMovie);

  useEffect(() => {
    const unsub = useVoteStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    if (useVoteStore.persist.hasHydrated()) {
      setHasHydrated(true);
    }

    return unsub;
  }, []);

  const collectionVotes = votes.filter(
    (vote) =>
      vote.collectionId === collection.id && vote.userId === CURRENT_USER.id,
  );
  const movieIds = items.map((item) => item.movie.id);
  const total = items.length;
  const rated = countRatedMovies(movieIds, collectionVotes);
  const unratedItems = items.filter(
    (item) => !isMovieRated(item.movie.id, collectionVotes),
  );
  const current = unratedItems[0];

  function handleVote(vote: VoteValue) {
    if (!current) return;
    voteMovie(collection.id, current.movie.id, vote);
  }

  if (!hasHydrated) {
    return (
      <div className="mx-auto flex w-full max-w-lg items-center justify-center py-24">
        <p className="text-sm text-netflix-muted">Loading ratings...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link
          href={`/collection/${collection.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-netflix-muted transition-colors hover:text-white"
        >
          <span aria-hidden="true">←</span>
          {collection.name}
        </Link>
        {total > 0 && (
          <p className="text-sm font-semibold text-netflix-muted">
            {rated} of {total} rated
          </p>
        )}
      </div>

      {total === 0 ? (
        <div className="space-y-4">
          <EmptyState
            emoji="🎬"
            title="Nothing to rate"
            description="Add movies to this collection first, then come back to rate them."
          />
          <div className="text-center">
            <Link
              href={`/collection/${collection.id}`}
              className="inline-flex rounded-xl bg-netflix-red px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-netflix-red-hover"
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
        <RateMovieCard
          key={current.movie.id}
          movie={current.movie}
          source={current.source}
          onVote={handleVote}
        />
      )}
    </div>
  );
}
