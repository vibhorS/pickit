"use client";

/**
 * TEMPORARY — Boot-sequence byCollection diagnosis.
 * Remove with lib/debug/boot-trace.ts after the refresh-loss bug is proven/fixed.
 */

import {
  BOOT_TRACE_FOCUS_PREFIX,
  useBootTraceStore,
} from "@/lib/debug/boot-trace";
import { Surface } from "@/components/ui/surface";

export function BootTracePanel() {
  const snap = useBootTraceStore();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-200">
        Boot Trace (byCollection)
      </h3>
      <p className="text-[11px] text-zinc-500">
        Focus: {BOOT_TRACE_FOCUS_PREFIX}… · Clears on each cloud boot. Open
        console for [BOOT-TRACE] rows.
      </p>

      <Surface className="space-y-3 p-3">
        {!snap.bootStartedAt ? (
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

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left font-mono text-[10px]">
                <thead>
                  <tr className="text-zinc-500">
                    <th className="pr-2 py-1">+ms</th>
                    <th className="pr-2 py-1">Stage</th>
                    <th className="pr-2 py-1">Op</th>
                    <th className="pr-2 py-1">
                      byCollection[{BOOT_TRACE_FOCUS_PREFIX}…]
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {snap.stages.map((stage, index) => (
                    <tr
                      key={`${stage.stage}-${stage.atMs}-${index}`}
                      className={`border-t border-zinc-800 align-top ${
                        stage.incorrect ? "bg-red-950/40" : ""
                      }`}
                    >
                      <td className="pr-2 py-1 text-zinc-600">
                        {stage.msSinceBoot}
                      </td>
                      <td className="pr-2 py-1 text-zinc-200">
                        {stage.stage}
                        {stage.detail ? (
                          <span className="mt-0.5 block text-zinc-500">
                            {stage.detail}
                          </span>
                        ) : null}
                        {stage.incorrectReason ? (
                          <span className="mt-0.5 block text-red-300">
                            ✗ {stage.incorrectReason}
                          </span>
                        ) : null}
                      </td>
                      <td className="pr-2 py-1 text-amber-200/90">
                        {stage.operation}
                      </td>
                      <td className="py-1 text-zinc-300">
                        {stage.focus.collectionId ? (
                          <>
                            <div>
                              movies: [
                              {stage.focus.movieIds.join(", ") || "—"}]
                            </div>
                            <div className="text-zinc-500">
                              titles: [
                              {stage.focus.movieTitles.join(", ") || "—"}]
                            </div>
                            <div className="text-zinc-500">
                              recIds: [
                              {stage.focus.recommendationIds.join(", ") ||
                                "—"}
                              ]
                            </div>
                            {stage.focus.skippedMovieIds.length > 0 ? (
                              <div className="text-red-300">
                                skipped movies: [
                                {stage.focus.skippedMovieIds.join(", ")}]
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-zinc-600">
                            (focus key absent) keys=
                            {stage.byCollectionKeys.length}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Surface>
    </div>
  );
}
