"use client";

/**
 * TEMPORARY — Boot-sequence byCollection diagnosis.
 * Remove with lib/debug/boot-trace.ts after the refresh-loss bug is proven/fixed.
 */

import { isFullDumpStage, useBootTraceStore } from "@/lib/debug/boot-trace";
import { Surface } from "@/components/ui/surface";

export function BootTracePanel() {
  const snap = useBootTraceStore();
  const dumpStages = snap.stages.filter(
    (stage) => isFullDumpStage(stage.stage) || stage.fullDump.length > 0,
  );

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-200">
        Boot Trace (byCollection)
      </h3>
      <p className="text-[11px] text-zinc-500">
        Full structured dump: every collection after load / merge / refresh,
        then useCollectionStatsList + CollectionCard / Home card props. Console:
        [BOOT-TRACE] / [BOOT-TRACE-UI].
      </p>

      <Surface className="space-y-3 p-3">
        {!snap.bootStartedAt && snap.uiDumps.length === 0 ? (
          <p className="text-xs text-zinc-600">
            Waiting for CloudDataProvider.boot() or Home/Collections render…
          </p>
        ) : (
          <>
            <div
              className={`rounded-lg border p-3 text-xs ${
                snap.firstIncorrectStage
                  ? "border-red-500/40 bg-red-950/30"
                  : "border-emerald-500/30 bg-emerald-950/20"
              }`}
            >
              <p className="font-medium text-zinc-300">First incorrect stage</p>
              <p
                className={
                  snap.firstIncorrectStage
                    ? "mt-1 font-mono text-[11px] text-red-200"
                    : "mt-1 font-mono text-[11px] text-emerald-300"
                }
              >
                {snap.firstIncorrectStage ?? "NONE (yet)"}
              </p>
              {snap.firstIncorrectReason ? (
                <p className="mt-1 font-mono text-[10px] text-red-300/90">
                  {snap.firstIncorrectReason}
                </p>
              ) : null}
            </div>

            <div className="space-y-4">
              <p className="text-[11px] font-medium text-zinc-400">
                1–3. byCollection after load / merge / refresh
              </p>
              {dumpStages.map((stage, index) => (
                <div
                  key={`${stage.stage}-${stage.atMs}-${index}`}
                  className={`rounded-lg border p-3 ${
                    stage.incorrect
                      ? "border-red-500/40 bg-red-950/30"
                      : "border-zinc-800 bg-black/20"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[10px]">
                    <span className="text-zinc-500">+{stage.msSinceBoot}ms</span>
                    <span className="text-amber-200/90">{stage.operation}</span>
                    <span className="font-medium text-zinc-200">
                      {stage.stage}
                    </span>
                  </div>
                  {stage.detail ? (
                    <p className="mt-1 font-mono text-[10px] text-zinc-500">
                      {stage.detail}
                    </p>
                  ) : null}
                  {stage.incorrectReason ? (
                    <p className="mt-1 font-mono text-[10px] text-red-300">
                      ✗ {stage.incorrectReason}
                    </p>
                  ) : null}
                  <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-zinc-300">
                    {stage.fullDumpText || "byCollection = {}\n(no collections)"}
                  </pre>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <p className="text-[11px] font-medium text-zinc-400">
                4–5. useCollectionStatsList → CollectionCard / Home card
              </p>
              {snap.uiDumps.length === 0 ? (
                <p className="text-xs text-zinc-600">
                  Open Home or Collections to populate UI dumps.
                </p>
              ) : (
                snap.uiDumps.map((dump) => (
                  <div
                    key={`${dump.stage}-${dump.atMs}`}
                    className="rounded-lg border border-zinc-800 bg-black/20 p-3"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[10px]">
                      <span className="text-zinc-500">+{dump.msSinceBoot}ms</span>
                      <span className="text-amber-200/90">UI</span>
                      <span className="font-medium text-zinc-200">
                        {dump.stage}
                      </span>
                    </div>
                    <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-zinc-300">
                      {dump.text}
                    </pre>
                  </div>
                ))
              )}
            </div>

            <details>
              <summary className="cursor-pointer text-[11px] text-zinc-500">
                All boot stages ({snap.stages.length})
              </summary>
              <ul className="mt-2 space-y-1 font-mono text-[10px] text-zinc-500">
                {snap.stages.map((stage, index) => (
                  <li key={`all-${stage.atMs}-${index}`}>
                    +{stage.msSinceBoot}ms [{stage.operation}] {stage.stage}
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </Surface>
    </div>
  );
}
