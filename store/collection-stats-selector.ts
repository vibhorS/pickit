"use client";

import { useMemo } from "react";
import { getMutualMatchMovies } from "@/lib/match-engine";
import { getPartnerVotesForCollection } from "@/lib/mock-partner-votes";
import { collectionService } from "@/lib/services/collection-service";
import {
  movieService,
  type CollectionMovie,
} from "@/lib/services/movie-service";
import type { Collection, Movie, MovieVote } from "@/lib/types";
import { CURRENT_USER } from "@/lib/users";
import {
  EMPTY_CREATED_COLLECTIONS,
  EMPTY_LOCAL_ITEMS,
  mergeCollectionItems,
  useLocalCollectionStore,
} from "@/store/local-collection-store";
import { useVoteStore } from "@/store/vote-store";

export type CollectionReadinessState =
  | "empty"
  | "needs-my-ratings"
  | "waiting-for-partner"
  | "ready";

export type CollectionStats = {
  totalMovies: number;
  myRated: number;
  partnerRated: number;
  unratedMine: number;
  unratedPartner: number;
  mutualMatches: number;
  completionPercent: number;
  readinessState: CollectionReadinessState;
  readinessLabel: string;
  readinessEmoji: string;
  items: CollectionMovie[];
  movies: Movie[];
  mutualMatchMovies: Movie[];
};

type CollectionStatsInput = {
  votes: MovieVote[];
  byCollection: Record<string, CollectionMovie[]>;
  createdCollections: Collection[];
};

function getReadiness(
  totalMovies: number,
  unratedMine: number,
  unratedPartner: number,
): Pick<
  CollectionStats,
  "readinessState" | "readinessLabel" | "readinessEmoji"
> {
  if (totalMovies === 0) {
    return {
      readinessState: "empty",
      readinessLabel: "No Movies Yet",
      readinessEmoji: "⚪",
    };
  }

  if (unratedMine > 0) {
    return {
      readinessState: "needs-my-ratings",
      readinessLabel: "Needs More Ratings",
      readinessEmoji: "🟡",
    };
  }

  if (unratedPartner > 0) {
    return {
      readinessState: "waiting-for-partner",
      readinessLabel: "Waiting for partner",
      readinessEmoji: "🟡",
    };
  }

  return {
    readinessState: "ready",
    readinessLabel: "Ready for Movie Night",
    readinessEmoji: "🟢",
  };
}

function deriveCollectionStats(
  collectionId: string,
  input: CollectionStatsInput,
): CollectionStats {
  const collection =
    collectionService.getById(collectionId) ??
    input.createdCollections.find((entry) => entry.id === collectionId);
  const seedItems = collection
    ? movieService.getCollectionMovies(collection.items)
    : EMPTY_LOCAL_ITEMS;
  const localItems =
    input.byCollection[collectionId] ?? EMPTY_LOCAL_ITEMS;
  const items = mergeCollectionItems(seedItems, localItems);
  const movies = items.map((item) => item.movie);
  const movieIds = new Set(movies.map((movie) => movie.id));
  const myVotes = input.votes.filter(
    (vote) =>
      vote.collectionId === collectionId &&
      vote.userId === CURRENT_USER.id &&
      movieIds.has(vote.movieId),
  );
  const partnerVotes = getPartnerVotesForCollection(collectionId).filter(
    (vote) => movieIds.has(vote.movieId),
  );
  const myRatedIds = new Set(myVotes.map((vote) => vote.movieId));
  const partnerRatedIds = new Set(
    partnerVotes.map((vote) => vote.movieId),
  );
  const totalMovies = movies.length;
  const myRated = myRatedIds.size;
  const partnerRated = partnerRatedIds.size;
  const unratedMine = Math.max(totalMovies - myRated, 0);
  const unratedPartner = Math.max(totalMovies - partnerRated, 0);
  const ratedByBoth = movies.filter(
    (movie) =>
      myRatedIds.has(movie.id) && partnerRatedIds.has(movie.id),
  ).length;
  const mutualMatchMovies = getMutualMatchMovies(
    movies,
    myVotes,
    partnerVotes,
  );
  const completionPercent =
    totalMovies === 0
      ? 0
      : Math.round((ratedByBoth / totalMovies) * 100);

  return {
    totalMovies,
    myRated,
    partnerRated,
    unratedMine,
    unratedPartner,
    mutualMatches: mutualMatchMovies.length,
    completionPercent,
    ...getReadiness(totalMovies, unratedMine, unratedPartner),
    items,
    movies,
    mutualMatchMovies,
  };
}

/** Non-reactive selector for callbacks and service code. */
export function getCollectionStats(collectionId: string): CollectionStats {
  const localState = useLocalCollectionStore.getState();
  return deriveCollectionStats(collectionId, {
    votes: useVoteStore.getState().votes,
    byCollection: localState.byCollection,
    createdCollections:
      localState.createdCollections ?? EMPTY_CREATED_COLLECTIONS,
  });
}

/** Reactive selector for screens; updates immediately when movies or votes change. */
export function useCollectionStats(
  collectionId: string,
): CollectionStats {
  const stats = useCollectionStatsList([collectionId]);
  return stats[0];
}

/** Reactive bulk selector for collection pickers and summaries. */
export function useCollectionStatsList(
  collectionIds: string[],
): CollectionStats[] {
  const votes = useVoteStore((state) => state.votes);
  const byCollection = useLocalCollectionStore(
    (state) => state.byCollection,
  );
  const createdCollections = useLocalCollectionStore(
    (state) => state.createdCollections,
  );
  const collectionKey = collectionIds.join("\u001f");

  return useMemo(
    () =>
      collectionKey
        .split("\u001f")
        .filter(Boolean)
        .map((collectionId) =>
          deriveCollectionStats(collectionId, {
            votes,
            byCollection,
            createdCollections:
              createdCollections ?? EMPTY_CREATED_COLLECTIONS,
          }),
        ),
    [collectionKey, votes, byCollection, createdCollections],
  );
}
