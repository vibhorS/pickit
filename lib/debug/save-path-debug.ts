/**
 * TEMPORARY — Save-path self-diagnosis for Developer Mode.
 * Remove this entire module (and SavePathDebugPanel) in one commit after the bug is fixed.
 */

import { create } from "zustand";

export type SavePathStageResult = "ok" | "fail" | "pending" | "skip";

export type SavePathStageError = {
  type: string;
  message: string;
  stack: string | null;
};

export type SavePathNetworkInfo = {
  requestPayload: unknown;
  responsePayload: unknown;
  httpStatus: number | null;
  durationMs: number | null;
  startedAtMs: number | null;
};

export type SavePathStep = {
  name: string;
  executed: true;
  recommendationId: string | null;
  objectId: string | null;
  sameAsBirth: boolean | null;
  path: "capture-save" | "sync-engine" | "other";
  at: string;
  atMs: number;
  msSinceSave: number;
  durationMs: number | null;
  result: SavePathStageResult;
  error: SavePathStageError | null;
  network: SavePathNetworkInfo | null;
};

export type SavePathSummary = {
  savePath: string;
  birthId: string | null;
  idChanged: boolean;
  supabaseCalled: boolean;
  httpStatus: number | null;
  responseLabel: string;
  rootFailure: string | null;
  writeSucceeded: boolean | null;
  /** First explicit exit from addMovieToCollections (or its cloud IIFE). */
  stopReason: string | null;
};

export type SavePathBranchOutcome =
  | "entered"
  | "passed"
  | "failed"
  | "await"
  | "return"
  | "throw"
  | "catch";

export type SavePathBranchEvent = {
  label: string;
  outcome: SavePathBranchOutcome;
  detail: string | null;
  at: string;
  atMs: number;
  msSinceSave: number;
};

export type SavePathExit = {
  reason: string;
  file: string;
  functionName: string;
  line: number;
  kind: "return" | "throw" | "catch";
  returnValue: unknown;
  error: SavePathStageError | null;
  at: string;
};

export type SavePathCollectionRef = {
  displayName: string;
  collectionId: string;
  source: "seed-mock" | "created-local" | "cloud-hydrated" | "create-on-save" | "unknown";
  emoji?: string;
  ownerId?: string | null;
  inSelectedIds: boolean;
  inCreateNames: boolean;
  afterResolve: boolean;
  afterMembershipFilter: boolean;
  inAdded: boolean;
  inAlready: boolean;
  listIdWritten: boolean;
};

export type SavePathCollectionPipeline = {
  uiSelected: SavePathCollectionRef[];
  selectedCollectionIds: string[];
  createCollectionNames: string[];
  afterCreateResolve: string[];
  afterMembershipFilter: string[];
  added: string[];
  already: string[];
  listIdsWritten: string[];
  homeCatalog: Array<{ id: string; name: string; source: string }>;
  captureCatalog: Array<{ id: string; name: string; source: string }>;
  firstDivergence: string | null;
};

export type SavePathDebugSnapshot = {
  startedAt: string | null;
  startedAtMs: number | null;
  steps: SavePathStep[];
  branches: SavePathBranchEvent[];
  firstExit: SavePathExit | null;
  collectionPipeline: SavePathCollectionPipeline | null;
  birthId: string | null;
  birthObjectId: string | null;
  idChanges: Array<{
    from: string;
    to: string;
    atStep: string;
  }>;
  finalPayload: Record<string, unknown> | null;
  supabaseResponse: {
    ok: boolean;
    data: unknown;
    error: unknown;
    httpStatus: number | null;
  } | null;
  writeSucceeded: boolean | null;
  pathsExecuted: string[];
  supabaseCalled: boolean;
  networkStartedAtMs: number | null;
};

const EMPTY: SavePathDebugSnapshot = {
  startedAt: null,
  startedAtMs: null,
  steps: [],
  branches: [],
  firstExit: null,
  collectionPipeline: null,
  birthId: null,
  birthObjectId: null,
  idChanges: [],
  finalPayload: null,
  supabaseResponse: null,
  writeSucceeded: null,
  pathsExecuted: [],
  supabaseCalled: false,
  networkStartedAtMs: null,
};

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function isBareUuid(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
}

function looksLikeNonUuidRecommendationId(id: string | null | undefined): boolean {
  if (!id) return false;
  return id.startsWith("rec-") || !isBareUuid(id);
}

function extractHttpStatus(error: unknown, ok: boolean): number | null {
  if (ok) return 200;
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  if (typeof record.status === "number") return record.status;
  if (typeof record.statusCode === "number") return record.statusCode;
  const message = String(record.message ?? "");
  if (/invalid input syntax for type uuid/i.test(message)) return 400;
  if (/assertValidRecommendationId/i.test(String(record.code ?? ""))) return null;
  return null;
}

function deriveRootFailure(state: SavePathDebugSnapshot): string | null {
  if (state.writeSucceeded === true) return null;

  // Prefer the first explicit stop inside addMovieToCollections.
  if (state.firstExit?.reason) {
    return state.firstExit.reason;
  }

  const failedStage = [...state.steps].reverse().find((s) => s.result === "fail");
  if (failedStage?.error?.message) {
    if (
      /not UUID|Invalid recommendation\.id|invalid input syntax for type uuid|rec-/i.test(
        failedStage.error.message,
      ) ||
      looksLikeNonUuidRecommendationId(failedStage.recommendationId)
    ) {
      return "recommendations.id is not UUID";
    }
    return failedStage.error.message;
  }

  const err = state.supabaseResponse?.error;
  if (err && typeof err === "object") {
    const message = String((err as { message?: unknown }).message ?? "");
    if (/invalid input syntax for type uuid/i.test(message)) {
      return "recommendations.id is not UUID";
    }
    if (message) return message;
  }

  if (looksLikeNonUuidRecommendationId(state.birthId)) {
    return "recommendations.id is not UUID";
  }

  const lastId = [...state.steps]
    .reverse()
    .find((s) => s.recommendationId)?.recommendationId;
  if (looksLikeNonUuidRecommendationId(lastId)) {
    return "recommendations.id is not UUID";
  }

  if (state.startedAt && state.pathsExecuted.length === 0) {
    const cloudScheduled = state.branches.some((b) =>
      b.label.includes("Schedule cloud persist"),
    );
    // Cloud IIFE still in flight — do not claim a stop reason yet.
    if (cloudScheduled && state.writeSucceeded == null) {
      return null;
    }
    return "NONE — no recommendations.upsert path ran";
  }

  if (state.writeSucceeded === false) {
    return "Write failed (see timeline)";
  }

  return null;
}

export function buildSavePathSummary(
  state: SavePathDebugSnapshot,
): SavePathSummary {
  const savePath =
    state.pathsExecuted.length === 0
      ? "NONE"
      : state.pathsExecuted.length > 1
        ? `BOTH (${state.pathsExecuted.join(" + ")})`
        : state.pathsExecuted[0]!;

  const httpStatus = state.supabaseResponse?.httpStatus ?? null;
  let responseLabel = "—";
  if (state.supabaseCalled) {
    responseLabel =
      httpStatus != null
        ? String(httpStatus)
        : state.writeSucceeded
          ? "OK"
          : "ERROR";
  } else if (
    state.steps.some((s) => s.name === "assertValidRecommendationId") ||
    state.firstExit != null ||
    state.supabaseResponse?.error
  ) {
    responseLabel = "not called";
  }

  return {
    savePath,
    birthId: state.birthId,
    idChanged: state.idChanges.length > 0,
    supabaseCalled: state.supabaseCalled,
    httpStatus,
    responseLabel,
    rootFailure: deriveRootFailure(state),
    writeSucceeded: state.writeSucceeded,
    stopReason: state.firstExit?.reason ?? null,
  };
}

type SavePathDebugStore = SavePathDebugSnapshot & {
  clear: () => void;
  mark: (input: {
    name: string;
    recommendationId?: string | null;
    objectId?: string | null;
    sameAsBirth?: boolean | null;
    path?: SavePathStep["path"];
    result?: SavePathStageResult;
    error?: SavePathStageError | null;
    network?: SavePathNetworkInfo | null;
  }) => void;
  branch: (input: {
    label: string;
    outcome: SavePathBranchOutcome;
    detail?: string | null;
  }) => void;
  exit: (input: {
    reason: string;
    file: string;
    functionName: string;
    line: number;
    kind: "return" | "throw" | "catch";
    returnValue?: unknown;
    error?: unknown;
  }) => void;
  fail: (
    name: string,
    err: unknown,
    extras?: {
      recommendationId?: string | null;
      objectId?: string | null;
      path?: SavePathStep["path"];
    },
  ) => void;
  setBirth: (id: string, objectId: string) => void;
  setFinalPayload: (payload: Record<string, unknown>) => void;
  beginNetwork: (payload: Record<string, unknown>) => void;
  setSupabaseResponse: (input: {
    ok: boolean;
    data: unknown;
    error: unknown;
    httpStatus?: number | null;
  }) => void;
  setCollectionPipeline: (pipeline: SavePathCollectionPipeline) => void;
  patchCollectionPipeline: (
    patch: Partial<SavePathCollectionPipeline>,
  ) => void;
};

function classifyCollectionSource(
  id: string,
  seedIds: Set<string>,
  createdIds: Set<string>,
): SavePathCollectionRef["source"] {
  if (id.startsWith("collection-") && !createdIds.has(id) && !seedIds.has(id)) {
    return "create-on-save";
  }
  if (seedIds.has(id)) return "seed-mock";
  if (createdIds.has(id)) {
    return id.startsWith("collection-") || id.startsWith("demo-")
      ? "cloud-hydrated"
      : "created-local";
  }
  return "unknown";
}

export function buildCollectionRef(input: {
  id: string;
  name: string;
  emoji?: string;
  ownerId?: string | null;
  seedIds: Set<string>;
  createdIds: Set<string>;
  flags: Partial<
    Pick<
      SavePathCollectionRef,
      | "inSelectedIds"
      | "inCreateNames"
      | "afterResolve"
      | "afterMembershipFilter"
      | "inAdded"
      | "inAlready"
      | "listIdWritten"
    >
  >;
}): SavePathCollectionRef {
  return {
    displayName: input.name,
    collectionId: input.id,
    source: classifyCollectionSource(input.id, input.seedIds, input.createdIds),
    emoji: input.emoji,
    ownerId: input.ownerId ?? null,
    inSelectedIds: input.flags.inSelectedIds ?? false,
    inCreateNames: input.flags.inCreateNames ?? false,
    afterResolve: input.flags.afterResolve ?? false,
    afterMembershipFilter: input.flags.afterMembershipFilter ?? false,
    inAdded: input.flags.inAdded ?? false,
    inAlready: input.flags.inAlready ?? false,
    listIdWritten: input.flags.listIdWritten ?? false,
  };
}

export function detectCollectionFirstDivergence(
  pipeline: SavePathCollectionPipeline,
): string | null {
  const selected = pipeline.uiSelected.filter(
    (r) => r.inSelectedIds || r.inCreateNames,
  );
  if (selected.length === 0 && pipeline.selectedCollectionIds.length === 0) {
    return "UI: no chips selected / no create names";
  }

  for (const ref of selected) {
    if (ref.inSelectedIds && !pipeline.selectedCollectionIds.includes(ref.collectionId)) {
      return `UI→selectedCollectionIds: chip "${ref.displayName}" (${ref.collectionId}) missing from selectedCollectionIds`;
    }
  }

  for (const id of pipeline.selectedCollectionIds) {
    if (!pipeline.afterCreateResolve.includes(id)) {
      return `selectedCollectionIds→afterCreateResolve: "${id}" dropped before create resolve`;
    }
  }

  for (const id of pipeline.afterCreateResolve) {
    if (!pipeline.afterMembershipFilter.includes(id)) {
      const ref = pipeline.uiSelected.find((r) => r.collectionId === id);
      return `afterCreateResolve→membershipFilter: "${ref?.displayName ?? id}" (${id}) REJECTED by membership filter`;
    }
  }

  for (const id of pipeline.afterMembershipFilter) {
    if (pipeline.already.includes(id)) {
      const ref = pipeline.uiSelected.find((r) => r.collectionId === id);
      return `membershipFilter→added: "${ref?.displayName ?? id}" (${id}) skipped as already present / deleted — cloud upsert never scheduled for this id`;
    }
    if (!pipeline.added.includes(id) && !pipeline.already.includes(id)) {
      return `membershipFilter→added: "${id}" not in added or already`;
    }
  }

  for (const id of pipeline.added) {
    if (!pipeline.listIdsWritten.includes(id)) {
      const ref = pipeline.uiSelected.find((r) => r.collectionId === id);
      return `added→recommendations.upsert: "${ref?.displayName ?? id}" (${id}) in added but list_id never written`;
    }
  }

  // Dual Date Night identity (same display name, different ids)
  const dateNightIds = pipeline.uiSelected
    .filter((r) => r.displayName.toLowerCase() === "date night")
    .map((r) => r.collectionId);
  const uniqueDateNight = Array.from(new Set(dateNightIds));
  if (uniqueDateNight.length > 1) {
    return `catalog duality: display name "Date Night" maps to ${uniqueDateNight.length} ids (${uniqueDateNight.join(", ")}) — seed-mock vs cloud/demo`;
  }

  return null;
}

function closePreviousDuration(
  steps: SavePathStep[],
  now: number,
): SavePathStep[] {
  if (steps.length === 0) return steps;
  const last = steps[steps.length - 1]!;
  if (last.durationMs != null) return steps;
  return [
    ...steps.slice(0, -1),
    { ...last, durationMs: Math.max(0, Math.round(now - last.atMs)) },
  ];
}

function toStageError(err: unknown): SavePathStageError {
  if (err instanceof Error) {
    return {
      type: err.name || "Error",
      message: err.message,
      stack: err.stack ?? null,
    };
  }
  if (err && typeof err === "object") {
    const record = err as Record<string, unknown>;
    return {
      type: String(record.code ?? record.name ?? "Error"),
      message: String(record.message ?? JSON.stringify(err)),
      stack:
        typeof record.stack === "string"
          ? record.stack
          : new Error(String(record.message ?? "error")).stack ?? null,
    };
  }
  return {
    type: "Error",
    message: String(err),
    stack: new Error(String(err)).stack ?? null,
  };
}

export const useSavePathDebugStore = create<SavePathDebugStore>((set, get) => ({
  ...EMPTY,

  clear: () =>
    set({
      ...EMPTY,
      startedAt: new Date().toISOString(),
      startedAtMs: nowMs(),
      steps: [],
    }),

  setBirth: (id, objectId) =>
    set({ birthId: id, birthObjectId: objectId }),

  branch: (input) => {
    const state = get();
    const atMs = nowMs();
    let startedAtMs = state.startedAtMs;
    let startedAt = state.startedAt;
    if (startedAtMs == null) {
      startedAtMs = atMs;
      startedAt = new Date().toISOString();
    }
    const event: SavePathBranchEvent = {
      label: input.label,
      outcome: input.outcome,
      detail: input.detail ?? null,
      at: new Date().toISOString(),
      atMs,
      msSinceSave: Math.max(0, Math.round(atMs - startedAtMs)),
    };
    const result: SavePathStageResult =
      input.outcome === "failed" ||
      input.outcome === "throw" ||
      input.outcome === "catch"
        ? "fail"
        : input.outcome === "return"
          ? "skip"
          : "ok";
    get().mark({
      name: `${input.outcome.toUpperCase()}: ${input.label}`,
      path: "capture-save",
      result,
      error:
        input.outcome === "failed" ||
        input.outcome === "throw" ||
        input.outcome === "catch"
          ? {
              type: input.outcome,
              message: input.detail ?? input.label,
              stack: null,
            }
          : null,
    });
    set({
      startedAt,
      startedAtMs,
      branches: [...get().branches, event],
    });
  },

  exit: (input) => {
    const state = get();
    // First exit wins — identifies where execution stopped.
    if (state.firstExit) return;

    const error = input.error != null ? toStageError(input.error) : null;
    const exitRecord: SavePathExit = {
      reason: input.reason,
      file: input.file,
      functionName: input.functionName,
      line: input.line,
      kind: input.kind,
      returnValue: input.returnValue ?? null,
      error,
      at: new Date().toISOString(),
    };

    get().branch({
      label: `EXIT (${input.kind}): ${input.reason}`,
      outcome: input.kind === "return" ? "return" : input.kind,
      detail: [
        `${input.file}:${input.line}`,
        input.returnValue !== undefined
          ? `returnValue=${JSON.stringify(input.returnValue)}`
          : null,
        error ? `error=${error.message}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });

    set({
      firstExit: exitRecord,
      writeSucceeded: false,
    });
  },

  mark: (input) => {
    const state = get();
    const atMs = nowMs();
    let startedAtMs = state.startedAtMs;
    let startedAt = state.startedAt;
    if (startedAtMs == null) {
      startedAtMs = atMs;
      startedAt = new Date().toISOString();
    }

    const recommendationId = input.recommendationId ?? null;
    const objectId = input.objectId ?? null;
    const path = input.path ?? "capture-save";
    const prevId =
      state.steps.length > 0
        ? state.steps[state.steps.length - 1]?.recommendationId
        : state.birthId;
    const idChanges = [...state.idChanges];
    if (recommendationId && prevId && recommendationId !== prevId) {
      idChanges.push({
        from: prevId,
        to: recommendationId,
        atStep: input.name,
      });
    }

    const isUpsertPathRoot =
      input.name === "repos.recommendations.upsert" ||
      input.name === "CloudRecommendationRepository.upsert" ||
      input.name === "cloudSyncEngine.applyRemote" ||
      input.name === "Supabase POST";
    const pathsExecuted =
      isUpsertPathRoot && !state.pathsExecuted.includes(path)
        ? [...state.pathsExecuted, path]
        : state.pathsExecuted;

    const stepsWithDuration = closePreviousDuration(state.steps, atMs);

    set({
      startedAt,
      startedAtMs,
      steps: [
        ...stepsWithDuration,
        {
          name: input.name,
          executed: true,
          recommendationId,
          objectId,
          sameAsBirth:
            input.sameAsBirth ??
            (objectId != null && state.birthObjectId != null
              ? objectId === state.birthObjectId
              : recommendationId != null && state.birthId != null
                ? recommendationId === state.birthId
                : null),
          path,
          at: new Date().toISOString(),
          atMs,
          msSinceSave: Math.max(0, Math.round(atMs - startedAtMs)),
          durationMs: null,
          result: input.result ?? "ok",
          error: input.error ?? null,
          network: input.network ?? null,
        },
      ],
      idChanges,
      pathsExecuted,
    });
  },

  fail: (name, err, extras) => {
    get().mark({
      name,
      recommendationId: extras?.recommendationId,
      objectId: extras?.objectId,
      path: extras?.path,
      result: "fail",
      error: toStageError(err),
    });
    set({ writeSucceeded: false });
  },

  setFinalPayload: (payload) => set({ finalPayload: payload }),

  beginNetwork: (payload) => {
    const state = get();
    const atMs = nowMs();
    const inheritedPath =
      state.steps.at(-1)?.path ?? ("capture-save" as const);
    const lastId = state.steps.at(-1)?.recommendationId ?? state.birthId;
    const lastObjectId =
      state.steps.at(-1)?.objectId ?? state.birthObjectId;

    get().mark({
      name: "Supabase POST",
      recommendationId: lastId,
      objectId: lastObjectId,
      path: inheritedPath,
      result: "pending",
      network: {
        requestPayload: payload,
        responsePayload: null,
        httpStatus: null,
        durationMs: null,
        startedAtMs: atMs,
      },
    });
    set({
      finalPayload: payload,
      networkStartedAtMs: atMs,
      supabaseCalled: true,
    });
  },

  setSupabaseResponse: (input) => {
    const state = get();
    const atMs = nowMs();
    const httpStatus =
      input.httpStatus !== undefined
        ? input.httpStatus
        : extractHttpStatus(input.error, input.ok);
    const durationMs =
      state.networkStartedAtMs != null
        ? Math.max(0, Math.round(atMs - state.networkStartedAtMs))
        : null;

    const steps = closePreviousDuration([...state.steps], atMs).map((step) => {
      if (step.name !== "Supabase POST" || step.network == null) return step;
      return {
        ...step,
        result: (input.ok ? "ok" : "fail") as SavePathStageResult,
        durationMs: durationMs ?? step.durationMs,
        error: input.ok
          ? null
          : toStageError(input.error ?? { message: "Supabase upsert failed" }),
        network: {
          ...step.network,
          responsePayload: input.ok
            ? input.data
            : { data: input.data, error: input.error },
          httpStatus,
          durationMs,
        },
      };
    });

    // Ensure a response stage exists for timeline readability.
    const hasResponseStep = steps.some((s) => s.name === "Supabase response");
    const responseSteps = hasResponseStep
      ? steps
      : [
          ...steps,
          {
            name: "Supabase response",
            executed: true as const,
            recommendationId:
              input.ok &&
              input.data &&
              typeof input.data === "object" &&
              "id" in (input.data as object)
                ? String((input.data as { id: unknown }).id)
                : (steps.at(-1)?.recommendationId ?? state.birthId),
            objectId: steps.at(-1)?.objectId ?? state.birthObjectId,
            sameAsBirth: steps.at(-1)?.sameAsBirth ?? null,
            path: steps.at(-1)?.path ?? ("other" as const),
            at: new Date().toISOString(),
            atMs,
            msSinceSave:
              state.startedAtMs != null
                ? Math.max(0, Math.round(atMs - state.startedAtMs))
                : 0,
            durationMs: durationMs,
            result: (input.ok ? "ok" : "fail") as SavePathStageResult,
            error: input.ok
              ? null
              : toStageError(
                  input.error ?? { message: "Supabase upsert failed" },
                ),
            network: {
              requestPayload: state.finalPayload,
              responsePayload: input.ok
                ? input.data
                : { data: input.data, error: input.error },
              httpStatus,
              durationMs,
              startedAtMs: state.networkStartedAtMs,
            },
          },
        ];

    set({
      steps: responseSteps,
      supabaseResponse: {
        ok: input.ok,
        data: input.data,
        error: input.error,
        httpStatus,
      },
      writeSucceeded: input.ok,
      supabaseCalled:
        state.supabaseCalled || state.networkStartedAtMs != null,
    });
  },

  setCollectionPipeline: (pipeline) => {
    const withDivergence: SavePathCollectionPipeline = {
      ...pipeline,
      firstDivergence: detectCollectionFirstDivergence(pipeline),
    };
    set({ collectionPipeline: withDivergence });
    get().branch({
      label: "Collection ID pipeline",
      outcome: withDivergence.firstDivergence ? "failed" : "passed",
      detail:
        withDivergence.firstDivergence ??
        `OK · selected=${JSON.stringify(pipeline.selectedCollectionIds)} · written=${JSON.stringify(pipeline.listIdsWritten)}`,
    });
  },

  patchCollectionPipeline: (patch) => {
    const state = get();
    const prev = state.collectionPipeline;
    if (!prev) {
      const empty: SavePathCollectionPipeline = {
        uiSelected: [],
        selectedCollectionIds: [],
        createCollectionNames: [],
        afterCreateResolve: [],
        afterMembershipFilter: [],
        added: [],
        already: [],
        listIdsWritten: [],
        homeCatalog: [],
        captureCatalog: [],
        firstDivergence: null,
      };
      const next = { ...empty, ...patch };
      set({
        collectionPipeline: {
          ...next,
          firstDivergence: detectCollectionFirstDivergence(next),
        },
      });
      return;
    }

    const next: SavePathCollectionPipeline = {
      ...prev,
      ...patch,
      uiSelected: patch.uiSelected ?? prev.uiSelected,
      listIdsWritten: patch.listIdsWritten
        ? Array.from(
            new Set([...prev.listIdsWritten, ...patch.listIdsWritten]),
          )
        : prev.listIdsWritten,
    };
    // Recompute per-ref flags from arrays when arrays patch
    if (
      patch.afterMembershipFilter ||
      patch.added ||
      patch.already ||
      patch.listIdsWritten ||
      patch.afterCreateResolve
    ) {
      next.uiSelected = next.uiSelected.map((ref) => ({
        ...ref,
        afterResolve: next.afterCreateResolve.includes(ref.collectionId),
        afterMembershipFilter: next.afterMembershipFilter.includes(
          ref.collectionId,
        ),
        inAdded: next.added.includes(ref.collectionId),
        inAlready: next.already.includes(ref.collectionId),
        listIdWritten: next.listIdsWritten.includes(ref.collectionId),
      }));
    }
    next.firstDivergence = detectCollectionFirstDivergence(next);
    set({ collectionPipeline: next });
    if (next.firstDivergence) {
      get().branch({
        label: "Collection ID pipeline (updated)",
        outcome: "failed",
        detail: next.firstDivergence,
      });
    }
  },
}));

/** Imperative helpers so non-React call sites stay one-liners. */
export const savePathDebug = {
  clear: () => useSavePathDebugStore.getState().clear(),
  mark: (
    name: string,
    extras?: {
      recommendationId?: string | null;
      objectId?: string | null;
      sameAsBirth?: boolean | null;
      path?: SavePathStep["path"];
      result?: SavePathStageResult;
      error?: SavePathStageError | null;
      network?: SavePathNetworkInfo | null;
    },
  ) => useSavePathDebugStore.getState().mark({ name, ...extras }),
  branch: (
    label: string,
    outcome: SavePathBranchOutcome,
    detail?: string | null,
  ) => useSavePathDebugStore.getState().branch({ label, outcome, detail }),
  exit: (input: {
    reason: string;
    file: string;
    functionName: string;
    line: number;
    kind: "return" | "throw" | "catch";
    returnValue?: unknown;
    error?: unknown;
  }) => useSavePathDebugStore.getState().exit(input),
  fail: (
    name: string,
    err: unknown,
    extras?: {
      recommendationId?: string | null;
      objectId?: string | null;
      path?: SavePathStep["path"];
    },
  ) => useSavePathDebugStore.getState().fail(name, err, extras),
  setBirth: (id: string, objectId: string) =>
    useSavePathDebugStore.getState().setBirth(id, objectId),
  setFinalPayload: (payload: Record<string, unknown>) =>
    useSavePathDebugStore.getState().setFinalPayload(payload),
  beginNetwork: (payload: Record<string, unknown>) =>
    useSavePathDebugStore.getState().beginNetwork(payload),
  setSupabaseResponse: (input: {
    ok: boolean;
    data: unknown;
    error: unknown;
    httpStatus?: number | null;
  }) => useSavePathDebugStore.getState().setSupabaseResponse(input),
  setCollectionPipeline: (pipeline: SavePathCollectionPipeline) =>
    useSavePathDebugStore.getState().setCollectionPipeline(pipeline),
  patchCollectionPipeline: (patch: Partial<SavePathCollectionPipeline>) =>
    useSavePathDebugStore.getState().patchCollectionPipeline(patch),
  markListIdWritten: (listId: string) =>
    useSavePathDebugStore.getState().patchCollectionPipeline({
      listIdsWritten: [listId],
    }),
  snapshot: (): SavePathDebugSnapshot => {
    const s = useSavePathDebugStore.getState();
    return {
      startedAt: s.startedAt,
      startedAtMs: s.startedAtMs,
      steps: s.steps,
      branches: s.branches,
      firstExit: s.firstExit,
      collectionPipeline: s.collectionPipeline,
      birthId: s.birthId,
      birthObjectId: s.birthObjectId,
      idChanges: s.idChanges,
      finalPayload: s.finalPayload,
      supabaseResponse: s.supabaseResponse,
      writeSucceeded: s.writeSucceeded,
      pathsExecuted: s.pathsExecuted,
      supabaseCalled: s.supabaseCalled,
      networkStartedAtMs: s.networkStartedAtMs,
    };
  },
  summary: (): SavePathSummary =>
    buildSavePathSummary(useSavePathDebugStore.getState()),
};
