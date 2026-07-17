import type { Movie, MovieVote, VoteValue } from "@/lib/types";

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

/** Compact glyph for dual vote pairs on cards: ❤️ / ❌ / — */
export function getVoteGlyph(vote: VoteValue | undefined): string {
  if (vote === "like") return "❤️";
  if (vote === "pass") return "❌";
  return "—";
}

/**
 * Movies still missing a rating from you or your partner.
 * Disagreements are settled — they do not count as waiting.
 */
export function countStillWaiting(
  movieIds: string[],
  userVotes: MovieVote[],
  partnerVotes: MovieVote[],
): number {
  const userRated = new Set(userVotes.map((vote) => vote.movieId));
  const partnerRated = new Set(partnerVotes.map((vote) => vote.movieId));

  return movieIds.filter(
    (id) => !userRated.has(id) || !partnerRated.has(id),
  ).length;
}

/**
 * Mock partner presence status for shared decisions demos.
 * Connected when partner has rated every movie; otherwise waiting.
 */
export function getPartnerRatingStatus(
  totalMovies: number,
  partnerRated: number,
): "connected" | "waiting" {
  if (totalMovies > 0 && partnerRated >= totalMovies) {
    return "connected";
  }
  return "waiting";
}
