import type { MovieVote, VoteValue } from "@/lib/types";

/**
 * Votes are scoped to (collectionId, movieId, userId).
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

export function isMovieRated(
  movieId: string,
  votes: MovieVote[],
): boolean {
  return votes.some((vote) => vote.movieId === movieId);
}

export function createMovieVote(
  collectionId: string,
  movieId: string,
  vote: VoteValue,
  userId: string,
): MovieVote {
  return {
    collectionId,
    movieId,
    userId,
    vote,
    votedAt: new Date(),
  };
}

export function votesForUser(
  votes: MovieVote[],
  userId: string,
  collectionId?: string,
): MovieVote[] {
  return votes.filter(
    (vote) =>
      vote.userId === userId &&
      (collectionId === undefined || vote.collectionId === collectionId),
  );
}
