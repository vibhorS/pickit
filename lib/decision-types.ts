import type { Collection, Movie } from "@/lib/types";

export type DecisionCollectionCard = {
  collection: Collection;
  movies: Movie[];
  movieCount: number;
};
