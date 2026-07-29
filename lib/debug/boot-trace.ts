/**
 * TEMPORARY — Boot-sequence byCollection tracer.
 * Remove with BootTracePanel after the refresh-loss bug is proven and fixed.
 */

import { create } from "zustand";

/** Nolan focus id prefix from runtime evidence. */
export const BOOT_TRACE_FOCUS_PREFIX = "collection-dc6c3efe";

export type BootTraceOperation =
  | "SNAPSHOT"
  | "REPLACE"
  | "MERGE"
  | "RESET"
  | "SKIP"
  | "READ"
  | "SEED"
  | "MIGRATE"
  | "SUBSCRIBE";

export type BootTraceFocusSlice = {
  collectionId: string | null;
  movieIds: string[];
  movieTitles: string[];
  recommendationIds: string[];
  skippedRecommendationIds: string[];
  skippedMovieIds: string[];
};

export type BootTraceStage = {
  stage: string;
  at: string;
  atMs: number;
  msSinceBoot: number;
  operation: BootTraceOperation;
  detail: string | null;
  byCollectionKeys: string[];
  focus: BootTraceFocusSlice;
  /** Full map: collectionId → movie ids (compact). */
  movieIdsByCollection: Record<string, string[]>;
  incorrect: boolean;
  incorrectReason: string | null;
};

export type BootTraceSnapshot = {
  bootStartedAt: string | null;
  bootStartedAtMs: number | null;
  stages: BootTraceStage[];
  firstIncorrectStage: string | null;
  firstIncorrectReason: string | null;
  expectedMovieIds: string[] | null;
};

const EMPTY: BootTraceSnapshot = {
  bootStartedAt: null,
  bootStartedAtMs: null,
  stages: [],
  firstIncorrectStage: null,
  firstIncorrectReason: null,
  expectedMovieIds: null,
};

type BootTraceStore = BootTraceSnapshot & {
  clear: () => void;
  beginBoot: () => void;
  setExpectedMovieIds: (ids: string[]) => void;
  record: (input: {
    stage: string;
    operation: BootTraceOperation;
    detail?: string | null;
    byCollection: Record<
      string,
      Array<{
        movie?: { id?: string; title?: string } | null;
        recommendationId?: string | null;
      }>
    >;
    recommendationMeta?: Array<{
      id: string;
      listId: string;
      movieId: string;
      included: boolean;
      skipReason?: string | null;
    }>;
    /** Mark this stage incorrect if focus movies don't contain all expected. */
    checkExpected?: boolean;
  }) => void;
};

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function findFocusKey(keys: string[]): string | null {
  return (
    keys.find((key) => key.startsWith(BOOT_TRACE_FOCUS_PREFIX)) ?? null
  );
}

function sliceFocus(
  byCollection: Record<
    string,
    Array<{
      movie?: { id?: string; title?: string } | null;
      recommendationId?: string | null;
    }>
  >,
  recommendationMeta?: Array<{
    id: string;
    listId: string;
    movieId: string;
    included: boolean;
    skipReason?: string | null;
  }>,
): BootTraceFocusSlice {
  const keys = Object.keys(byCollection);
  const collectionId = findFocusKey(keys);
  const items = collectionId ? (byCollection[collectionId] ?? []) : [];
  const movieIds = items
    .map((item) => item.movie?.id)
    .filter((id): id is string => Boolean(id));
  const movieTitles = items
    .map((item) => item.movie?.title ?? item.movie?.id ?? "?")
    .filter(Boolean) as string[];
  const recommendationIds = items
    .map((item) => item.recommendationId)
    .filter((id): id is string => Boolean(id));

  const focusMeta = (recommendationMeta ?? []).filter(
    (row) =>
      row.listId.startsWith(BOOT_TRACE_FOCUS_PREFIX) ||
      (collectionId != null && row.listId === collectionId),
  );
  const skippedRecommendationIds = focusMeta
    .filter((row) => !row.included)
    .map((row) => row.id);
  const skippedMovieIds = focusMeta
    .filter((row) => !row.included)
    .map((row) => row.movieId);

  // Prefer rec ids from meta when items don't carry them
  const metaIncludedIds = focusMeta
    .filter((row) => row.included)
    .map((row) => row.id);

  return {
    collectionId,
    movieIds,
    movieTitles,
    recommendationIds:
      recommendationIds.length > 0 ? recommendationIds : metaIncludedIds,
    skippedRecommendationIds,
    skippedMovieIds,
  };
}

function compactMovieMap(
  byCollection: Record<
    string,
    Array<{ movie?: { id?: string } | null }>
  >,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [id, items] of Object.entries(byCollection)) {
    out[id] = items
      .map((item) => item.movie?.id)
      .filter((movieId): movieId is string => Boolean(movieId));
  }
  return out;
}

export const useBootTraceStore = create<BootTraceStore>((set, get) => ({
  ...EMPTY,

  clear: () => set({ ...EMPTY, stages: [] }),

  beginBoot: () => {
    const atMs = nowMs();
    set({
      ...EMPTY,
      bootStartedAt: new Date().toISOString(),
      bootStartedAtMs: atMs,
      stages: [],
    });
  },

  setExpectedMovieIds: (ids) => set({ expectedMovieIds: ids }),

  record: (input) => {
    const state = get();
    let bootStartedAtMs = state.bootStartedAtMs;
    let bootStartedAt = state.bootStartedAt;
    if (bootStartedAtMs == null) {
      bootStartedAtMs = nowMs();
      bootStartedAt = new Date().toISOString();
    }
    const atMs = nowMs();
    const focus = sliceFocus(input.byCollection, input.recommendationMeta);
    const expected = state.expectedMovieIds;
    let incorrect = false;
    let incorrectReason: string | null = null;

    if (input.checkExpected && expected && expected.length > 0) {
      const missing = expected.filter((id) => !focus.movieIds.includes(id));
      if (missing.length > 0) {
        incorrect = true;
        incorrectReason = `Focus collection missing expected movieIds: ${missing.join(", ")} (have: [${focus.movieIds.join(", ")}])`;
      }
    }

    // Auto-detect drop of previously seen movies in focus collection
    if (!incorrect && focus.collectionId) {
      const prior = [...state.stages]
        .reverse()
        .find((stage) => stage.focus.collectionId === focus.collectionId);
      if (prior && prior.focus.movieIds.length > focus.movieIds.length) {
        const lost = prior.focus.movieIds.filter(
          (id) => !focus.movieIds.includes(id),
        );
        if (lost.length > 0) {
          incorrect = true;
          incorrectReason = `Lost movieIds vs prior stage "${prior.stage}": ${lost.join(", ")}`;
        }
      }
    }

    const stage: BootTraceStage = {
      stage: input.stage,
      at: new Date().toISOString(),
      atMs,
      msSinceBoot: Math.max(0, Math.round(atMs - bootStartedAtMs)),
      operation: input.operation,
      detail: input.detail ?? null,
      byCollectionKeys: Object.keys(input.byCollection),
      focus,
      movieIdsByCollection: compactMovieMap(input.byCollection),
      incorrect,
      incorrectReason,
    };

    set({
      bootStartedAt,
      bootStartedAtMs,
      stages: [...state.stages, stage],
      firstIncorrectStage:
        state.firstIncorrectStage ??
        (incorrect ? input.stage : null),
      firstIncorrectReason:
        state.firstIncorrectReason ?? incorrectReason,
    });

    console.error("[BOOT-TRACE]", {
      stage: stage.stage,
      operation: stage.operation,
      msSinceBoot: stage.msSinceBoot,
      focus: stage.focus,
      keys: stage.byCollectionKeys,
      incorrect: stage.incorrect,
      reason: stage.incorrectReason,
      detail: stage.detail,
    });
  },
}));

/** Imperative API for non-React call sites. */
export const bootTrace = {
  clear: () => useBootTraceStore.getState().clear(),
  beginBoot: () => useBootTraceStore.getState().beginBoot(),
  setExpectedMovieIds: (ids: string[]) =>
    useBootTraceStore.getState().setExpectedMovieIds(ids),
  record: (
    input: Parameters<BootTraceStore["record"]>[0],
  ) => useBootTraceStore.getState().record(input),
};
