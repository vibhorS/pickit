import { CURRENT_USER } from "@/lib/users";
import type { MovieVote } from "@/lib/types";

/**
 * Seed likes that overlap mock partner votes so Decision Mode
 * can be demoed without rating first. Real user votes replace these
 * once the store hydrates with persisted data.
 */
export const mockUserSeedVotes: MovieVote[] = [
  {
    collectionId: "date-night",
    movieId: "la-la-land",
    userId: CURRENT_USER.id,
    vote: "like",
    votedAt: new Date("2026-01-08"),
  },
  {
    collectionId: "date-night",
    movieId: "about-time",
    userId: CURRENT_USER.id,
    vote: "like",
    votedAt: new Date("2026-01-08"),
  },
  {
    collectionId: "date-night",
    movieId: "the-proposal",
    userId: CURRENT_USER.id,
    vote: "like",
    votedAt: new Date("2026-01-08"),
  },
  {
    collectionId: "comfort-movies",
    movieId: "paddington-2",
    userId: CURRENT_USER.id,
    vote: "like",
    votedAt: new Date("2026-01-09"),
  },
  {
    collectionId: "comfort-movies",
    movieId: "chef",
    userId: CURRENT_USER.id,
    vote: "like",
    votedAt: new Date("2026-01-09"),
  },
  {
    collectionId: "sci-fi",
    movieId: "arrival",
    userId: CURRENT_USER.id,
    vote: "like",
    votedAt: new Date("2026-01-11"),
  },
  {
    collectionId: "sci-fi",
    movieId: "everything-everywhere",
    userId: CURRENT_USER.id,
    vote: "like",
    votedAt: new Date("2026-01-11"),
  },
];
