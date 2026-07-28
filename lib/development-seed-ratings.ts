import {
  DEFAULT_COLLABORATOR,
  DEFAULT_OWNER,
} from "@/lib/users";
import type { Rating } from "@/lib/types";

/**
 * Local-development ratings for both real user identities.
 * They enter the same persisted rating store as all interactive ratings.
 */
export const developmentSeedRatings: Rating[] = [
  {
    collectionId: "date-night",
    movieId: "la-la-land",
    userId: DEFAULT_OWNER.id,
    vote: "like",
    votedAt: new Date("2026-01-08"),
  },
  {
    collectionId: "date-night",
    movieId: "about-time",
    userId: DEFAULT_OWNER.id,
    vote: "like",
    votedAt: new Date("2026-01-08"),
  },
  {
    collectionId: "date-night",
    movieId: "the-proposal",
    userId: DEFAULT_OWNER.id,
    vote: "like",
    votedAt: new Date("2026-01-08"),
  },
  {
    collectionId: "comfort-movies",
    movieId: "paddington-2",
    userId: DEFAULT_OWNER.id,
    vote: "like",
    votedAt: new Date("2026-01-09"),
  },
  {
    collectionId: "comfort-movies",
    movieId: "chef",
    userId: DEFAULT_OWNER.id,
    vote: "like",
    votedAt: new Date("2026-01-09"),
  },
  {
    collectionId: "sci-fi",
    movieId: "arrival",
    userId: DEFAULT_OWNER.id,
    vote: "like",
    votedAt: new Date("2026-01-11"),
  },
  {
    collectionId: "sci-fi",
    movieId: "everything-everywhere",
    userId: DEFAULT_OWNER.id,
    vote: "like",
    votedAt: new Date("2026-01-11"),
  },
  {
    collectionId: "date-night",
    movieId: "la-la-land",
    userId: DEFAULT_COLLABORATOR.id,
    vote: "like",
    votedAt: new Date("2026-01-10"),
  },
  {
    collectionId: "date-night",
    movieId: "about-time",
    userId: DEFAULT_COLLABORATOR.id,
    vote: "like",
    votedAt: new Date("2026-01-10"),
  },
  {
    collectionId: "date-night",
    movieId: "the-proposal",
    userId: DEFAULT_COLLABORATOR.id,
    vote: "like",
    votedAt: new Date("2026-01-10"),
  },
  {
    collectionId: "comfort-movies",
    movieId: "paddington-2",
    userId: DEFAULT_COLLABORATOR.id,
    vote: "like",
    votedAt: new Date("2026-01-12"),
  },
  {
    collectionId: "comfort-movies",
    movieId: "chef",
    userId: DEFAULT_COLLABORATOR.id,
    vote: "like",
    votedAt: new Date("2026-01-12"),
  },
  {
    collectionId: "comfort-movies",
    movieId: "sing-street",
    userId: DEFAULT_COLLABORATOR.id,
    vote: "pass",
    votedAt: new Date("2026-01-12"),
  },
  {
    collectionId: "comfort-movies",
    movieId: "zootopia",
    userId: DEFAULT_COLLABORATOR.id,
    vote: "like",
    votedAt: new Date("2026-01-12"),
  },
  {
    collectionId: "comfort-movies",
    movieId: "crazy-rich-asians",
    userId: DEFAULT_COLLABORATOR.id,
    vote: "like",
    votedAt: new Date("2026-01-12"),
  },
  {
    collectionId: "sci-fi",
    movieId: "arrival",
    userId: DEFAULT_COLLABORATOR.id,
    vote: "like",
    votedAt: new Date("2026-01-14"),
  },
  {
    collectionId: "sci-fi",
    movieId: "ex-machina",
    userId: DEFAULT_COLLABORATOR.id,
    vote: "pass",
    votedAt: new Date("2026-01-14"),
  },
  {
    collectionId: "sci-fi",
    movieId: "everything-everywhere",
    userId: DEFAULT_COLLABORATOR.id,
    vote: "like",
    votedAt: new Date("2026-01-14"),
  },
  {
    collectionId: "sci-fi",
    movieId: "spider-verse",
    userId: DEFAULT_COLLABORATOR.id,
    vote: "like",
    votedAt: new Date("2026-01-14"),
  },
];
