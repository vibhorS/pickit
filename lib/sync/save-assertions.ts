/**
 * Hard assertion harness for the Save Recommendations pipeline.
 * Stops at the FIRST failing stage. Does not attempt recovery.
 */

export type SaveAssertStage = {
  stage: number;
  name: string;
  ok: boolean;
  detail?: string;
  at: string;
};

declare global {
  interface Window {
    __PICKIT_SAVE_STAGES__?: SaveAssertStage[];
    __PICKIT_SAVE_FIRST_FAILURE__?: SaveAssertStage | null;
    __PICKIT_SAVE_REPO_INSTANCE__?: unknown;
  }
}

function stages(): SaveAssertStage[] {
  if (typeof window === "undefined") return [];
  if (!window.__PICKIT_SAVE_STAGES__) {
    window.__PICKIT_SAVE_STAGES__ = [];
  }
  return window.__PICKIT_SAVE_STAGES__;
}

export function resetSaveAssertions(): void {
  if (typeof window === "undefined") return;
  window.__PICKIT_SAVE_STAGES__ = [];
  window.__PICKIT_SAVE_FIRST_FAILURE__ = null;
  window.__PICKIT_SAVE_REPO_INSTANCE__ = undefined;
  console.info("[SAVE-ASSERT] RESET");
}

/**
 * Mark that execution reached a stage. Throws on failed condition.
 */
export function assertStage(
  stage: number,
  name: string,
  condition: unknown,
  detail?: string,
): void {
  const label = `STAGE ${stage}: ${name}`;
  console.info(label, detail ?? "");

  const entry: SaveAssertStage = {
    stage,
    name,
    ok: Boolean(condition),
    detail:
      typeof detail === "string"
        ? detail
        : condition
          ? undefined
          : "condition was falsy",
    at: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    stages().push(entry);
  }

  if (!condition) {
    if (typeof window !== "undefined" && !window.__PICKIT_SAVE_FIRST_FAILURE__) {
      window.__PICKIT_SAVE_FIRST_FAILURE__ = entry;
    }
    console.error(`[SAVE-ASSERT] FIRST FAILURE at ${label}`, entry);
    console.error(
      "[SAVE-ASSERT] Pipeline stopped. Inspect window.__PICKIT_SAVE_STAGES__ and window.__PICKIT_SAVE_FIRST_FAILURE__",
    );
    throw new Error(
      `SAVE PIPELINE STOPPED at STAGE ${stage} (${name}): ${entry.detail ?? "assertion failed"}`,
    );
  }

  console.info(`[SAVE-ASSERT] OK ${label}`);
}

export function recordRepoInstance(instance: unknown, label: string): void {
  if (typeof window !== "undefined") {
    window.__PICKIT_SAVE_REPO_INSTANCE__ = instance;
  }
  const proto =
    instance && typeof instance === "object"
      ? Object.getPrototypeOf(instance)
      : null;
  console.info("[SAVE-ASSERT] REPOSITORY RUNTIME INSTANCE", {
    label,
    typeof: typeof instance,
    constructorName:
      instance && typeof instance === "object"
        ? (instance as { constructor?: { name?: string } }).constructor?.name
        : undefined,
    prototypeName: proto?.constructor?.name,
    implementationTag: (instance as { __pickItImplementation?: string } | null)
      ?.__pickItImplementation,
    instanceId: (instance as { __pickItInstanceId?: string } | null)
      ?.__pickItInstanceId,
    keys:
      instance && typeof instance === "object" ? Object.keys(instance) : [],
    recommendationsTag: (
      instance as {
        recommendations?: { __pickItImplementation?: string };
      } | null
    )?.recommendations?.__pickItImplementation,
  });
}
