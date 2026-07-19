import { create } from "zustand";
import { persist } from "zustand/middleware";
import { withSavedTimestamp } from "@/lib/recommendation-metadata";
import { TMDB_SEARCH_SOURCE } from "@/lib/recommendation-source";
import type { CollectionMovie } from "@/lib/services/movie-service";
import type {
  Collection,
  Movie,
  RecommendationMetadata,
  RecommendationSource,
} from "@/lib/types";

/** Stable empty snapshot — never return a fresh [] from a Zustand selector. */
export const EMPTY_LOCAL_ITEMS: CollectionMovie[] = [];
export const EMPTY_CAPTURES: CaptureEvent[] = [];
export const EMPTY_CREATED_COLLECTIONS: Collection[] = [];

export type CaptureEvent = {
  id: string;
  movie: Movie;
  collectionIds: string[];
  source: RecommendationSource;
  metadata?: RecommendationMetadata;
  capturedAt: string;
};

type LocalCollectionStore = {
  /** Movies added via TMDb search — keyed by collectionId. */
  byCollection: Record<string, CollectionMovie[]>;
  /** User-created collections (merged with seed collections in UI). */
  createdCollections: Collection[];
  /** Capture inbox history (newest first). */
  captures: CaptureEvent[];
  addMovie: (
    collectionId: string,
    movie: Movie,
    source?: RecommendationSource,
    metadata?: RecommendationMetadata,
  ) => boolean;
  addMovieToCollections: (
    collectionIds: string[],
    movie: Movie,
    source?: RecommendationSource,
    metadata?: RecommendationMetadata,
  ) => { added: string[]; already: string[] };
  createCollection: (name: string, emoji?: string) => Collection;
  getItems: (collectionId: string) => CollectionMovie[];
  getItem: (
    collectionId: string,
    movieId: string,
  ) => CollectionMovie | undefined;
};

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useLocalCollectionStore = create<LocalCollectionStore>()(
  persist(
    (set, get) => ({
      byCollection: {},
      createdCollections: EMPTY_CREATED_COLLECTIONS,
      captures: EMPTY_CAPTURES,

      addMovie: (
        collectionId,
        movie,
        source = TMDB_SEARCH_SOURCE,
        metadata,
      ) => {
        const result = get().addMovieToCollections(
          [collectionId],
          movie,
          source,
          metadata,
        );
        return result.added.length > 0;
      },

      addMovieToCollections: (
        collectionIds,
        movie,
        source = TMDB_SEARCH_SOURCE,
        metadata,
      ) => {
        const uniqueIds = Array.from(new Set(collectionIds.filter(Boolean)));
        const added: string[] = [];
        const already: string[] = [];

        if (!movie?.id || uniqueIds.length === 0) {
          return { added, already };
        }
        const recommendationMetadata = withSavedTimestamp(
          metadata,
          source,
        );

        set((state) => {
          const byCollection = { ...state.byCollection };

          for (const collectionId of uniqueIds) {
            const existing = byCollection[collectionId] ?? EMPTY_LOCAL_ITEMS;
            if (existing.some((item) => item.movie.id === movie.id)) {
              already.push(collectionId);
              continue;
            }

            byCollection[collectionId] = [
              ...existing,
              { movie, source, metadata: recommendationMetadata },
            ];
            added.push(collectionId);
          }

          if (added.length === 0) {
            return { byCollection };
          }

          const event: CaptureEvent = {
            id: newId("capture"),
            movie,
            collectionIds: added,
            source,
            metadata: recommendationMetadata,
            capturedAt: new Date().toISOString(),
          };

          return {
            byCollection,
            captures: [event, ...state.captures].slice(0, 40),
          };
        });

        return { added, already };
      },

      createCollection: (name, emoji = "🎬") => {
        const trimmed = name.trim();
        const collection: Collection = {
          id: newId("collection"),
          name: trimmed || "Untitled",
          emoji: emoji.trim() || "🎬",
          description: "Created from Capture",
          shared: true,
          items: [],
        };

        set((state) => ({
          createdCollections: [collection, ...state.createdCollections],
        }));

        return collection;
      },

      getItems: (collectionId) => {
        if (!collectionId) return EMPTY_LOCAL_ITEMS;
        return get().byCollection[collectionId] ?? EMPTY_LOCAL_ITEMS;
      },

      getItem: (collectionId, movieId) => {
        if (!collectionId || !movieId) return undefined;
        return get()
          .getItems(collectionId)
          .find((item) => item.movie.id === movieId);
      },
    }),
    {
      name: "decision-local-collections",
      partialize: (state) => ({
        byCollection: state.byCollection,
        createdCollections: state.createdCollections,
        captures: state.captures,
      }),
      merge: (persisted, current) => {
        const data = (persisted ?? {}) as Partial<LocalCollectionStore>;
        return {
          ...current,
          ...data,
          byCollection: data.byCollection ?? current.byCollection,
          createdCollections:
            data.createdCollections ?? current.createdCollections,
          captures: data.captures ?? current.captures,
        };
      },
    },
  ),
);

/** Merge server seed items with locally added movies (local wins on id clash). */
export function mergeCollectionItems(
  serverItems: CollectionMovie[],
  localItems: CollectionMovie[],
): CollectionMovie[] {
  const byId = new Map<string, CollectionMovie>();

  for (const item of serverItems) {
    byId.set(item.movie.id, item);
  }
  for (const item of localItems) {
    byId.set(item.movie.id, item);
  }

  return Array.from(byId.values());
}

/** Seed collections first, then user-created (no duplicates). */
export function mergeCollections(
  seed: Collection[],
  created: Collection[],
): Collection[] {
  const byId = new Map<string, Collection>();
  for (const collection of seed) {
    byId.set(collection.id, collection);
  }
  for (const collection of created) {
    byId.set(collection.id, collection);
  }
  return Array.from(byId.values());
}
