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
import { useCollaborationStore } from "@/store/collaboration-store";
import { useCrewStore } from "@/store/crew-store";

/** Stable empty snapshot — never return a fresh [] from a Zustand selector. */
export const EMPTY_LOCAL_ITEMS: CollectionMovie[] = [];
export const EMPTY_CAPTURES: CaptureEvent[] = [];
export const EMPTY_CREATED_COLLECTIONS: Collection[] = [];
export const EMPTY_REMOVED_MOVIE_IDS: string[] = [];
export const EMPTY_COLLECTION_OVERRIDES: Record<
  string,
  CollectionOverride
> = {};

export type CollectionOverride = {
  name?: string;
  emoji?: string;
  deleted?: boolean;
  removedMovieIds?: string[];
};

export type CaptureEvent = {
  id: string;
  movie: Movie;
  collectionIds: string[];
  source: RecommendationSource;
  metadata?: RecommendationMetadata;
  capturedAt: string;
  capturedByUserId: string;
};

type LocalCollectionStore = {
  /** Movies added via TMDb search — keyed by collectionId. */
  byCollection: Record<string, CollectionMovie[]>;
  /** User-created collections (merged with seed collections in UI). */
  createdCollections: Collection[];
  collectionOverrides: Record<string, CollectionOverride>;
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
  renameCollection: (
    collectionId: string,
    name: string,
    emoji?: string,
  ) => void;
  deleteCollection: (collectionId: string) => void;
  removeMovie: (collectionId: string, movieId: string) => void;
  getItems: (collectionId: string) => CollectionMovie[];
  getItem: (
    collectionId: string,
    movieId: string,
  ) => CollectionMovie | undefined;
};

function newId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function canEditCollection(collectionId: string): boolean {
  const collaboration = useCollaborationStore.getState();
  return collaboration.memberships.some(
    (membership) =>
      membership.collectionId === collectionId &&
      membership.userId === collaboration.activeUserId,
  );
}

function canDeleteCollection(collectionId: string): boolean {
  const collaboration = useCollaborationStore.getState();
  return collaboration.memberships.some(
    (membership) =>
      membership.collectionId === collectionId &&
      membership.userId === collaboration.activeUserId &&
      membership.role === "owner",
  );
}

export const useLocalCollectionStore = create<LocalCollectionStore>()(
  persist(
    (set, get) => ({
      byCollection: {},
      createdCollections: EMPTY_CREATED_COLLECTIONS,
      collectionOverrides: EMPTY_COLLECTION_OVERRIDES,
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
        const collaboration = useCollaborationStore.getState();

        const afterBoolean = collectionIds.filter(Boolean);
        const afterUnique = Array.from(new Set(afterBoolean));

        const uniqueIds = afterUnique.filter((collectionId) => {
          const membershipsForCollection = collaboration.memberships.filter(
            (membership) => membership.collectionId === collectionId,
          );

          if (membershipsForCollection.length === 0) {
            collaboration.ensureOwner(collectionId);
            return true;
          }

          return membershipsForCollection.some(
            (membership) =>
              membership.userId === collaboration.activeUserId,
          );
        });

        const added: string[] = [];
        const already: string[] = [];

        if (!movie?.id || uniqueIds.length === 0) {
          return { added, already };
        }
        const recommendationMetadata = withSavedTimestamp(
          metadata,
          source,
        );
        const addedByUserId = collaboration.activeUserId;
        const addedAt = new Date().toISOString();

        set((state) => {
          const byCollection = { ...state.byCollection };
          const collectionOverrides = {
            ...state.collectionOverrides,
          };

          for (const collectionId of uniqueIds) {
            if (collectionOverrides[collectionId]?.deleted) {
              already.push(collectionId);
              continue;
            }
            const existing = byCollection[collectionId] ?? EMPTY_LOCAL_ITEMS;
            if (existing.some((item) => item.movie.id === movie.id)) {
              already.push(collectionId);
              continue;
            }

            byCollection[collectionId] = [
              ...existing,
              {
                movie,
                source,
                metadata: recommendationMetadata,
                addedByUserId,
                addedAt,
              },
            ];
            const currentOverride = collectionOverrides[collectionId];
            if (currentOverride?.removedMovieIds?.includes(movie.id)) {
              collectionOverrides[collectionId] = {
                ...currentOverride,
                removedMovieIds: currentOverride.removedMovieIds.filter(
                  (movieId) => movieId !== movie.id,
                ),
              };
            }
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
            capturedAt: addedAt,
            capturedByUserId: addedByUserId,
          };

          return {
            byCollection,
            collectionOverrides,
            captures: [event, ...state.captures].slice(0, 40),
          };
        });

        if (added.length === 0) {
          return { added, already };
        }

        for (const collectionId of added) {
          collaboration.recordActivity({
            collectionId,
            movieId: movie.id,
            userId: collaboration.activeUserId,
            type: "movie-added",
          });
          void import("@/lib/events/bus").then(({ createEventId, domainEventBus }) => {
            domainEventBus.publish({
              id: createEventId(),
              type: "recommendation.added",
              occurredAt: addedAt,
              actorUserId: addedByUserId,
              collectionId,
              payload: {
                movieId: movie.id,
                note: recommendationMetadata?.notes,
                sourceLabel: source.label,
              },
            });
          });
          void import("@/lib/observability/analytics").then(({ analytics }) => {
            analytics.track("recommendation_added", {
              collectionId,
              movieId: movie.id,
              source: source.type,
            });
          });

          void import("@/lib/supabase/client")
            .then(({ isSupabaseConfigured }) => {
              if (!isSupabaseConfigured()) return;
              void (async () => {
                const rec = {
                  id: crypto.randomUUID(),
                  listId: collectionId,
                  movieId: movie.id,
                  sourceType: source.type,
                  sourceLabel: source.label,
                  metadata: (recommendationMetadata ??
                    {}) as Record<string, unknown>,
                  note: recommendationMetadata?.notes ?? null,
                  addedByUserId,
                  createdBy: addedByUserId,
                  updatedBy: addedByUserId,
                  createdAt: addedAt,
                  updatedAt: addedAt,
                  deletedAt: null as string | null,
                };

                const {
                  createSaveTrace,
                  recordStage,
                  persistTraceToSyncStore,
                } = await import("@/lib/sync/save-pipeline-trace");
                const { getCloudRepositories } = await import(
                  "@/lib/repositories/cloud"
                );
                const { useAuthStore } = await import("@/store/auth-store");
                const { useCrewStore } = await import("@/store/crew-store");

                const repos = getCloudRepositories();
                const trace = createSaveTrace("cloud");
                trace.payload = {
                  recommendationId: rec.id,
                  listId: rec.listId,
                  movieId: rec.movieId,
                };

                try {
                  const localList = get().createdCollections.find(
                    (c) => c.id === collectionId,
                  );
                  const crewId = useCrewStore.getState().crew?.id ?? null;
                  const listPayload = {
                    id: collectionId,
                    ownerId: localList?.ownerId ?? addedByUserId,
                    crewId: localList?.householdId ?? crewId,
                    name: localList?.name ?? collectionId,
                    emoji: localList?.emoji ?? "🎬",
                    description: localList?.description ?? null,
                    archivedAt: null as string | null,
                    createdBy: localList?.createdBy ?? addedByUserId,
                    updatedBy: addedByUserId,
                    createdAt: localList?.createdAt ?? addedAt,
                    updatedAt: addedAt,
                    deletedAt: null as string | null,
                  };

                  const existingList = await repos.lists.getById(collectionId);
                  if (!existingList) {
                    await repos.lists.upsert(listPayload);
                  }
                  await repos.movies.upsert(movie);

                  if (!navigator.onLine) {
                    throw new Error(
                      "You appear to be offline — recommendation will sync once you're back online.",
                    );
                  }

                  const saved = await repos.recommendations.upsert(rec);
                  trace.supabaseResponse = {
                    id: saved.id,
                    listId: saved.listId,
                    movieId: saved.movieId,
                  };

                  try {
                    const crew = useCrewStore.getState().crew;
                    if (crew) {
                      const { crewService } = await import(
                        "@/lib/services/crew/crew-service"
                      );
                      await crewService.recordActivity({
                        crewId: crew.id,
                        userId: addedByUserId,
                        type: "movie-added",
                        listId: collectionId,
                        movieId: movie.id,
                        summary: `Added ${movie.title}`,
                      });
                    }
                  } catch {
                    // non-fatal — do not exit; upsert already succeeded
                  }
                } catch (err) {
                  const message =
                    err instanceof Error ? err.message : "Cloud save failed";
                  recordStage(trace, "pipeline", "FAILED", message);
                  useAuthStore.getState().setCloudSyncMeta("error", 1);
                  useAuthStore.setState({
                    error: `Could not save recommendation: ${message}`,
                  });
                } finally {
                  await persistTraceToSyncStore(trace);
                }
              })();
            })
            .catch((err: unknown) => {
              console.error(
                "[save-pipeline] FAILED · supabase client unavailable",
                err,
              );
            });
        }

        return { added, already };
      },

      createCollection: (name, emoji = "🎬") => {
        const trimmed = name.trim();
        const collaboration = useCollaborationStore.getState();
        const now = new Date().toISOString();
        const ownerId = collaboration.activeUserId;
        const crewId = useCrewStore.getState().crew?.id ?? null;
        const collection: Collection = {
          id: newId("collection"),
          name: trimmed || "Untitled",
          emoji: emoji.trim() || "🎬",
          description: "Created from Capture",
          items: [],
          ownerId,
          householdId: crewId,
          createdBy: ownerId,
          updatedBy: ownerId,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };

        set((state) => ({
          createdCollections: [collection, ...state.createdCollections],
        }));
        collaboration.ensureOwner(collection.id);
        const crewMembers = useCrewStore.getState().members;
        if (crewId && crewMembers.length) {
          useCollaborationStore.setState((state) => ({
            memberships: [
              ...state.memberships.filter(
                (m) => m.collectionId !== collection.id,
              ),
              ...crewMembers.map((member) => ({
                id: `membership-${collection.id}-${member.userId}`,
                collectionId: collection.id,
                userId: member.userId,
                role:
                  member.role === "owner" && member.userId === ownerId
                    ? ("owner" as const)
                    : ("member" as const),
                joinedAt: member.joinedAt,
              })),
            ],
          }));
        }
        void import("@/lib/events/bus").then(({ createEventId, domainEventBus }) => {
          domainEventBus.publish({
            id: createEventId(),
            type: "list.created",
            occurredAt: now,
            actorUserId: ownerId,
            collectionId: collection.id,
            payload: { name: collection.name },
          });
        });
        void import("@/lib/observability/analytics").then(({ analytics }) => {
          analytics.track("collection_created", {
            collectionId: collection.id,
            crewId,
            source: "local_collection_store",
          });
        });
        void import("@/lib/supabase/client").then(({ isSupabaseConfigured }) => {
          if (!isSupabaseConfigured()) return;
          const list = {
            id: collection.id,
            ownerId,
            crewId,
            name: collection.name,
            emoji: collection.emoji,
            description: collection.description ?? null,
            archivedAt: null as string | null,
            createdBy: ownerId,
            updatedBy: ownerId,
            createdAt: now,
            updatedAt: now,
            deletedAt: null as string | null,
          };
          void import("@/lib/sync/cloud-sync-engine").then(
            async ({ cloudSyncEngine }) => {
              await cloudSyncEngine.enqueue({
                entityType: "collection",
                entityId: list.id,
                operation: "upsert",
                payload: list,
              });
              // Immediate upsert when online so recommendations can FK to this list.
              if (navigator.onLine) {
                try {
                  const { getCloudRepositories } = await import(
                    "@/lib/repositories/cloud"
                  );
                  await getCloudRepositories().lists.upsert(list);
                } catch (err) {
                  const message =
                    err instanceof Error ? err.message : "List upsert failed";
                  console.error("[save-pipeline] FAILED · create_collection", message);
                  const { useAuthStore } = await import("@/store/auth-store");
                  useAuthStore.getState().setCloudSyncMeta("error", 1);
                  useAuthStore.setState({
                    error: `Could not create collection in cloud: ${message}`,
                  });
                }
              }
              if (crewId) {
                try {
                  const { crewService } = await import(
                    "@/lib/services/crew/crew-service"
                  );
                  await crewService.recordActivity({
                    crewId,
                    userId: ownerId,
                    type: "list-created",
                    listId: collection.id,
                    summary: `New list created: ${collection.name}`,
                  });
                } catch {
                  // Crew notification failure is non-fatal
                }
              }
            },
          );
        });

        return collection;
      },

      renameCollection: (collectionId, name, emoji) => {
        const trimmedName = name.trim();
        if (
          !collectionId ||
          !trimmedName ||
          !canEditCollection(collectionId)
        ) {
          return;
        }
        set((state) => ({
          collectionOverrides: {
            ...state.collectionOverrides,
            [collectionId]: {
              ...state.collectionOverrides[collectionId],
              name: trimmedName,
              emoji: emoji?.trim() || undefined,
            },
          },
        }));
      },

      deleteCollection: (collectionId) => {
        if (!collectionId || !canDeleteCollection(collectionId)) {
          return;
        }
        set((state) => ({
          collectionOverrides: {
            ...state.collectionOverrides,
            [collectionId]: {
              ...state.collectionOverrides[collectionId],
              deleted: true,
            },
          },
        }));
      },

      removeMovie: (collectionId, movieId) => {
        if (
          !collectionId ||
          !movieId ||
          !canEditCollection(collectionId)
        ) {
          return;
        }
        set((state) => {
          const currentOverride =
            state.collectionOverrides[collectionId] ?? {};
          return {
            byCollection: {
              ...state.byCollection,
              [collectionId]: (
                state.byCollection[collectionId] ?? EMPTY_LOCAL_ITEMS
              ).filter((item) => item.movie.id !== movieId),
            },
            collectionOverrides: {
              ...state.collectionOverrides,
              [collectionId]: {
                ...currentOverride,
                removedMovieIds: Array.from(
                  new Set([
                    ...(currentOverride.removedMovieIds ?? []),
                    movieId,
                  ]),
                ),
              },
            },
          };
        });
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
      version: 2,
      partialize: (state) => ({
        byCollection: state.byCollection,
        createdCollections: state.createdCollections,
        collectionOverrides: state.collectionOverrides,
        captures: state.captures,
      }),
      migrate: (persisted) => {
        const data = (persisted ?? {}) as Partial<LocalCollectionStore>;
        const byCollection = Object.fromEntries(
          Object.entries(data.byCollection ?? {}).map(
            ([collectionId, items]) => [
              collectionId,
              items.map((item) => ({
                ...item,
                addedByUserId:
                  item.addedByUserId ??
                    useCollaborationStore.getState().activeUserId,
                addedAt:
                  item.addedAt ??
                  item.metadata?.savedAt ??
                  "2026-01-01T00:00:00.000Z",
              })),
            ],
          ),
        );
        return {
          ...data,
          byCollection,
          createdCollections:
            data.createdCollections ?? EMPTY_CREATED_COLLECTIONS,
          collectionOverrides:
            data.collectionOverrides ?? EMPTY_COLLECTION_OVERRIDES,
          captures: (data.captures ?? EMPTY_CAPTURES).map(
            (capture) => ({
              ...capture,
              capturedByUserId:
                capture.capturedByUserId ??
                  useCollaborationStore.getState().activeUserId,
            }),
          ),
        };
      },
      merge: (persisted, current) => {
        const data = (persisted ?? {}) as Partial<LocalCollectionStore>;
        return {
          ...current,
          ...data,
          byCollection: data.byCollection ?? current.byCollection,
          createdCollections:
            data.createdCollections ?? current.createdCollections,
          collectionOverrides:
            data.collectionOverrides ?? current.collectionOverrides,
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
  removedMovieIds: string[] = [],
): CollectionMovie[] {
  const byId = new Map<string, CollectionMovie>();
  const removed = new Set(removedMovieIds);

  for (const item of serverItems) {
    if (!removed.has(item.movie.id)) byId.set(item.movie.id, item);
  }
  for (const item of localItems) {
    if (!removed.has(item.movie.id)) byId.set(item.movie.id, item);
  }

  return Array.from(byId.values());
}

/** Seed collections first, then user-created (no duplicates). */
export function mergeCollections(
  seed: Collection[],
  created: Collection[],
  overrides: Record<string, CollectionOverride> =
    EMPTY_COLLECTION_OVERRIDES,
): Collection[] {
  const byId = new Map<string, Collection>();
  for (const collection of seed) {
    byId.set(collection.id, collection);
  }
  for (const collection of created) {
    byId.set(collection.id, collection);
  }
  return Array.from(byId.values())
    .filter((collection) => !overrides[collection.id]?.deleted)
    .map((collection) => {
      const override = overrides[collection.id];
      return override
        ? {
            ...collection,
            name: override.name ?? collection.name,
            emoji: override.emoji ?? collection.emoji,
          }
        : collection;
    });
}
