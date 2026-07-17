import { TMDB_SEARCH_SOURCE } from "@/lib/recommendation-source";
import type { Collection, RecommendationSource } from "@/lib/types";

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

export const collections: Collection[] = [
  {
    id: "date-night",
    name: "Date Night",
    emoji: "💕",
    shared: true,
    items: [
      { movieId: "la-la-land", source: TMDB_SEARCH_SOURCE },
      { movieId: "about-time", source: friendSource },
      { movieId: "palm-springs", source: letterboxdSource },
      { movieId: "the-proposal", source: TMDB_SEARCH_SOURCE },
    ],
  },
  {
    id: "sci-fi",
    name: "Sci-Fi",
    emoji: "🚀",
    shared: false,
    items: [
      { movieId: "arrival", source: TMDB_SEARCH_SOURCE },
      { movieId: "ex-machina", source: redditSource },
      { movieId: "everything-everywhere", source: friendSource },
      { movieId: "spider-verse", source: letterboxdSource },
    ],
  },
  {
    id: "comfort-movies",
    name: "Comfort Movies",
    emoji: "🛋️",
    shared: true,
    items: [
      { movieId: "paddington-2", source: TMDB_SEARCH_SOURCE },
      { movieId: "chef", source: friendSource },
      { movieId: "sing-street", source: letterboxdSource },
      { movieId: "zootopia", source: TMDB_SEARCH_SOURCE },
      { movieId: "crazy-rich-asians", source: redditSource },
    ],
  },
];
