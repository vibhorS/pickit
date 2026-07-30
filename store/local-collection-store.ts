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
import { useAuthStore } from "@/store/auth-store";
import { savePathDebug } from "@/lib/debug/save-path-debug";

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
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `${prefix}-${crypto.randomUUID()}`
      : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  if (prefix === "rec") {
    console.error(
      "[REC-ID-TRACE] FIRST ASSIGNMENT via newId('rec') — THIS IS THE BUG",
      { id, stack: new Error().stack },
    );
  }
  return id;
}

function newUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return newId("tmp").replace(/^[a-z]+-/, "");
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
        const FILE = "store/local-collection-store.ts";
        const FN = "addMovieToCollections";

        savePathDebug.mark("addMovieToCollections", {
          recommendationId: null,
          path: "capture-save",
        });
        savePathDebug.branch(
          "Entered addMovieToCollections",
          "entered",
          `movieId=${movie?.id ?? "null"} collectionIds=${JSON.stringify(collectionIds)}`,
        );
        console.error("CALLGRAPH ✓ addMovieToCollections entered", {
          file: FILE,
          movieId: movie?.id,
          collectionIds,
        });
        const collaboration = useCollaborationStore.getState();

        // --- uniqueIds construction pipeline (diagnostics only) ---
        savePathDebug.branch(
          "uniqueIds pipeline: collectionIds input",
          "entered",
          `INPUT collectionIds=${JSON.stringify(collectionIds)}`,
        );

        const afterBoolean = collectionIds.filter(Boolean);
        savePathDebug.branch(
          "uniqueIds pipeline: filter(Boolean)",
          "passed",
          `INPUT=${JSON.stringify(collectionIds)} → OUTPUT=${JSON.stringify(afterBoolean)} · REASON: drop falsy ids`,
        );

        const afterUnique = Array.from(new Set(afterBoolean));
        savePathDebug.branch(
          "uniqueIds pipeline: new Set (dedupe)",
          "passed",
          `INPUT=${JSON.stringify(afterBoolean)} → OUTPUT=${JSON.stringify(afterUnique)} · REASON: unique collection ids`,
        );

        const membershipRejects: Array<{
          collectionId: string;
          membershipsForCollection: Array<{
            id: string;
            userId: string;
            role: string;
          }>;
          activeUserId: string;
          reason: string;
        }> = [];

        const uniqueIds = afterUnique.filter((collectionId) => {
          const membershipsForCollection = collaboration.memberships.filter(
            (membership) => membership.collectionId === collectionId,
          );

          savePathDebug.branch(
            `uniqueIds pipeline: membership lookup for "${collectionId}"`,
            "await",
            `DATA STRUCTURE: collaboration.memberships (${collaboration.memberships.length} total) · FILTER: membership.collectionId === "${collectionId}" · OUTPUT count=${membershipsForCollection.length} · rows=${JSON.stringify(
              membershipsForCollection.map((m) => ({
                id: m.id,
                userId: m.userId,
                role: m.role,
              })),
            )} · activeUserId=${collaboration.activeUserId}`,
          );

          if (membershipsForCollection.length === 0) {
            collaboration.ensureOwner(collectionId);
            savePathDebug.branch(
              `uniqueIds pipeline: keep "${collectionId}"`,
              "passed",
              `INPUT memberships=[] → OUTPUT keep=true · REASON: no memberships → ensureOwner(${collectionId}) then return true`,
            );
            return true;
          }

          const activeIsMember = membershipsForCollection.some(
            (membership) =>
              membership.userId === collaboration.activeUserId,
          );

          if (!activeIsMember) {
            const reject = {
              collectionId,
              membershipsForCollection: membershipsForCollection.map((m) => ({
                id: m.id,
                userId: m.userId,
                role: m.role,
              })),
              activeUserId: collaboration.activeUserId,
              reason: `REJECTED: memberships exist for "${collectionId}" but none have userId === activeUserId ("${collaboration.activeUserId}"). ensureOwner was NOT called because memberships.length > 0. This is NOT a "movie already present" check — that runs later on added/already.`,
            };
            membershipRejects.push(reject);
            savePathDebug.branch(
              `uniqueIds pipeline: filter REMOVE "${collectionId}"`,
              "failed",
              `INPUT memberships=${JSON.stringify(reject.membershipsForCollection)} activeUserId=${reject.activeUserId} → OUTPUT keep=false · REASON: ${reject.reason}`,
            );
            return false;
          }

          savePathDebug.branch(
            `uniqueIds pipeline: filter KEEP "${collectionId}"`,
            "passed",
            `INPUT memberships include activeUserId=${collaboration.activeUserId} → OUTPUT keep=true · REASON: memberships.some(m => m.userId === activeUserId)`,
          );
          return true;
        });

        savePathDebug.branch(
          "uniqueIds pipeline: final uniqueIds",
          uniqueIds.length > 0 ? "passed" : "failed",
          `INPUT after dedupe=${JSON.stringify(afterUnique)} → OUTPUT uniqueIds=${JSON.stringify(uniqueIds)} · rejects=${JSON.stringify(membershipRejects)} · NOTE: movie-already-present is NOT consulted at this stage`,
        );

        savePathDebug.patchCollectionPipeline({
          afterCreateResolve: afterUnique,
          afterMembershipFilter: uniqueIds,
        });

        if (uniqueIds.length === 0 && afterUnique.length > 0) {
          savePathDebug.exit({
            reason: `uniqueIds became [] at membership filter: ${membershipRejects.map((r) => r.reason).join(" | ") || "all collections rejected"}`,
            file: FILE,
            functionName: FN,
            line: 249,
            kind: "return",
            returnValue: {
              collectionIds,
              afterBoolean,
              afterUnique,
              uniqueIds,
              activeUserId: collaboration.activeUserId,
              membershipRejects,
              consulted: "useCollaborationStore.memberships + activeUserId",
            },
          });
        }

        const added: string[] = [];
        const already: string[] = [];

        savePathDebug.branch(
          "Condition: movie?.id && uniqueIds.length > 0",
          movie?.id && uniqueIds.length > 0 ? "passed" : "failed",
          `movieId=${movie?.id ?? "null"} uniqueIds=${JSON.stringify(uniqueIds)} activeUserId=${collaboration.activeUserId}`,
        );

        if (!movie?.id || uniqueIds.length === 0) {
          const returnValue = { added, already };
          if (!savePathDebug.snapshot().firstExit) {
            savePathDebug.exit({
              reason:
                !movie?.id
                  ? "EARLY_RETURN: movie.id missing — cloud upsert never scheduled"
                  : "EARLY_RETURN: uniqueIds empty after membership filter — cloud upsert never scheduled",
              file: FILE,
              functionName: FN,
              line: 192,
              kind: "return",
              returnValue,
            });
          }
          return returnValue;
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

        for (const collectionId of already) {
          savePathDebug.branch(
            `Collection ${collectionId} not added locally`,
            "failed",
            "deleted override or movie already present",
          );
        }
        for (const collectionId of added) {
          savePathDebug.branch(
            `Local add to ${collectionId}`,
            "passed",
            `movieId=${movie.id}`,
          );
        }

        savePathDebug.branch(
          "Condition: added.length > 0",
          added.length > 0 ? "passed" : "failed",
          `added=${JSON.stringify(added)} already=${JSON.stringify(already)}`,
        );

        savePathDebug.patchCollectionPipeline({
          afterMembershipFilter: uniqueIds,
          added,
          already,
        });

        if (added.length === 0) {
          console.error(
            "[SAVE-ASSERT] FIRST FAILURE: addMovieToCollections produced zero added collections — cloud repository will never be called",
            { already, collectionIds: uniqueIds, movieId: movie?.id },
          );
          const returnValue = { added, already };
          savePathDebug.exit({
            reason:
              "RETURN: added.length === 0 — movie already in collections or all deleted; cloud IIFE never started; recommendations.upsert never called",
            file: FILE,
            functionName: FN,
            line: 248,
            kind: "return",
            returnValue,
          });
          return returnValue;
        } else {
          console.info(
            "[SAVE-ASSERT] Local add succeeded; entering cloud persist for collections",
            { added },
          );
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

          savePathDebug.branch(
            `Schedule cloud persist IIFE for ${collectionId}`,
            "entered",
            "void import(@/lib/supabase/client).then(async IIFE)",
          );

          void import("@/lib/supabase/client")
            .then(({ isSupabaseConfigured }) => {
              savePathDebug.branch(
                "Await: import @/lib/supabase/client",
                "await",
                "resolved",
              );
              void (async () => {
                savePathDebug.branch(
                  "Entered cloud persist IIFE",
                  "entered",
                  `collectionId=${collectionId}`,
                );
                // TEMPORARY — cloud IIFE await timeline for write diagnosis
                let cloudIifeRecommendationId: string | null = null;
                const recordIife = (
                  step: Parameters<typeof savePathDebug.recordCloudIife>[0]["step"],
                  error?: unknown,
                ) => {
                  savePathDebug.recordCloudIife({
                    step,
                    collectionId,
                    movieId: movie.id,
                    recommendationId: cloudIifeRecommendationId,
                    error,
                  });
                };
                recordIife("1. entered cloud IIFE");
                try {
                  const { assertStage, recordRepoInstance } = await import(
                    "@/lib/sync/save-assertions"
                  );
                  savePathDebug.branch(
                    "Await: import save-assertions",
                    "await",
                    "resolved",
                  );

                  const cloudConfigured = isSupabaseConfigured();
                  console.info("STAGE 3: Repository selected", { cloudConfigured });
                  savePathDebug.branch(
                    "Condition: isSupabaseConfigured()",
                    cloudConfigured ? "passed" : "failed",
                    `cloudConfigured=${cloudConfigured}`,
                  );

                  try {
                    assertStage(
                      3,
                      "Repository selected",
                      cloudConfigured,
                      cloudConfigured
                        ? "isSupabaseConfigured()=true → getCloudRepositories()"
                        : "isSupabaseConfigured()=false → CloudRepository NEVER selected; insert will not run",
                    );
                    savePathDebug.branch(
                      "assertStage(3) cloudConfigured",
                      "passed",
                      null,
                    );
                  } catch (err) {
                    console.error(err);
                    savePathDebug.exit({
                      reason:
                        "CATCH/RETURN: assertStage(3) isSupabaseConfigured() failed — cloud upsert aborted",
                      file: FILE,
                      functionName: FN,
                      line: 304,
                      kind: "catch",
                      error: err,
                    });
                    throw err;
                  }

                  const { tagRecommendationBirth, traceRecommendation } =
                    await import("@/lib/sync/rec-id-trace");
                  savePathDebug.branch(
                    "Await: import rec-id-trace",
                    "await",
                    "resolved",
                  );

                  // ORIGINAL assignment of CloudRecommendation.id for Save.
                  // Must be a bare UUID — never a prefixed id.
                  const recommendationId = crypto.randomUUID();
                  cloudIifeRecommendationId = recommendationId;
                  console.error("REC ID CREATION", {
                    recommendationId,
                    file: FILE,
                    line: 304,
                    implementation: "CURRENT",
                  });
                  savePathDebug.mark("REC ID CREATION", {
                    recommendationId,
                    path: "capture-save",
                  });
                  const rec = tagRecommendationBirth(
                    {
                      id: recommendationId,
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
                    },
                    {
                      file: FILE,
                      functionName: FN,
                      line: 297,
                    },
                  );
                  traceRecommendation(rec, "after birth in addMovieToCollections", {
                    file: FILE,
                    functionName: FN,
                    line: 320,
                  });

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
                  savePathDebug.branch(
                    "Await: import cloud repos + auth + crew",
                    "await",
                    "resolved",
                  );

                  const repos = getCloudRepositories();
                  recordRepoInstance(
                    repos,
                    "getCloudRepositories() return value used for Save Recommendations",
                  );
                  recordRepoInstance(
                    repos.recommendations,
                    "repos.recommendations (handler for upsert)",
                  );

                  const impl = (repos as { __pickItImplementation?: string })
                    .__pickItImplementation;
                  const recImpl = (
                    repos.recommendations as { __pickItImplementation?: string }
                  ).__pickItImplementation;
                  savePathDebug.branch(
                    "Condition: CloudRepositories identity",
                    impl === "CloudRepositories" &&
                      recImpl === "CloudRecommendationRepository"
                      ? "passed"
                      : "failed",
                    `reposImpl=${impl} recommendationsImpl=${recImpl}`,
                  );

                  try {
                    assertStage(
                      3,
                      "Repository selected — CloudRepositories identity",
                      impl === "CloudRepositories" &&
                        recImpl === "CloudRecommendationRepository",
                      JSON.stringify({
                        reposImpl: impl,
                        recommendationsImpl: recImpl,
                        reposInstanceId: (
                          repos as { __pickItInstanceId?: string }
                        ).__pickItInstanceId,
                        recommendationsInstanceId: (
                          repos.recommendations as { __pickItInstanceId?: string }
                        ).__pickItInstanceId,
                      }),
                    );
                    savePathDebug.branch(
                      "assertStage(3) CloudRepositories identity",
                      "passed",
                      null,
                    );
                  } catch (err) {
                    console.error(err);
                    savePathDebug.exit({
                      reason:
                        "CATCH/RETURN: assertStage(3) CloudRepositories identity failed — upsert aborted",
                      file: FILE,
                      functionName: FN,
                      line: 397,
                      kind: "catch",
                      error: err,
                    });
                    throw err;
                  }

                  console.info(
                    "[SAVE-ASSERT] Calling repos.recommendations.upsert — CloudRepository save entry (no saveRecommendations() method exists in this codebase)",
                  );

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

                    savePathDebug.branch(
                      "Await: repos.lists.getById",
                      "await",
                      `collectionId=${collectionId}`,
                    );
                    const existingList = await repos.lists.getById(collectionId);
                    recordIife("2. repos.lists.getById completed");
                    savePathDebug.branch(
                      "Condition: existingList",
                      existingList ? "passed" : "failed",
                      existingList
                        ? "list exists — skip lists.upsert"
                        : "list missing — will lists.upsert",
                    );
                    if (!existingList) {
                      savePathDebug.branch(
                        "Await: repos.lists.upsert",
                        "await",
                        collectionId,
                      );
                      await repos.lists.upsert(listPayload);
                      recordIife("3. repos.lists.upsert completed");
                    }
                    savePathDebug.branch(
                      "Await: repos.movies.upsert",
                      "await",
                      movie.id,
                    );
                    recordIife("4. repos.movies.upsert entered");
                    await repos.movies.upsert(movie);
                    recordIife("5. repos.movies.upsert returned");

                    savePathDebug.branch(
                      "Condition: navigator.onLine",
                      navigator.onLine ? "passed" : "failed",
                      `onLine=${navigator.onLine}`,
                    );
                    if (!navigator.onLine) {
                      assertStage(
                        7,
                        "Insert() called",
                        false,
                        "navigator.onLine=false — Supabase insert() was NEVER called",
                      );
                    }

                    traceRecommendation(rec, "before repository.upsert (same object?)", {
                      file: FILE,
                      functionName: FN,
                      line: 407,
                    });

                    console.error("CALLGRAPH ✓ repos.recommendations.upsert about to call", {
                      file: FILE,
                      recId: rec.id,
                    });
                    {
                      const { getRecommendationObjectId } = await import(
                        "@/lib/sync/rec-id-trace"
                      );
                      savePathDebug.mark("repos.recommendations.upsert", {
                        recommendationId: rec.id,
                        objectId: getRecommendationObjectId(rec),
                        path: "capture-save",
                      });
                    }
                    savePathDebug.branch(
                      "Await: repos.recommendations.upsert",
                      "await",
                      rec.id,
                    );
                    recordIife("6. repos.recommendations.upsert entered");
                    // Stages 4–9 are asserted inside CloudRecommendationRepository.upsert
                    const saved = await repos.recommendations.upsert(rec);
                    recordIife("7. repos.recommendations.upsert returned");
                    savePathDebug.markListIdWritten(saved.listId);
                    savePathDebug.branch(
                      "repos.recommendations.upsert returned",
                      "passed",
                      `saved.id=${saved.id} listId=${saved.listId}`,
                    );
                    trace.supabaseResponse = {
                      id: saved.id,
                      listId: saved.listId,
                      movieId: saved.movieId,
                    };

                    console.info("STAGE 10: UI refreshed");
                    assertStage(
                      10,
                      "UI refreshed",
                      true,
                      `cloud row confirmed id=${saved.id}; local Zustand already updated`,
                    );

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
                    } catch (crewErr) {
                      savePathDebug.branch(
                        "CATCH: crewService.recordActivity (non-fatal)",
                        "catch",
                        crewErr instanceof Error
                          ? crewErr.message
                          : String(crewErr),
                      );
                      // non-fatal — do not exit; upsert already succeeded
                    }
                  } catch (err) {
                    const message =
                      err instanceof Error ? err.message : "Cloud save failed";
                    recordIife("8. catch block entered", err);
                    recordIife("9. final exception", err);
                    recordStage(trace, "pipeline", "FAILED", message);
                    console.error("[SAVE-ASSERT] cloud persist stopped", err);
                    savePathDebug.exit({
                      reason: `CATCH: cloud persist threw before/during upsert — ${message}`,
                      file: FILE,
                      functionName: FN,
                      line: 502,
                      kind: "catch",
                      error: err,
                    });
                    useAuthStore.getState().setCloudSyncMeta("error", 1);
                    useAuthStore.setState({
                      error: `Could not save recommendation: ${message}`,
                    });
                    throw err;
                  } finally {
                    await persistTraceToSyncStore(trace);
                  }
                } catch (err) {
                  // Surface any previously uncaught IIFE failure (including rethrows).
                  const alreadyCaught = savePathDebug
                    .snapshot()
                    .cloudIifeSteps.some(
                      (s) => s.step === "8. catch block entered",
                    );
                  if (!alreadyCaught) {
                    recordIife("8. catch block entered", err);
                    recordIife("9. final exception", err);
                  }
                  if (!savePathDebug.snapshot().firstExit) {
                    savePathDebug.exit({
                      reason: `CATCH: cloud persist IIFE aborted — ${
                        err instanceof Error ? err.message : String(err)
                      }`,
                      file: FILE,
                      functionName: FN,
                      line: 289,
                      kind: "catch",
                      error: err,
                    });
                  }
                  console.error("[SAVE-PATH] cloud IIFE exception surfaced", err);
                }
              })();
            })
            .catch((err: unknown) => {
              savePathDebug.exit({
                reason: `CATCH: import(@/lib/supabase/client) rejected — cloud IIFE never entered`,
                file: FILE,
                functionName: FN,
                line: 288,
                kind: "catch",
                error: err,
              });
              console.error("[SAVE-PATH] supabase client import failed", err);
            });
        }

        savePathDebug.branch(
          "Sync addMovieToCollections returning (cloud IIFE may still be in flight)",
          "passed",
          `added=${JSON.stringify(added)} already=${JSON.stringify(already)}`,
        );
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
      onRehydrateStorage: () => {
        return (state, error) => {
          void import("@/lib/debug/boot-trace").then(({ bootTrace }) => {
            bootTrace.record({
              stage: "Zustand persist onRehydrateStorage (local-collections)",
              operation: error ? "RESET" : "REPLACE",
              detail: error
                ? `rehydrate error: ${String(error)}`
                : `persisted keys=${JSON.stringify(Object.keys(state?.byCollection ?? {}))}`,
              byCollection: state?.byCollection ?? {},
              catalogIds: [
                ...(state?.createdCollections?.map((c) => c.id) ?? []),
                ...Object.keys(state?.byCollection ?? {}),
              ],
            });
          });
        };
      },
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
