"use client";

import { useEffect, useMemo } from "react";
import { collectionService } from "@/lib/services/collection-service";
import {
  movieService,
  type CollectionMovie,
} from "@/lib/services/movie-service";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type {
  Collection,
  CollectionMembership,
  Movie,
  MovieVote,
  User,
} from "@/lib/types";
import {
  EMPTY_COLLECTION_OVERRIDES,
  EMPTY_CREATED_COLLECTIONS,
  EMPTY_LOCAL_ITEMS,
  mergeCollectionItems,
  type CollectionOverride,
  useLocalCollectionStore,
} from "@/store/local-collection-store";
import { useCollaborationStore } from "@/store/collaboration-store";
import { useVoteStore } from "@/store/vote-store";

export type CollectionReadinessState =
  | "empty"
  | "waiting-for-you"
  | "waiting-for-members"
  | "no-mutual-matches"
  | "ready";

export type MemberCollectionStats = {
  user: User;
  rated: number;
  unrated: number;
};

export type CollectionStats = {
  totalMovies: number;
  myRated: number;
  unratedMine: number;
  otherMembersRated: number;
  unratedOthers: number;
  mutualMatches: number;
  completionPercent: number;
  readinessState: CollectionReadinessState;
  readinessLabel: string;
  readinessEmoji: string;
  currentUser: User;
  members: User[];
  memberStats: MemberCollectionStats[];
  waitingMemberNames: string[];
  ratings: MovieVote[];
  items: CollectionMovie[];
  movies: Movie[];
  mutualMatchMovies: Movie[];
};

type CollectionStatsInput = {
  votes: MovieVote[];
  byCollection: Record<string, CollectionMovie[]>;
  createdCollections: Collection[];
  collectionOverrides: Record<string, CollectionOverride>;
  users: User[];
  memberships: CollectionMembership[];
  activeUserId: string;
};

function readinessFor(
  totalMovies: number,
  unratedMine: number,
  waitingMembers: MemberCollectionStats[],
  mutualMatches: number,
): Pick<
  CollectionStats,
  "readinessState" | "readinessLabel" | "readinessEmoji"
> {
  if (totalMovies === 0) {
    return {
      readinessState: "empty",
      readinessLabel: "Add Recommendations",
      readinessEmoji: "＋",
    };
  }
  if (unratedMine > 0) {
    return {
      readinessState: "waiting-for-you",
      readinessLabel: "Waiting for You",
      readinessEmoji: "⭐",
    };
  }
  if (waitingMembers.length > 0) {
    const label =
      waitingMembers.length === 1
        ? `Waiting for ${waitingMembers[0].user.name}`
        : `Waiting for ${waitingMembers.length} Members`;
    return {
      readinessState: "waiting-for-members",
      readinessLabel: label,
      readinessEmoji: "⏳",
    };
  }
  if (mutualMatches === 0) {
    return {
      readinessState: "no-mutual-matches",
      readinessLabel: "No Matches Yet",
      readinessEmoji: "🚫",
    };
  }
  return {
    readinessState: "ready",
    readinessLabel: "Ready",
    readinessEmoji: "🍿",
  };
}

function deriveCollectionStats(
  collectionId: string,
  input: CollectionStatsInput,
): CollectionStats {
  const cloudMode = isSupabaseConfigured();
  // Metadata only — never read collection.items for movie rows in cloud mode.
  const baseCollection =
    input.createdCollections.find((entry) => entry.id === collectionId) ??
    (cloudMode ? undefined : collectionService.getById(collectionId));
  const override = input.collectionOverrides[collectionId];
  const collection =
    baseCollection && !override?.deleted
      ? {
          ...baseCollection,
          name: override?.name ?? baseCollection.name,
          emoji: override?.emoji ?? baseCollection.emoji,
        }
      : undefined;

  // Cloud read model: byCollection (hydrated from lists + recommendations + movies).
  // Local/offline only: optionally resolve mock seed items via movieService.
  const seedItems =
    !cloudMode && collection
      ? movieService.getCollectionMovies(collection.items)
      : EMPTY_LOCAL_ITEMS;
  const localItems =
    input.byCollection[collectionId] ?? EMPTY_LOCAL_ITEMS;
  const items = mergeCollectionItems(
    seedItems,
    localItems,
    override?.removedMovieIds,
  );
  const movies = items.map((item) => item.movie);
  const movieIds = new Set(movies.map((movie) => movie.id));
  const memberIds = new Set(
    input.memberships
      .filter((membership) => membership.collectionId === collectionId)
      .map((membership) => membership.userId),
  );
  const activeUser =
    input.users.find((user) => user.id === input.activeUserId) ??
    input.users[0] ?? { id: input.activeUserId, name: "You" };
  const members = input.users.filter((user) => memberIds.has(user.id));
  if (members.length === 0) {
    memberIds.add(activeUser.id);
    members.unshift(activeUser);
  }

  const collectionVotes = input.votes.filter(
    (vote) =>
      vote.collectionId === collectionId &&
      memberIds.has(vote.userId) &&
      movieIds.has(vote.movieId),
  );
  const memberStats = members.map((user) => {
    const rated = new Set(
      collectionVotes
        .filter((vote) => vote.userId === user.id)
        .map((vote) => vote.movieId),
    ).size;
    return {
      user,
      rated,
      unrated: Math.max(movies.length - rated, 0),
    };
  });
  const myStats =
    memberStats.find((entry) => entry.user.id === activeUser.id) ??
    { user: activeUser, rated: 0, unrated: movies.length };
  const otherStats = memberStats.filter(
    (entry) => entry.user.id !== activeUser.id,
  );
  const mutualMatchMovies =
    members.length < 2
      ? []
      : movies.filter((movie) =>
          members.every((member) =>
            collectionVotes.some(
              (vote) =>
                vote.userId === member.id &&
                vote.movieId === movie.id &&
                vote.vote === "like",
            ),
          ),
        );
  const ratingSlots = movies.length * Math.max(members.length, 1);
  const completedSlots = memberStats.reduce(
    (total, member) => total + member.rated,
    0,
  );
  const completionPercent =
    ratingSlots === 0
      ? 0
      : Math.round((completedSlots / ratingSlots) * 100);
  const waitingMembers = otherStats.filter((member) => member.unrated > 0);

  return {
    totalMovies: movies.length,
    myRated: myStats.rated,
    unratedMine: myStats.unrated,
    otherMembersRated: otherStats.reduce(
      (total, member) => total + member.rated,
      0,
    ),
    unratedOthers: otherStats.reduce(
      (total, member) => total + member.unrated,
      0,
    ),
    mutualMatches: mutualMatchMovies.length,
    completionPercent,
    ...readinessFor(
      movies.length,
      myStats.unrated,
      waitingMembers,
      mutualMatchMovies.length,
    ),
    currentUser: activeUser,
    members,
    memberStats,
    waitingMemberNames: waitingMembers.map(
      (member) => member.user.name,
    ),
    ratings: collectionVotes,
    items,
    movies,
    mutualMatchMovies,
  };
}

function snapshotInput(): CollectionStatsInput {
  const local = useLocalCollectionStore.getState();
  const collaboration = useCollaborationStore.getState();
  return {
    votes: useVoteStore.getState().votes,
    byCollection: local.byCollection,
    createdCollections:
      local.createdCollections ?? EMPTY_CREATED_COLLECTIONS,
    collectionOverrides:
      local.collectionOverrides ?? EMPTY_COLLECTION_OVERRIDES,
    users: collaboration.users,
    memberships: collaboration.memberships,
    activeUserId: collaboration.activeUserId,
  };
}

/** Non-reactive selector for callbacks and service code. */
export function getCollectionStats(collectionId: string): CollectionStats {
  return deriveCollectionStats(collectionId, snapshotInput());
}

export function getTonightQueue(
  collectionId: string,
): CollectionMovie[] {
  const stats = getCollectionStats(collectionId);
  const mutualIds = new Set(
    stats.mutualMatchMovies.map((movie) => movie.id),
  );
  return stats.items.filter((item) => mutualIds.has(item.movie.id));
}

/** Reactive selector for screens; updates with movies, members, identity or ratings. */
export function useCollectionStats(
  collectionId: string,
): CollectionStats {
  return useCollectionStatsList([collectionId])[0];
}

/** Reactive bulk selector for collection pickers and summaries. */
export function useCollectionStatsList(
  collectionIds: string[],
): CollectionStats[] {
  const ANIMATED_ID = "collection-80bc5b34-2a3f-4fb2-8be9-036efd0e05e9";
  const votes = useVoteStore((state) => state.votes);
  const byCollection = useLocalCollectionStore(
    (state) => state.byCollection,
  );
  const createdCollections = useLocalCollectionStore(
    (state) => state.createdCollections,
  );
  const collectionOverrides = useLocalCollectionStore(
    (state) => state.collectionOverrides,
  );
  const users = useCollaborationStore((state) => state.users);
  const memberships = useCollaborationStore(
    (state) => state.memberships,
  );
  const activeUserId = useCollaborationStore(
    (state) => state.activeUserId,
  );
  const collectionKey = collectionIds.join("\u001f");

  const stats = useMemo(
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
            collectionOverrides:
              collectionOverrides ?? EMPTY_COLLECTION_OVERRIDES,
            users,
            memberships,
            activeUserId,
          }),
        ),
    [
      activeUserId,
      byCollection,
      collectionKey,
      collectionOverrides,
      createdCollections,
      memberships,
      users,
      votes,
    ],
  );

  // TEMPORARY diagnostics — full structured dump for runtime comparison.
  useEffect(() => {
    if (collectionIds.length === 0) return;
    void import("@/lib/debug/boot-trace").then(({ bootTrace }) => {
      const nameById = Object.fromEntries(
        (createdCollections ?? []).map((c) => [c.id, c.name]),
      );
      const animatedStats = deriveCollectionStats(ANIMATED_ID, {
        votes,
        byCollection,
        createdCollections: createdCollections ?? EMPTY_CREATED_COLLECTIONS,
        collectionOverrides: collectionOverrides ?? EMPTY_COLLECTION_OVERRIDES,
        users,
        memberships,
        activeUserId,
      });
      bootTrace.recordUi({
        stage: "useCollectionStatsList() INPUT+OUTPUT",
        detail: `collectionIds=${JSON.stringify(collectionIds)}`,
        rows: [
          ...collectionIds.map((collectionId, index) => {
            const items = byCollection[collectionId] ?? [];
            const stat = stats[index];
            return {
              "Collection ID": collectionId,
              "Collection name": nameById[collectionId] ?? "(name unknown)",
              "byCollection movie IDs": items.map((item) => item.movie.id),
              "byCollection titles": items.map((item) => item.movie.title),
              "byCollection movie count": items.length,
              "stats.totalMovies": stat?.totalMovies ?? null,
              "stats.movieIds": stat?.movies.map((m) => m.id) ?? [],
              "stats.titles": stat?.movies.map((m) => m.title) ?? [],
              "stats.mutualMatches": stat?.mutualMatches ?? null,
            };
          }),
          {
            "Collection ID": ANIMATED_ID,
            "Collection name": nameById[ANIMATED_ID] ?? "Animated?",
            "in collectionIds input": collectionIds.includes(ANIMATED_ID),
            "byCollection movie IDs": (byCollection[ANIMATED_ID] ?? []).map(
              (item) => item.movie.id,
            ),
            "byCollection titles": (byCollection[ANIMATED_ID] ?? []).map(
              (item) => item.movie.title,
            ),
            "byCollection movie count": (byCollection[ANIMATED_ID] ?? []).length,
            "stats.totalMovies": animatedStats.totalMovies,
            "stats.movieIds": animatedStats.movies.map((m) => m.id),
            "stats.titles": animatedStats.movies.map((m) => m.title),
          },
        ],
      });
    });
  }, [byCollection, collectionIds, createdCollections, stats]);

  return stats;
}
