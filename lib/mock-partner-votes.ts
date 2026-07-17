import { PARTNER_USER } from "@/lib/users";
import type { MovieVote } from "@/lib/types";

/**
 * Mock partner votes for shared collections.
 * Replace with real partner sync later — shape already matches MovieVote.
 */
export const mockPartnerVotes: MovieVote[] = [
  // Date Night
  {
    collectionId: "date-night",
    movieId: "la-la-land",
    userId: PARTNER_USER.id,
    vote: "like",
    votedAt: new Date("2026-01-10"),
  },
  {
    collectionId: "date-night",
    movieId: "about-time",
    userId: PARTNER_USER.id,
    vote: "like",
    votedAt: new Date("2026-01-10"),
  },
  // palm-springs intentionally unrated by partner → "Waiting for ratings"
  {
    collectionId: "date-night",
    movieId: "the-proposal",
    userId: PARTNER_USER.id,
    vote: "like",
    votedAt: new Date("2026-01-10"),
  },
  // Comfort Movies
  {
    collectionId: "comfort-movies",
    movieId: "paddington-2",
    userId: PARTNER_USER.id,
    vote: "like",
    votedAt: new Date("2026-01-12"),
  },
  {
    collectionId: "comfort-movies",
    movieId: "chef",
    userId: PARTNER_USER.id,
    vote: "like",
    votedAt: new Date("2026-01-12"),
  },
  {
    collectionId: "comfort-movies",
    movieId: "sing-street",
    userId: PARTNER_USER.id,
    vote: "pass",
    votedAt: new Date("2026-01-12"),
  },
  {
    collectionId: "comfort-movies",
    movieId: "zootopia",
    userId: PARTNER_USER.id,
    vote: "like",
    votedAt: new Date("2026-01-12"),
  },
  {
    collectionId: "comfort-movies",
    movieId: "crazy-rich-asians",
    userId: PARTNER_USER.id,
    vote: "like",
    votedAt: new Date("2026-01-12"),
  },
  // Sci-Fi (partner likes a subset for demo)
  {
    collectionId: "sci-fi",
    movieId: "arrival",
    userId: PARTNER_USER.id,
    vote: "like",
    votedAt: new Date("2026-01-14"),
  },
  {
    collectionId: "sci-fi",
    movieId: "ex-machina",
    userId: PARTNER_USER.id,
    vote: "pass",
    votedAt: new Date("2026-01-14"),
  },
  {
    collectionId: "sci-fi",
    movieId: "everything-everywhere",
    userId: PARTNER_USER.id,
    vote: "like",
    votedAt: new Date("2026-01-14"),
  },
  {
    collectionId: "sci-fi",
    movieId: "spider-verse",
    userId: PARTNER_USER.id,
    vote: "like",
    votedAt: new Date("2026-01-14"),
  },
];

export function getPartnerVotesForCollection(
  collectionId: string,
): MovieVote[] {
  return mockPartnerVotes.filter(
    (vote) => vote.collectionId === collectionId,
  );
}
