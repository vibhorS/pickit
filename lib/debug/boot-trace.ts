/**
 * TEMPORARY — Boot-sequence + UI render tracer.
 * Remove with BootTracePanel after the refresh-loss bug is proven and fixed.
 */

import { create } from "zustand";

export type BootTraceOperation =
  | "SNAPSHOT"
  | "REPLACE"
  | "MERGE"
  | "RESET"
  | "SKIP"
  | "READ"
  | "SEED"
  | "MIGRATE"
  | "SUBSCRIBE"
  | "UI";

export type BootTraceCollectionDump = {
  collectionId: string;
  collectionName: string;
  movies: string[];
  titles: string[];
  recIds: string[];
  movieCount: number;
  skippedMovies: string[];
  skippedRecIds: string[];
};

export type BootTraceStage = {
  stage: string;
  at: string;
  atMs: number;
  msSinceBoot: number;
  operation: BootTraceOperation;
  detail: string | null;
  byCollectionKeys: string[];
  fullDump: BootTraceCollectionDump[];
  fullDumpText: string;
  incorrect: boolean;
  incorrectReason: string | null;
};

/** Stats / card props for Supabase → byCollection → Stats → Card comparison. */
export type BootTraceUiDump = {
  stage: string;
  at: string;
  atMs: number;
  msSinceBoot: number;
  text: string;
  rows: Array<Record<string, unknown>>;
};

export type BootTraceSnapshot = {
  bootStartedAt: string | null;
  bootStartedAtMs: number | null;
  stages: BootTraceStage[];
  uiDumps: BootTraceUiDump[];
  firstIncorrectStage: string | null;
  firstIncorrectReason: string | null;
};

const EMPTY: BootTraceSnapshot = {
  bootStartedAt: null,
  bootStartedAtMs: null,
  stages: [],
  uiDumps: [],
  firstIncorrectStage: null,
  firstIncorrectReason: null,
};

type CollectionItemInput = {
  movie?: { id?: string; title?: string } | null;
  recommendationId?: string | null;
};

type BootTraceStore = BootTraceSnapshot & {
  clear: () => void;
  beginBoot: () => void;
  record: (input: {
    stage: string;
    operation: BootTraceOperation;
    detail?: string | null;
    byCollection: Record<string, CollectionItemInput[]>;
    catalogIds?: string[];
    /** id → display name */
    collectionNames?: Record<string, string>;
    recommendationMeta?: Array<{
      id: string;
      listId: string;
      movieId: string;
      included: boolean;
      skipReason?: string | null;
    }>;
  }) => void;
  recordUi: (input: {
    stage: string;
    rows: Array<Record<string, unknown>>;
    detail?: string | null;
  }) => void;
};

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function buildFullDump(
  byCollection: Record<string, CollectionItemInput[]>,
  catalogIds: string[] | undefined,
  collectionNames: Record<string, string> | undefined,
  recommendationMeta:
    | Array<{
        id: string;
        listId: string;
        movieId: string;
        included: boolean;
        skipReason?: string | null;
      }>
    | undefined,
): BootTraceCollectionDump[] {
  const ids = Array.from(
    new Set([
      ...(catalogIds ?? []),
      ...Object.keys(byCollection),
      ...Object.keys(collectionNames ?? {}),
      ...(recommendationMeta ?? []).map((row) => row.listId),
    ]),
  ).sort();

  return ids.map((collectionId) => {
    const items = byCollection[collectionId] ?? [];
    const movies = items
      .map((item) => item.movie?.id)
      .filter((id): id is string => Boolean(id));
    const titles = items.map(
      (item) => item.movie?.title ?? item.movie?.id ?? "?",
    );
    const recIdsFromItems = items
      .map((item) => item.recommendationId)
      .filter((id): id is string => Boolean(id));
    const metaForList = (recommendationMeta ?? []).filter(
      (row) => row.listId === collectionId,
    );
    const recIdsIncluded = metaForList
      .filter((row) => row.included)
      .map((row) => row.id);
    const skippedMovies = metaForList
      .filter((row) => !row.included)
      .map((row) => row.movieId);
    const skippedRecIds = metaForList
      .filter((row) => !row.included)
      .map((row) => row.id);
    const recIds =
      recIdsFromItems.length > 0 ? recIdsFromItems : recIdsIncluded;

    return {
      collectionId,
      collectionName: collectionNames?.[collectionId] ?? "(name unknown)",
      movies,
      titles,
      recIds,
      movieCount: movies.length,
      skippedMovies,
      skippedRecIds,
    };
  });
}

export function formatFullDump(dump: BootTraceCollectionDump[]): string {
  if (dump.length === 0) {
    return "byCollection = {}\n(no collections)";
  }
  const lines = [`byCollection (${dump.length} collections)`, ""];
  for (const entry of dump) {
    lines.push(`Collection ID: ${entry.collectionId}`);
    lines.push(`Collection name: ${entry.collectionName}`);
    lines.push(`Movies: [${entry.movies.join(", ")}]`);
    lines.push(`Recommendation IDs: [${entry.recIds.join(", ")}]`);
    lines.push(`Movie titles: [${entry.titles.join(", ")}]`);
    lines.push(`Movie count: ${entry.movieCount}`);
    if (entry.skippedMovies.length > 0) {
      lines.push(`Skipped movies: [${entry.skippedMovies.join(", ")}]`);
      lines.push(`Skipped recIds: [${entry.skippedRecIds.join(", ")}]`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

function formatUiRows(
  stage: string,
  rows: Array<Record<string, unknown>>,
): string {
  const lines = [`${stage} (${rows.length} rows)`, ""];
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      lines.push(
        `${key}: ${
          typeof value === "string" ? value : JSON.stringify(value)
        }`,
      );
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

function detectLostMovies(
  prior: BootTraceCollectionDump[],
  next: BootTraceCollectionDump[],
  priorStage: string,
): string | null {
  const losses: string[] = [];
  for (const prev of prior) {
    const curr = next.find((row) => row.collectionId === prev.collectionId);
    const currMovies = curr?.movies ?? [];
    const lost = prev.movies.filter((id) => !currMovies.includes(id));
    if (lost.length > 0) {
      losses.push(
        `${prev.collectionId} (${prev.collectionName}) lost [${lost.join(", ")}] (was count=${prev.movieCount}, now count=${currMovies.length})`,
      );
    }
  }
  if (losses.length === 0) return null;
  return `Lost vs prior stage "${priorStage}": ${losses.join(" | ")}`;
}

/** Stages where we always console the COMPLETE byCollection dump. */
export function isFullDumpStage(stage: string): boolean {
  const s = stage.toLowerCase();
  return (
    (s.includes("loadcloudsnapshot") &&
      (s.includes("bycollection built") ||
        s.includes("snapshot.bycollection") ||
        s.includes("cloud payload"))) ||
    s.includes("mergecloudsnapshot") ||
    s.includes("refreshfromcloud") ||
    s.includes("boot complete") ||
    s.includes("post-boot")
  );
}

export const useBootTraceStore = create<BootTraceStore>((set, get) => ({
  ...EMPTY,

  clear: () => set({ ...EMPTY, stages: [], uiDumps: [] }),

  beginBoot: () => {
    const atMs = nowMs();
    set({
      ...EMPTY,
      bootStartedAt: new Date().toISOString(),
      bootStartedAtMs: atMs,
      stages: [],
      uiDumps: [],
    });
  },

  record: (input) => {
    const state = get();
    let bootStartedAtMs = state.bootStartedAtMs;
    let bootStartedAt = state.bootStartedAt;
    if (bootStartedAtMs == null) {
      bootStartedAtMs = nowMs();
      bootStartedAt = new Date().toISOString();
    }
    const atMs = nowMs();
    const fullDump = buildFullDump(
      input.byCollection,
      input.catalogIds,
      input.collectionNames,
      input.recommendationMeta,
    );
    const fullDumpText = formatFullDump(fullDump);

    let incorrect = false;
    let incorrectReason: string | null = null;

    const priorFull = [...state.stages]
      .reverse()
      .find((stage) => stage.fullDump.length > 0);
    if (priorFull) {
      const lost = detectLostMovies(
        priorFull.fullDump,
        fullDump,
        priorFull.stage,
      );
      if (lost) {
        incorrect = true;
        incorrectReason = lost;
      }
    }

    const skippedAnywhere = fullDump.filter(
      (row) => row.skippedMovies.length > 0,
    );
    if (
      !incorrect &&
      skippedAnywhere.length > 0 &&
      isFullDumpStage(input.stage)
    ) {
      incorrect = true;
      incorrectReason = skippedAnywhere
        .map(
          (row) =>
            `${row.collectionId} (${row.collectionName}) skipped movies [${row.skippedMovies.join(", ")}]`,
        )
        .join(" | ");
    }

    const stage: BootTraceStage = {
      stage: input.stage,
      at: new Date().toISOString(),
      atMs,
      msSinceBoot: Math.max(0, Math.round(atMs - bootStartedAtMs)),
      operation: input.operation,
      detail: input.detail ?? null,
      byCollectionKeys: Object.keys(input.byCollection),
      fullDump,
      fullDumpText,
      incorrect,
      incorrectReason,
    };

    set({
      bootStartedAt,
      bootStartedAtMs,
      stages: [...state.stages, stage],
      firstIncorrectStage:
        state.firstIncorrectStage ?? (incorrect ? input.stage : null),
      firstIncorrectReason:
        state.firstIncorrectReason ?? incorrectReason,
    });

    if (isFullDumpStage(input.stage) || incorrect) {
      console.error(`[BOOT-TRACE] ${stage.stage}\n${fullDumpText}`, {
        operation: stage.operation,
        msSinceBoot: stage.msSinceBoot,
        incorrect: stage.incorrect,
        reason: stage.incorrectReason,
        detail: stage.detail,
      });
    } else {
      console.error("[BOOT-TRACE]", {
        stage: stage.stage,
        operation: stage.operation,
        msSinceBoot: stage.msSinceBoot,
        keys: stage.byCollectionKeys,
        detail: stage.detail,
      });
    }
  },

  recordUi: (input) => {
    const state = get();
    let bootStartedAtMs = state.bootStartedAtMs;
    let bootStartedAt = state.bootStartedAt;
    if (bootStartedAtMs == null) {
      bootStartedAtMs = nowMs();
      bootStartedAt = new Date().toISOString();
    }
    const atMs = nowMs();
    const text = formatUiRows(input.stage, input.rows);
    const dump: BootTraceUiDump = {
      stage: input.stage,
      at: new Date().toISOString(),
      atMs,
      msSinceBoot: Math.max(0, Math.round(atMs - bootStartedAtMs)),
      text,
      rows: input.rows,
    };

    // Replace prior dump for the same stage (avoid unbounded growth on re-renders)
    const uiDumps = [
      ...state.uiDumps.filter((row) => row.stage !== input.stage),
      dump,
    ];

    set({
      bootStartedAt,
      bootStartedAtMs,
      uiDumps,
    });

    console.error(`[BOOT-TRACE-UI] ${input.stage}\n${text}`, {
      detail: input.detail ?? null,
      msSinceBoot: dump.msSinceBoot,
    });
  },
}));

/** Imperative API for non-React call sites. */
export const bootTrace = {
  clear: () => useBootTraceStore.getState().clear(),
  beginBoot: () => useBootTraceStore.getState().beginBoot(),
  record: (input: Parameters<BootTraceStore["record"]>[0]) =>
    useBootTraceStore.getState().record(input),
  recordUi: (input: Parameters<BootTraceStore["recordUi"]>[0]) =>
    useBootTraceStore.getState().recordUi(input),
};
