import { create } from "zustand";
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

export const useVoteStore = create<VoteStore>((set, get) => ({
  votes: [],

  voteMovie: (collectionId, movieId, vote) =>
    set((state) => {
      const nextVote = createMovieVote(collectionId, movieId, vote);

      return {
        votes: [
          ...state.votes.filter(
            (item) =>
              item.collectionId !== collectionId || item.movieId !== movieId,
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
}));
