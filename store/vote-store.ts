import { create } from "zustand";
import { persist } from "zustand/middleware";
import { mockUserSeedVotes } from "@/lib/mock-user-votes";
import { createMovieVote } from "@/lib/vote-status";
import { CURRENT_USER } from "@/lib/users";
import type { MovieVote, VoteValue } from "@/lib/types";

type VoteStore = {
  votes: MovieVote[];
  voteMovie: (
    collectionId: string,
    movieId: string,
    vote: VoteValue,
  ) => void;
  getVote: (
    collectionId: string,
    movieId: string,
  ) => MovieVote | undefined;
  clearVotes: () => void;
};

function reviveVotes(votes: MovieVote[]): MovieVote[] {
  return votes.map((vote) => ({
    ...vote,
    userId: vote.userId ?? CURRENT_USER.id,
    votedAt: new Date(vote.votedAt),
  }));
}

export const useVoteStore = create<VoteStore>()(
  persist(
    (set, get) => ({
      votes: mockUserSeedVotes,

      voteMovie: (collectionId, movieId, vote) =>
        set((state) => {
          const nextVote = createMovieVote(
            collectionId,
            movieId,
            vote,
            CURRENT_USER.id,
          );

          return {
            votes: [
              ...state.votes.filter(
                (item) =>
                  item.collectionId !== collectionId ||
                  item.movieId !== movieId ||
                  item.userId !== CURRENT_USER.id,
              ),
              nextVote,
            ],
          };
        }),

      getVote: (collectionId, movieId) =>
        get().votes.find(
          (vote) =>
            vote.collectionId === collectionId &&
            vote.movieId === movieId &&
            vote.userId === CURRENT_USER.id,
        ),

      clearVotes: () => set({ votes: [] }),
    }),
    {
      name: "decision-votes",
      partialize: (state) => ({ votes: state.votes }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const revived = reviveVotes(state.votes);
        // Fresh installs with an empty persisted bag get demo seed votes.
        state.votes =
          revived.length === 0 ? reviveVotes(mockUserSeedVotes) : revived;
      },
    },
  ),
);
