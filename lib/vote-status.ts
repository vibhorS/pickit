import type { MovieVote, VoteValue } from "@/lib/types";

/**
 * Local votes are attached to movies by movieId.
 * Partner/match states can layer on later once multi-user votes exist.
 */

export type LocalVoteState = "not-rated" | "like" | "pass";

export function getLocalVoteState(
  vote: MovieVote | undefined,
): LocalVoteState {
  if (!vote) return "not-rated";
  return vote.vote;
}

export function countRatedMovies(
  movieIds: string[],
  votes: MovieVote[],
): number {
  const ratedIds = new Set(votes.map((vote) => vote.movieId));
  return movieIds.filter((id) => ratedIds.has(id)).length;
}

export function createMovieVote(
  movieId: string,
  vote: VoteValue,
): MovieVote {
  return {
    movieId,
    vote,
    votedAt: new Date(),
  };
}
