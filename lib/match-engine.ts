import type { Movie, MovieVote } from "@/lib/types";

export function getLikedMovieIds(votes: MovieVote[]): string[] {
  return votes
    .filter((vote) => vote.vote === "like")
    .map((vote) => vote.movieId);
}

/**
 * Movies both users marked as I'd Watch.
 * Votes are expected to already be scoped to the same collection.
 */
export function getMutualMatchMovies(
  movies: Movie[],
  userVotes: MovieVote[],
  partnerVotes: MovieVote[],
): Movie[] {
  const userLikes = new Set(getLikedMovieIds(userVotes));
  const partnerLikes = new Set(getLikedMovieIds(partnerVotes));

  return movies.filter(
    (movie) => userLikes.has(movie.id) && partnerLikes.has(movie.id),
  );
}

export function getCompletionPercent(rated: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((rated / total) * 100);
}
