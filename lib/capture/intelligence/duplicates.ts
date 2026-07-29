import type { CollectionMovie } from "@/lib/services/movie-service";
import type { Collection } from "@/lib/types";

export type DuplicateHit = {
  collectionId: string;
  collectionName: string;
  emoji?: string;
};

/**
 * Find which collections already hold this movie — helpful, never naggy.
 */
export function findDuplicateCollections(
  movieId: string,
  collections: Collection[],
  byCollection: Record<string, CollectionMovie[]>,
): DuplicateHit[] {
  if (!movieId) return [];
  const hits: DuplicateHit[] = [];
  for (const collection of collections) {
    const items = byCollection[collection.id] ?? [];
    if (items.some((item) => item.movie.id === movieId)) {
      hits.push({
        collectionId: collection.id,
        collectionName: collection.name,
        emoji: collection.emoji,
      });
    }
  }
  return hits;
}

export type DuplicateAction = "skip" | "keep" | "merge-metadata";
