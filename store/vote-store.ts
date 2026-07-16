import { create } from "zustand";
import type { MovieVote, VoteValue } from "@/lib/types";

type VoteStore = {
  votes: MovieVote[];
  voteMovie: (movieId: string, vote: VoteValue) => void;
  getVote: (movieId: string) => MovieVote | undefined;
  clearVotes: () => void;
};

export const useVoteStore = create<VoteStore>((set, get) => ({
  votes: [],

  voteMovie: (movieId, vote) =>
    set((state) => {
      const nextVote: MovieVote = {
        movieId,
        vote,
        votedAt: new Date(),
      };

      return {
        votes: [
          ...state.votes.filter((item) => item.movieId !== movieId),
          nextVote,
        ],
      };
    }),

  getVote: (movieId) => get().votes.find((vote) => vote.movieId === movieId),

  clearVotes: () => set({ votes: [] }),
}));
