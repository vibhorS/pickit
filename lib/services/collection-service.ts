/**
 * Mock seed collection catalog (date-night, sci-fi, …).
 *
 * Production cloud mode never merges these into the UI catalog
 * (see resolveCollectionCatalog). Demo / local-offline only.
 */
import { collections } from "@/lib/mock-collections";
import type { Collection } from "@/lib/types";

export const collectionService = {
  getAll(): Collection[] {
    return collections;
  },

  getById(id: string): Collection | undefined {
    return collections.find((collection) => collection.id === id);
  },

  getMovieIds(collection: Collection): string[] {
    return collection.items.map((item) => item.movieId);
  },
};
