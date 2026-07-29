"use client";

/**
 * TEMPORARY — Boot-sequence byCollection diagnosis.
 * Remove with lib/debug/boot-trace.ts after the refresh-loss bug is proven/fixed.
 *
 * Renders the COMPLETE byCollection object for every dump stage.
 * Never focuses a single collection key.
 */

import { isFullDumpStage, useBootTraceStore } from "@/lib/debug/boot-trace";
import { Surface } from "@/components/ui/surface";

const REQUIRED_STAGE_MATCHERS: Array<{ label: string; match: (s: string) => boolean }> = [
  {
    label: "1. loadCloudSnapshot()",
    match: (s) =>
      s.includes("byCollection built") ||
      s.includes("snapshot.byCollection (cloud payload)"),
  },
  {
    label: "2. mergeCloudSnapshot() BEFORE",
    match: (s) => s.includes("mergeCloudSnapshot: BEFORE"),
  },
  {
    label: "3. mergeCloudSnapshot() AFTER",
    match: (s) =>
      s.includes("mergeCloudSnapshot: AFTER") ||
      s.includes("mergeCloudSnapshot() / applyCloudSnapshot"),
  },
  {
    label: "4. refreshFromCloud()",
    match: (s) => s.toLowerCase().includes("refreshfromcloud"),
  },
];

export function BootTracePanel() {
  const snap = useBootTraceStore();
  const dumpStages = snap.stages.filter((stage) =>
    isFullDumpStage(stage.stage),
  );

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-200">
        Boot Trace — COMPLETE byCollection
      </h3>
      <p className="text-[11px] text-zinc-500">
        Prints EVERY collection in byCollection. No focus key. No collapse.
        Console: [BOOT-TRACE]
      </p>

      <Surface className="space-y-4 p-3">
        {!snap.bootStartedAt && snap.uiDumps.length === 0 ? (
          <p className="text-xs text-zinc-600">
            Waiting for CloudDataProvider.boot()…
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

            {REQUIRED_STAGE_MATCHERS.map(({ label, match }) => {
              const matched = dumpStages.filter((stage) => match(stage.stage));
              return (
                <div key={label} className="space-y-2">
                  <p className="text-[11px] font-semibold text-zinc-300">
                    {label}
                  </p>
                  {matched.length === 0 ? (
                    <p className="font-mono text-[10px] text-zinc-600">
                      (not recorded yet)
                    </p>
                  ) : (
                    matched.map((stage, index) => (
                      <div
                        key={`${stage.stage}-${stage.atMs}-${index}`}
                        className={`rounded-lg border p-3 ${
                          stage.incorrect
                            ? "border-red-500/40 bg-red-950/30"
                            : "border-zinc-800 bg-black/20"
                        }`}
                      >
                        <div className="font-mono text-[10px] text-zinc-400">
                          +{stage.msSinceBoot}ms · {stage.operation} ·{" "}
                          {stage.stage}
                        </div>
                        <div className="mt-1 font-mono text-[10px] text-amber-200/90">
                          raw keys: {stage.rawKeyCount} · dump collections:{" "}
                          {stage.fullDump.length}
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
                        {/* No max-height — never clip collections off-screen */}
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-zinc-200">
                          {stage.fullDumpText}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              );
            })}

            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-zinc-300">
                All full-dump stages ({dumpStages.length})
              </p>
              {dumpStages.map((stage, index) => (
                <div
                  key={`all-dump-${stage.atMs}-${index}`}
                  className="rounded-lg border border-zinc-800 bg-black/20 p-3"
                >
                  <div className="font-mono text-[10px] text-zinc-400">
                    +{stage.msSinceBoot}ms · rawKeys={stage.rawKeyCount} ·
                    dump={stage.fullDump.length} · {stage.stage}
                  </div>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-zinc-200">
                    {stage.fullDumpText}
                  </pre>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-zinc-300">
                UI: useCollectionStatsList / CollectionCard / Home
              </p>
              {snap.uiDumps.length === 0 ? (
                <p className="text-xs text-zinc-600">
                  Open Home or Collections to populate.
                </p>
              ) : (
                snap.uiDumps.map((dump) => (
                  <div
                    key={`${dump.stage}-${dump.atMs}`}
                    className="rounded-lg border border-zinc-800 bg-black/20 p-3"
                  >
                    <div className="font-mono text-[10px] text-zinc-400">
                      +{dump.msSinceBoot}ms · {dump.stage} · rows=
                      {dump.rows.length}
                    </div>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-zinc-200">
                      {dump.text}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </Surface>
    </div>
  );
}
