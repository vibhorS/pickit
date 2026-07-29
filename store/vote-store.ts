import { create } from "zustand";
import { persist } from "zustand/middleware";
import { developmentSeedRatings } from "@/lib/development-seed-ratings";
import { createMovieVote } from "@/lib/vote-status";
import {
  isLegacyUserId,
  remapUserId,
} from "@/lib/identity/canonical-user-id";
import type { MovieVote, VoteValue } from "@/lib/types";
import { useCollaborationStore } from "@/store/collaboration-store";

type VoteStore = {
  votes: MovieVote[];
  voteMovie: (
    collectionId: string,
    movieId: string,
    vote: VoteValue,
    userId?: string,
  ) => void;
  getVote: (
    collectionId: string,
    movieId: string,
    userId?: string,
  ) => MovieVote | undefined;
  clearVotes: (userId?: string) => void;
  replaceVotes: (votes: MovieVote[]) => void;
  mergeVotes: (cloudVotes: MovieVote[]) => void;
};

function resolveCanonicalOwnerId(): string {
  return useCollaborationStore.getState().activeUserId;
}

function reviveVotes(votes: MovieVote[]): MovieVote[] {
  const ownerId = resolveCanonicalOwnerId();
  return votes
    .map((vote) => {
      const raw = vote.userId ?? "you";
      const remapped = ownerId
        ? remapUserId(raw, ownerId, null)
        : isLegacyUserId(raw) || raw === "you" || raw === "partner"
          ? null
          : raw;
      if (!remapped) return null;
      return {
        ...vote,
        userId: remapped,
        votedAt: new Date(vote.votedAt),
      };
    })
    .filter((vote): vote is MovieVote => vote != null);
}

function mergeRatings(ratings: MovieVote[]): MovieVote[] {
  const byKey = new Map<string, MovieVote>();
  for (const rating of ratings) {
    byKey.set(
      `${rating.collectionId}\u001f${rating.movieId}\u001f${rating.userId}`,
      rating,
    );
  }
  return [...byKey.values()];
}

export const useVoteStore = create<VoteStore>()(
  persist(
    (set, get) => ({
      votes: developmentSeedRatings,

      voteMovie: (collectionId, movieId, vote, userId) => {
        const collaboration = useCollaborationStore.getState();
        const ratingUserId = userId ?? collaboration.activeUserId;
        const collectionMemberships =
          collaboration.memberships.filter(
            (membership) =>
              membership.collectionId === collectionId,
          );
        if (collectionMemberships.length === 0) {
          if (ratingUserId !== collaboration.activeUserId) return;
          collaboration.ensureOwner(collectionId);
        } else if (
          !collectionMemberships.some(
            (membership) =>
              membership.userId === ratingUserId,
          )
        ) {
          return;
        }
        set((state) => {
          const nextVote = createMovieVote(
            collectionId,
            movieId,
            vote,
            ratingUserId,
          );

          return {
            votes: [
              ...state.votes.filter(
                (item) =>
                  item.collectionId !== collectionId ||
                  item.movieId !== movieId ||
                  item.userId !== ratingUserId,
              ),
              nextVote,
            ],
          };
        });
        useCollaborationStore.getState().recordActivity({
          collectionId,
          movieId,
          userId: ratingUserId,
          type: "movie-rated",
        });
        void import("@/lib/observability/analytics").then(({ analytics }) => {
          analytics.track("movie_rated", {
            collectionId,
            movieId,
            vote,
          });
        });
        void import("@/lib/supabase/client").then(({ isSupabaseConfigured }) => {
          if (!isSupabaseConfigured()) return;
          const now = new Date().toISOString();
          const rating = {
            listId: collectionId,
            movieId,
            userId: ratingUserId,
            vote,
            votedAt: now,
            createdBy: ratingUserId,
            updatedBy: ratingUserId,
            createdAt: now,
            updatedAt: now,
            deletedAt: null as string | null,
          };
          void import("@/lib/sync/cloud-sync-engine").then(
            ({ cloudSyncEngine }) => {
              void cloudSyncEngine.enqueue({
                entityType: "rating",
                entityId: `${collectionId}:${movieId}:${ratingUserId}`,
                operation: "upsert",
                payload: rating,
              });
            },
          );
          if (navigator.onLine) {
            void import("@/lib/repositories/cloud").then(
              ({ getCloudRepositories }) => {
                void getCloudRepositories().ratings.upsert(rating);
              },
            );
          }
          void import("@/store/crew-store").then(({ useCrewStore }) => {
            const crew = useCrewStore.getState().crew;
            if (!crew) return;
            void import("@/lib/services/crew/crew-service").then(
              async ({ crewService }) => {
                await crewService.recordActivity({
                  crewId: crew.id,
                  userId: ratingUserId,
                  type: "movie-rated",
                  listId: collectionId,
                  movieId,
                  summary: `Rated a movie ${vote === "like" ? "❤️" : ""}`.trim(),
                });
                await crewService.setPresence(
                  ratingUserId,
                  "rating",
                  crew.id,
                  collectionId,
                );
                const others = useCrewStore
                  .getState()
                  .otherMembers(ratingUserId);
                const repos = await import("@/lib/repositories/cloud").then(
                  (m) => m.getCloudRepositories(),
                );
                for (const member of others) {
                  await repos.crew.notify({
                    userId: member.userId,
                    crewId: crew.id,
                    listId: collectionId,
                    type: "movie-rated",
                    message: "A Crew member rated a movie.",
                  });
                }
              },
            );
          });
        });
        void import("@/lib/events/bus").then(({ createEventId, domainEventBus }) => {
          domainEventBus.publish({
            id: createEventId(),
            type: "movie.rated",
            occurredAt: new Date().toISOString(),
            actorUserId: ratingUserId,
            collectionId,
            payload: { movieId, vote },
          });
        });
        void import("@/lib/sync/sync-engine").then(({ syncEngine }) => {
          const now = new Date().toISOString();
          void syncEngine.optimisticMutate(
            async () => {
              const { getRepositories } = await import(
                "@/lib/repositories/index"
              );
              await getRepositories().ratings.upsert({
                collectionId,
                movieId,
                userId: ratingUserId,
                vote,
                votedAt: new Date(),
                createdBy: ratingUserId,
                updatedBy: ratingUserId,
                createdAt: now,
                updatedAt: now,
                deletedAt: null,
              });
            },
            {
              entityType: "rating",
              entityId: `${collectionId}:${movieId}:${ratingUserId}`,
              operation: "upsert",
              payload: { collectionId, movieId, userId: ratingUserId, vote },
            },
          );
        });
      },

      getVote: (collectionId, movieId, userId) => {
        const ratingUserId =
          userId ?? useCollaborationStore.getState().activeUserId;
        return get().votes.find(
          (vote) =>
            vote.collectionId === collectionId &&
            vote.movieId === movieId &&
            vote.userId === ratingUserId,
        );
      },

      clearVotes: (userId) => {
        const targetUserId =
          userId ?? useCollaborationStore.getState().activeUserId;
        set((state) => ({
          votes: state.votes.filter(
            (vote) => vote.userId !== targetUserId,
          ),
        }));
      },
      replaceVotes: (votes) =>
        set({ votes: reviveVotes(votes) }),
      mergeVotes: (cloudVotes: MovieVote[]) => {
        set((state) => {
          const byKey = new Map<string, MovieVote>();
          for (const vote of state.votes) {
            byKey.set(
              `${vote.collectionId}\u001f${vote.movieId}\u001f${vote.userId}`,
              vote,
            );
          }
          for (const vote of reviveVotes(cloudVotes)) {
            const key = `${vote.collectionId}\u001f${vote.movieId}\u001f${vote.userId}`;
            const existing = byKey.get(key);
            if (!existing || new Date(vote.votedAt).getTime() >= new Date(existing.votedAt).getTime()) {
              byKey.set(key, vote);
            }
          }
          return { votes: [...byKey.values()] };
        });
      },
    }),
    {
      name: "decision-votes",
      version: 1,
      partialize: (state) => ({ votes: state.votes }),
      migrate: (persisted, version) => {
        const data = (persisted ?? {}) as Partial<VoteStore>;
        const revived = reviveVotes(data.votes ?? []);
        if (version >= 1) return { votes: revived };

        const collaboratorSeeds = developmentSeedRatings.filter(
          (rating) => !isLegacyUserId(rating.userId),
        );
        return {
          votes: mergeRatings([...collaboratorSeeds, ...revived]),
        };
      },
      merge: (persisted, current) => {
        const data = (persisted ?? {}) as Partial<VoteStore>;
        return {
          ...current,
          votes: reviveVotes(data.votes ?? current.votes),
        };
      },
    },
  ),
);
