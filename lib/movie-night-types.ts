import type { Collection } from "@/lib/types";
import type { CollectionMovie } from "@/lib/services/movie-service";

export type MovieNightCollectionCard = {
  collection: Collection;
  items: CollectionMovie[];
  movieCount: number;
};
