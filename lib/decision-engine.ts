/**
 * Session helpers for the existing Decision Mode V1 demo flow.
 * Prefer MovieVote + useVoteStore for the async local rating architecture.
 */
import type { Movie } from "@/lib/types";

export type DecisionUser = "A" | "B";

export type DecisionPhase = "voting" | "pass-phone" | "matches";

export function getLikedMovies(movies: Movie[], likedIds: string[]): Movie[] {
  const likedSet = new Set(likedIds);
  return movies.filter((movie) => likedSet.has(movie.id));
}

export function getMutualMatches(
  movies: Movie[],
  userALikes: string[],
  userBLikes: string[],
): Movie[] {
  const userBSet = new Set(userBLikes);
  return movies.filter(
    (movie) => userALikes.includes(movie.id) && userBSet.has(movie.id),
  );
}
