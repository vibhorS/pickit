import { TMDB_SEARCH_SOURCE } from "@/lib/recommendation-source";
import type {
  Collection,
  RecommendationMetadata,
  RecommendationSource,
} from "@/lib/types";

const friendSource: RecommendationSource = {
  type: "friend",
  label: "Friend",
};

const letterboxdSource: RecommendationSource = {
  type: "letterboxd",
  label: "Letterboxd",
};

const redditSource: RecommendationSource = {
  type: "reddit",
  label: "Reddit",
};

function seedContext(
  sourcePlatform: string,
  savedAt: string,
  recommendedBy?: string,
  notes?: string,
): RecommendationMetadata {
  return {
    sourcePlatform,
    savedAt,
    recommendedBy,
    notes,
    captureMethod: "seed",
  };
}

export const collections: Collection[] = [
  {
    id: "date-night",
    name: "Date Night",
    emoji: "💕",
    description: "Movies we've saved for our next movie night.",
    shared: true,
    items: [
      {
        movieId: "la-la-land",
        source: TMDB_SEARCH_SOURCE,
        metadata: seedContext(
          "Instagram",
          "2026-06-28T12:00:00.000Z",
          undefined,
          "Save this for our next proper date night.",
        ),
      },
      {
        movieId: "about-time",
        source: friendSource,
        metadata: seedContext(
          "Friend",
          "2026-03-12T12:00:00.000Z",
          "Rahul",
          "His favourite romantic movie.",
        ),
      },
      {
        movieId: "palm-springs",
        source: letterboxdSource,
        metadata: seedContext(
          "Letterboxd",
          "2026-05-04T12:00:00.000Z",
          undefined,
          "Everyone says the less you know, the better.",
        ),
      },
      {
        movieId: "the-proposal",
        source: TMDB_SEARCH_SOURCE,
        metadata: seedContext("Netflix", "2026-07-18T12:00:00.000Z"),
      },
    ],
  },
  {
    id: "sci-fi",
    name: "Sci-Fi",
    emoji: "🚀",
    description: "Mind-bending worlds, big ideas, and late-night rabbit holes.",
    shared: false,
    items: [
      {
        movieId: "arrival",
        source: TMDB_SEARCH_SOURCE,
        metadata: seedContext(
          "YouTube",
          "2025-11-09T12:00:00.000Z",
          undefined,
          "Watch before the next Denis Villeneuve film.",
        ),
      },
      {
        movieId: "ex-machina",
        source: redditSource,
        metadata: seedContext(
          "Reddit",
          "2026-01-22T12:00:00.000Z",
          undefined,
          "The discussion about the ending sold me.",
        ),
      },
      {
        movieId: "everything-everywhere",
        source: friendSource,
        metadata: seedContext(
          "Friend",
          "2026-04-15T12:00:00.000Z",
          "Neha",
        ),
      },
      {
        movieId: "spider-verse",
        source: letterboxdSource,
        metadata: seedContext("Letterboxd", "2026-06-02T12:00:00.000Z"),
      },
    ],
  },
  {
    id: "comfort-movies",
    name: "Comfort Movies",
    emoji: "🛋️",
    description: "Feel-good titles for rainy evenings and rewatch Sundays.",
    shared: true,
    items: [
      {
        movieId: "paddington-2",
        source: TMDB_SEARCH_SOURCE,
        metadata: seedContext(
          "IMDb",
          "2025-08-20T12:00:00.000Z",
          undefined,
          "Apparently impossible to dislike.",
        ),
      },
      {
        movieId: "chef",
        source: friendSource,
        metadata: seedContext(
          "Friend",
          "2026-02-14T12:00:00.000Z",
          "Mum",
        ),
      },
      {
        movieId: "sing-street",
        source: letterboxdSource,
        metadata: seedContext("Letterboxd", "2026-03-30T12:00:00.000Z"),
      },
      {
        movieId: "zootopia",
        source: TMDB_SEARCH_SOURCE,
        metadata: seedContext("Netflix", "2026-07-10T12:00:00.000Z"),
      },
      {
        movieId: "crazy-rich-asians",
        source: redditSource,
        metadata: seedContext(
          "Reddit",
          "2026-06-19T12:00:00.000Z",
          undefined,
          "Perfect rainy-evening rewatch.",
        ),
      },
    ],
  },
];
