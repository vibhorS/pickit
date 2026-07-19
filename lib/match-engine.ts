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

/** Compact glyph for dual vote pairs on cards: ❤️ / ❌ / — */
export function getVoteGlyph(vote: VoteValue | undefined): string {
  if (vote === "like") return "❤️";
  if (vote === "pass") return "❌";
  return "—";
}
