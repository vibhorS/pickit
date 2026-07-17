import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createMovieVote } from "@/lib/vote-status";
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
    votedAt: new Date(vote.votedAt),
  }));
}

export const useVoteStore = create<VoteStore>()(
  persist(
    (set, get) => ({
      votes: [],

      voteMovie: (collectionId, movieId, vote) =>
        set((state) => {
          const nextVote = createMovieVote(collectionId, movieId, vote);

          return {
            votes: [
              ...state.votes.filter(
                (item) =>
                  item.collectionId !== collectionId ||
                  item.movieId !== movieId,
              ),
              nextVote,
            ],
          };
        }),

      getVote: (collectionId, movieId) =>
        get().votes.find(
          (vote) =>
            vote.collectionId === collectionId && vote.movieId === movieId,
        ),

      clearVotes: () => set({ votes: [] }),
    }),
    {
      name: "decision-votes",
      partialize: (state) => ({ votes: state.votes }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.votes = reviveVotes(state.votes);
      },
    },
  ),
);
