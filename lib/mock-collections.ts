import type { Collection } from "@/lib/types";

export const collections: Collection[] = [
  {
    id: "date-night",
    name: "Date Night",
    emoji: "💕",
    shared: true,
    movieIds: ["la-la-land", "about-time", "palm-springs", "the-proposal"],
  },
  {
    id: "sci-fi",
    name: "Sci-Fi",
    emoji: "🚀",
    shared: false,
    movieIds: [
      "arrival",
      "ex-machina",
      "everything-everywhere",
      "spider-verse",
    ],
  },
  {
    id: "comfort-movies",
    name: "Comfort Movies",
    emoji: "🛋️",
    shared: true,
    movieIds: [
      "paddington-2",
      "chef",
      "sing-street",
      "zootopia",
      "crazy-rich-asians",
    ],
  },
];
