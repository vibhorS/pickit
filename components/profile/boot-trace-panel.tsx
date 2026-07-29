"use client";

/**
 * TEMPORARY — Boot-sequence byCollection diagnosis.
 * Remove with lib/debug/boot-trace.ts after the refresh-loss bug is proven/fixed.
 *
 * Always mounts a visible chrome (title + Surface). Inner dump body is
 * isolated so a dump render error cannot unmount the panel shell.
 */

import { Component, type ReactNode } from "react";
import { isFullDumpStage, useBootTraceStore } from "@/lib/debug/boot-trace";
import { Surface } from "@/components/ui/surface";

const REQUIRED_STAGE_MATCHERS: Array<{
  label: string;
  match: (s: string) => boolean;
}> = [
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

class BootTraceBodyErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message || String(error) };
  }

  render() {
    if (this.state.error) {
      return (
        <p className="font-mono text-[11px] text-red-300">
          Boot Trace body error: {this.state.error}
        </p>
      );
    }
    return this.props.children;
  }
}

function BootTraceBody() {
  const bootStartedAt = useBootTraceStore((s) => s.bootStartedAt);
  const stages = useBootTraceStore((s) => s.stages);
  const uiDumps = useBootTraceStore((s) => s.uiDumps);
  const firstIncorrectStage = useBootTraceStore((s) => s.firstIncorrectStage);
  const firstIncorrectReason = useBootTraceStore(
    (s) => s.firstIncorrectReason,
  );

  const dumpStages = stages.filter((stage) => isFullDumpStage(stage.stage));

  if (!bootStartedAt && uiDumps.length === 0) {
    return (
      <p className="text-xs text-zinc-600">
        Waiting for CloudDataProvider.boot()… Panel is mounted.
      </p>
    );
  }

  return (
    <>
      <div
        className={`rounded-lg border p-3 text-xs ${
          firstIncorrectStage
            ? "border-red-500/40 bg-red-950/30"
            : "border-emerald-500/30 bg-emerald-950/20"
        }`}
      >
        <p className="font-medium text-zinc-300">First incorrect stage</p>
        <p
          className={
            firstIncorrectStage
              ? "mt-1 font-mono text-[11px] text-red-200"
              : "mt-1 font-mono text-[11px] text-emerald-300"
          }
        >
          {firstIncorrectStage ?? "NONE (yet)"}
        </p>
        {firstIncorrectReason ? (
          <p className="mt-1 font-mono text-[10px] text-red-300/90">
            {firstIncorrectReason}
          </p>
        ) : null}
      </div>

      {REQUIRED_STAGE_MATCHERS.map(({ label, match }) => {
        const matched = dumpStages.filter((stage) => match(stage.stage));
        return (
          <div key={label} className="space-y-2">
            <p className="text-[11px] font-semibold text-zinc-300">{label}</p>
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
                    +{stage.msSinceBoot}ms · {stage.operation} · {stage.stage}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-amber-200/90">
                    raw keys: {stage.rawKeyCount ?? stage.rawKeys?.length ?? 0}{" "}
                    · dump collections: {stage.fullDump?.length ?? 0}
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
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-zinc-200">
                    {stage.fullDumpText ?? "(no dump text)"}
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
              +{stage.msSinceBoot}ms · rawKeys=
              {stage.rawKeyCount ?? stage.rawKeys?.length ?? 0} · dump=
              {stage.fullDump?.length ?? 0} · {stage.stage}
            </div>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-zinc-200">
              {stage.fullDumpText ?? "(no dump text)"}
            </pre>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-zinc-300">
          UI: useCollectionStatsList / CollectionCard / Home
        </p>
        {uiDumps.length === 0 ? (
          <p className="text-xs text-zinc-600">
            Open Home or Collections to populate.
          </p>
        ) : (
          uiDumps.map((dump) => (
            <div
              key={`${dump.stage}-${dump.atMs}`}
              className="rounded-lg border border-zinc-800 bg-black/20 p-3"
            >
              <div className="font-mono text-[10px] text-zinc-400">
                +{dump.msSinceBoot}ms · {dump.stage} · rows=
                {dump.rows?.length ?? 0}
              </div>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-zinc-200">
                {dump.text}
              </pre>
            </div>
          ))
        )}
      </div>
    </>
  );
}

/** Always visible on Profile — title + Surface never unmount. */
export function BootTracePanel() {
  return (
    <div className="space-y-3" data-testid="boot-trace-panel">
      <h3 className="text-sm font-semibold text-zinc-200">Boot Trace</h3>
      <p className="text-[11px] text-zinc-500">
        Complete byCollection dump after load / merge / refresh. Console:
        [BOOT-TRACE]
      </p>
      <Surface className="space-y-4 p-3">
        <BootTraceBodyErrorBoundary>
          <BootTraceBody />
        </BootTraceBodyErrorBoundary>
      </Surface>
    </div>
  );
}
