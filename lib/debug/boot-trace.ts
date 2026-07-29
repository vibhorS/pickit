/**
 * TEMPORARY — Boot-sequence + UI render tracer.
 * Remove with BootTracePanel after the refresh-loss bug is proven and fixed.
 *
 * ALWAYS dumps the COMPLETE byCollection — every key, every collection.
 * Never focus / summarize / collapse to a single collection.
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
  name: string;
  movies: string[];
  titles: string[];
  recommendations: string[];
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
  /** Exact Object.keys(byCollection) at record time — no filtering. */
  rawKeys: string[];
  rawKeyCount: number;
  fullDump: BootTraceCollectionDump[];
  fullDumpText: string;
  incorrect: boolean;
  incorrectReason: string | null;
};

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
  // UNION of every known id — never drop empty catalogs.
  const ids = Array.from(
    new Set([
      ...Object.keys(byCollection),
      ...(catalogIds ?? []),
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
    const recommendations =
      recIdsFromItems.length > 0 ? recIdsFromItems : recIdsIncluded;

    return {
      collectionId,
      name: collectionNames?.[collectionId] ?? "(name unknown)",
      movies,
      titles,
      recommendations,
      movieCount: movies.length,
      skippedMovies,
      skippedRecIds,
    };
  });
}

/** Exact user-requested shape — every collection, no focus, no collapse. */
export function formatFullDump(
  dump: BootTraceCollectionDump[],
  rawKeys: string[],
): string {
  const lines: string[] = [];
  lines.push(`raw Object.keys(byCollection) count = ${rawKeys.length}`);
  lines.push(`raw Object.keys(byCollection) = [${rawKeys.join(", ")}]`);
  lines.push(`dump collection count = ${dump.length}`);
  lines.push("");
  lines.push("byCollection = {");
  lines.push("");

  if (dump.length === 0) {
    lines.push("  (empty)");
    lines.push("}");
    return lines.join("\n");
  }

  for (const entry of dump) {
    lines.push(entry.collectionId);
    lines.push(`  name: ${entry.name}`);
    lines.push(`  movies: [${entry.movies.join(", ")}]`);
    lines.push(`  titles: [${entry.titles.join(", ")}]`);
    lines.push(
      `  recommendations: [${entry.recommendations.join(", ")}]`,
    );
    lines.push(`  movieCount: ${entry.movieCount}`);
    if (entry.skippedMovies.length > 0) {
      lines.push(
        `  skippedMovies: [${entry.skippedMovies.join(", ")}]`,
      );
      lines.push(
        `  skippedRecIds: [${entry.skippedRecIds.join(", ")}]`,
      );
    }
    lines.push("");
  }

  lines.push("}");
  return lines.join("\n");
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
        `${prev.collectionId} (${prev.name}) lost [${lost.join(", ")}] (was count=${prev.movieCount}, now count=${currMovies.length})`,
      );
    }
  }
  if (losses.length === 0) return null;
  return `Lost vs prior stage "${priorStage}": ${losses.join(" | ")}`;
}

/** Stages that must always show the COMPLETE byCollection object. */
export function isFullDumpStage(stage: string): boolean {
  const s = stage.toLowerCase();
  return (
    s.includes("loadcloudsnapshot") ||
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
    const rawKeys = Object.keys(input.byCollection);
    const fullDump = buildFullDump(
      input.byCollection,
      input.catalogIds,
      input.collectionNames,
      input.recommendationMeta,
    );
    const fullDumpText = formatFullDump(fullDump, rawKeys);

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
            `${row.collectionId} (${row.name}) skipped movies [${row.skippedMovies.join(", ")}]`,
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
      rawKeys,
      rawKeyCount: rawKeys.length,
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

    // Always print COMPLETE dump for load/merge/refresh — never a focus slice.
    if (isFullDumpStage(input.stage) || incorrect) {
      console.error(`[BOOT-TRACE] ${stage.stage}\n${fullDumpText}`);
    } else {
      console.error("[BOOT-TRACE]", {
        stage: stage.stage,
        operation: stage.operation,
        msSinceBoot: stage.msSinceBoot,
        rawKeyCount: rawKeys.length,
        rawKeys,
        dumpCount: fullDump.length,
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

    const uiDumps = [
      ...state.uiDumps.filter((row) => row.stage !== input.stage),
      dump,
    ];

    set({
      bootStartedAt,
      bootStartedAtMs,
      uiDumps,
    });

    console.error(`[BOOT-TRACE-UI] ${input.stage}\n${text}`);
  },
}));

export const bootTrace = {
  clear: () => useBootTraceStore.getState().clear(),
  beginBoot: () => useBootTraceStore.getState().beginBoot(),
  record: (input: Parameters<BootTraceStore["record"]>[0]) =>
    useBootTraceStore.getState().record(input),
  recordUi: (input: Parameters<BootTraceStore["recordUi"]>[0]) =>
    useBootTraceStore.getState().recordUi(input),
};
