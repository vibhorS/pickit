/**
 * Production-incident tracer for the recommendation save pipeline.
 * Every stage reports SUCCESS | FAILED | SKIPPED.
 */

export type SaveStageStatus = "SUCCESS" | "FAILED" | "SKIPPED";

export type SaveStage = {
  stage: string;
  status: SaveStageStatus;
  detail?: string;
  at: string;
};

export type SavePipelineTrace = {
  id: string;
  startedAt: string;
  stages: SaveStage[];
  lastError: string | null;
  repositoryMode: "cloud" | "local";
  payload?: Record<string, unknown>;
  supabaseResponse?: Record<string, unknown>;
};

const PREFIX = "[save-pipeline]";

function now(): string {
  return new Date().toISOString();
}

export function createSaveTrace(
  repositoryMode: "cloud" | "local",
): SavePipelineTrace {
  return {
    id: `save-${Date.now()}`,
    startedAt: now(),
    stages: [],
    lastError: null,
    repositoryMode,
  };
}

export function recordStage(
  trace: SavePipelineTrace,
  stage: string,
  status: SaveStageStatus,
  detail?: string,
): void {
  const entry: SaveStage = { stage, status, detail, at: now() };
  trace.stages.push(entry);
  if (status === "FAILED") {
    trace.lastError = detail ?? stage;
  }
  const line = `${PREFIX} ${status} · ${stage}${detail ? ` · ${detail}` : ""}`;
  if (status === "FAILED") {
    console.error(line, { traceId: trace.id });
  } else {
    console.info(line, { traceId: trace.id });
  }
}

export async function persistTraceToSyncStore(
  trace: SavePipelineTrace,
): Promise<void> {
  try {
    const { useSyncStore } = await import("@/store/sync-store");
    useSyncStore.getState().setLastSaveTrace(trace);
  } catch {
    // store may be unavailable during SSR
  }
}
