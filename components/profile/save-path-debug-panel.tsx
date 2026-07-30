"use client";

/**
 * TEMPORARY — Developer Mode Save-path diagnosis panel.
 * Remove with lib/debug/save-path-debug.ts after the bug is fixed.
 */

import { useMemo, useState } from "react";
import {
  buildSavePathSummary,
  useSavePathDebugStore,
  type CloudIifePersistStep,
  type CloudIifePostMovieAwait,
  type SavePathStep,
} from "@/lib/debug/save-path-debug";
import { Surface } from "@/components/ui/surface";

function truncateId(id: string | null): string {
  if (!id) return "—";
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}

function lastCompletedAwaitedStep(
  steps: CloudIifePersistStep[],
): CloudIifePersistStep | null {
  const completed = steps.filter(
    (s) =>
      s.step !== "8. catch block entered" &&
      s.step !== "9. final exception",
  );
  return completed.length > 0 ? completed[completed.length - 1]! : null;
}

function lastCompletedPostMovieAwait(
  awaits: CloudIifePostMovieAwait[],
): CloudIifePostMovieAwait | null {
  const completed = awaits.filter((a) => a.phase === "completed");
  return completed.length > 0 ? completed[completed.length - 1]! : null;
}

function resultLabel(step: SavePathStep): string {
  if (step.result === "ok") return "OK";
  if (step.result === "fail") return "FAIL";
  if (step.result === "pending") return "PENDING";
  return "SKIP";
}

function resultClass(step: SavePathStep): string {
  if (step.result === "ok") return "text-emerald-400";
  if (step.result === "fail") return "text-red-400";
  if (step.result === "pending") return "text-amber-300";
  return "text-zinc-500";
}

function TimelineRow({ step }: { step: SavePathStep }) {
  const [stackOpen, setStackOpen] = useState(false);
  const isNetwork = step.network != null;

  return (
    <li className="border-b border-zinc-800 py-2 last:border-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
        <span className="font-mono text-[10px] text-zinc-500">
          +{step.msSinceSave}ms
        </span>
        <span className="font-medium text-zinc-200">{step.name}</span>
        <span className={resultClass(step)}>{resultLabel(step)}</span>
        {step.durationMs != null ? (
          <span className="text-[10px] text-zinc-500">
            {step.durationMs}ms
          </span>
        ) : null}
      </div>
      <div className="mt-0.5 font-mono text-[10px] text-zinc-500">
        id={step.recommendationId ?? "—"} · object={step.objectId ?? "—"} ·
        sameAsBirth=
        {step.sameAsBirth === null
          ? "—"
          : step.sameAsBirth
            ? "YES"
            : "NO"}
      </div>

      {step.error ? (
        <div className="mt-1 space-y-0.5 rounded bg-red-950/40 p-2 text-[10px]">
          <p className="text-red-300">
            <span className="text-zinc-500">Error type:</span> {step.error.type}
          </p>
          <p className="text-red-200">
            <span className="text-zinc-500">Message:</span> {step.error.message}
          </p>
          {step.error.stack ? (
            <div>
              <button
                type="button"
                className="text-zinc-400 underline-offset-2 hover:underline"
                onClick={() => setStackOpen((v) => !v)}
              >
                {stackOpen ? "Hide stack" : "Show stack"}
              </button>
              {stackOpen ? (
                <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-zinc-500">
                  {step.error.stack}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {isNetwork && step.network ? (
        <div className="mt-1 space-y-1 rounded bg-black/40 p-2 text-[10px] text-zinc-400">
          <p>
            HTTP status:{" "}
            <span className="text-zinc-200">
              {step.network.httpStatus ?? "—"}
            </span>
            {" · "}
            Request duration:{" "}
            <span className="text-zinc-200">
              {step.network.durationMs != null
                ? `${step.network.durationMs}ms`
                : "—"}
            </span>
          </p>
          <details>
            <summary className="cursor-pointer text-zinc-500">
              Request payload
            </summary>
            <pre className="mt-1 max-h-28 overflow-auto text-zinc-300">
              {JSON.stringify(step.network.requestPayload, null, 2)}
            </pre>
          </details>
          <details>
            <summary className="cursor-pointer text-zinc-500">
              Response payload
            </summary>
            <pre className="mt-1 max-h-28 overflow-auto text-zinc-300">
              {JSON.stringify(step.network.responsePayload, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </li>
  );
}

export function SavePathDebugPanel() {
  const snap = useSavePathDebugStore();
  const summary = useMemo(() => buildSavePathSummary(snap), [snap]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-200">
        Save Path Diagnosis
      </h3>
      <p className="text-[11px] text-zinc-500">
        Clears automatically on each Save. Answers which path ran without
        opening DevTools.
      </p>

      <Surface className="space-y-3 p-3">
        {!snap.startedAt ? (
          <p className="text-xs text-zinc-600">
            Waiting for Save… Click Save recommendations to populate.
          </p>
        ) : (
          <>
            <div
              className={`space-y-1 rounded-lg border p-3 text-xs ${
                summary.rootFailure
                  ? "border-red-500/40 bg-red-950/30"
                  : summary.writeSucceeded
                    ? "border-emerald-500/30 bg-emerald-950/20"
                    : "border-zinc-700 bg-black/20"
              }`}
            >
              <p className="font-medium text-zinc-300">Summary</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[11px]">
                <dt className="text-zinc-500">Save Path:</dt>
                <dd className="text-zinc-100">{summary.savePath}</dd>
                <dt className="text-zinc-500">Why stopped:</dt>
                <dd
                  className={
                    summary.stopReason
                      ? "font-semibold text-red-300"
                      : "text-emerald-400"
                  }
                >
                  {summary.stopReason ?? "Did not stop before upsert"}
                </dd>
                <dt className="text-zinc-500">Root failure:</dt>
                <dd
                  className={
                    summary.rootFailure
                      ? "font-semibold text-red-300"
                      : "text-emerald-400"
                  }
                >
                  {summary.rootFailure ?? "NONE"}
                </dd>
                <dt className="text-zinc-500">Birth ID:</dt>
                <dd className="text-zinc-100">
                  {truncateId(summary.birthId)}
                  {summary.birthId && summary.birthId.length > 12 ? (
                    <span className="ml-1 text-zinc-600">
                      ({summary.birthId})
                    </span>
                  ) : null}
                </dd>
                <dt className="text-zinc-500">ID changed:</dt>
                <dd
                  className={
                    summary.idChanged ? "text-amber-300" : "text-emerald-400"
                  }
                >
                  {summary.idChanged ? "YES" : "NO"}
                </dd>
                <dt className="text-zinc-500">Supabase called:</dt>
                <dd className="text-zinc-100">
                  {summary.supabaseCalled ? "YES" : "NO"}
                </dd>
                <dt className="text-zinc-500">Response:</dt>
                <dd className="text-zinc-100">{summary.responseLabel}</dd>
              </dl>
              {snap.firstExit ? (
                <div className="mt-2 space-y-0.5 border-t border-red-500/20 pt-2 font-mono text-[10px] text-red-200/90">
                  <p>
                    Exit kind: {snap.firstExit.kind} · {snap.firstExit.file}:
                    {snap.firstExit.line} · {snap.firstExit.functionName}
                  </p>
                  {snap.firstExit.returnValue != null ? (
                    <pre className="max-h-24 overflow-auto text-zinc-400">
                      returnValue={JSON.stringify(snap.firstExit.returnValue, null, 2)}
                    </pre>
                  ) : null}
                  {snap.firstExit.error ? (
                    <p>
                      thrown: {snap.firstExit.error.type}:{" "}
                      {snap.firstExit.error.message}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-medium text-zinc-300">
                After movies.upsert → recommendations.upsert
              </p>
              {snap.cloudIifePostMovieAwaits.length === 0 ? (
                <p className="text-zinc-600">
                  Waiting for movies.upsert to complete…
                </p>
              ) : (
                <>
                  {(() => {
                    const last = lastCompletedPostMovieAwait(
                      snap.cloudIifePostMovieAwaits,
                    );
                    const failed = snap.cloudIifePostMovieAwaits.some(
                      (a) => a.phase === "threw",
                    );
                    const threw = [...snap.cloudIifePostMovieAwaits]
                      .reverse()
                      .find((a) => a.phase === "threw");
                    return (
                      <div
                        className={`rounded-lg border p-3 font-mono text-[11px] ${
                          failed
                            ? "border-red-500/40 bg-red-950/30"
                            : "border-emerald-500/30 bg-emerald-950/20"
                        }`}
                      >
                        <p className="font-medium text-zinc-200">
                          LAST successfully completed await
                        </p>
                        <p
                          className={
                            failed
                              ? "mt-1 font-semibold text-red-200"
                              : "mt-1 font-semibold text-emerald-300"
                          }
                        >
                          {last
                            ? `${last.awaitLabel} · ${last.phase}`
                            : "(none)"}
                        </p>
                        {last ? (
                          <p className="mt-1 text-[10px] text-zinc-400">
                            timestamp={last.at}
                            {" · "}collectionId={last.collectionId}
                            {" · "}movieId={last.movieId}
                            {" · "}recommendationId=
                            {last.recommendationId ?? "—"}
                          </p>
                        ) : null}
                        {threw ? (
                          <p className="mt-2 text-[10px] text-red-300">
                            First threw: {threw.awaitLabel}
                            {threw.exception
                              ? ` — ${threw.exception.type}: ${threw.exception.message}`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                    );
                  })()}
                  <ul className="space-y-2">
                    {snap.cloudIifePostMovieAwaits.map((event, index) => {
                      const isThrow = event.phase === "threw";
                      return (
                        <li
                          key={`${event.awaitLabel}-${event.phase}-${event.atMs}-${index}`}
                          className={`rounded border p-2 font-mono text-[10px] ${
                            isThrow
                              ? "border-red-500/40 bg-red-950/20"
                              : event.phase === "completed"
                                ? "border-emerald-500/20 bg-emerald-950/10"
                                : "border-zinc-800 bg-black/20"
                          }`}
                        >
                          <p
                            className={
                              isThrow
                                ? "font-semibold text-red-200"
                                : event.phase === "completed"
                                  ? "font-semibold text-emerald-300"
                                  : "font-semibold text-amber-200"
                            }
                          >
                            [{event.phase}] {event.awaitLabel}
                          </p>
                          <p className="mt-0.5 text-zinc-500">
                            timestamp: {event.at}
                          </p>
                          <p className="text-zinc-400">
                            collectionId: {event.collectionId}
                          </p>
                          <p className="text-zinc-400">
                            movieId: {event.movieId}
                          </p>
                          <p className="text-zinc-400">
                            recommendationId: {event.recommendationId ?? "—"}
                          </p>
                          {event.exception ? (
                            <div className="mt-1 space-y-0.5 text-red-300">
                              <p>
                                exception: {event.exception.type}:{" "}
                                {event.exception.message}
                              </p>
                              {event.exception.stack ? (
                                <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-red-300/80">
                                  {event.exception.stack}
                                </pre>
                              ) : null}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-medium text-zinc-300">
                Cloud persistence IIFE
              </p>
              {snap.cloudIifeSteps.length === 0 ? (
                <p className="text-zinc-600">
                  Waiting for cloud IIFE… (local add may still be in flight)
                </p>
              ) : (
                <>
                  {(() => {
                    const last = lastCompletedAwaitedStep(snap.cloudIifeSteps);
                    const failed = snap.cloudIifeSteps.some(
                      (s) =>
                        s.step === "8. catch block entered" ||
                        s.step === "9. final exception",
                    );
                    return (
                      <div
                        className={`rounded-lg border p-3 font-mono text-[11px] ${
                          failed
                            ? "border-red-500/40 bg-red-950/30"
                            : "border-emerald-500/30 bg-emerald-950/20"
                        }`}
                      >
                        <p className="font-medium text-zinc-200">
                          LAST completed awaited statement
                        </p>
                        <p
                          className={
                            failed
                              ? "mt-1 font-semibold text-red-200"
                              : "mt-1 font-semibold text-emerald-300"
                          }
                        >
                          {last?.step ?? "(none)"}
                        </p>
                        {last ? (
                          <p className="mt-1 text-[10px] text-zinc-400">
                            at={last.at}
                            {" · "}collectionId={last.collectionId}
                            {" · "}movieId={last.movieId}
                            {" · "}recommendationId=
                            {last.recommendationId ?? "—"}
                          </p>
                        ) : null}
                      </div>
                    );
                  })()}
                  <ul className="space-y-2">
                    {snap.cloudIifeSteps.map((step, index) => {
                      const isCatch =
                        step.step === "8. catch block entered" ||
                        step.step === "9. final exception";
                      return (
                        <li
                          key={`${step.step}-${step.atMs}-${index}`}
                          className={`rounded border p-2 font-mono text-[10px] ${
                            isCatch
                              ? "border-red-500/40 bg-red-950/20"
                              : "border-zinc-800 bg-black/20"
                          }`}
                        >
                          <p
                            className={
                              isCatch
                                ? "font-semibold text-red-200"
                                : "font-semibold text-zinc-200"
                            }
                          >
                            {step.step}
                          </p>
                          <p className="mt-0.5 text-zinc-500">
                            timestamp: {step.at}
                          </p>
                          <p className="text-zinc-400">
                            collectionId: {step.collectionId}
                          </p>
                          <p className="text-zinc-400">
                            movieId: {step.movieId}
                          </p>
                          <p className="text-zinc-400">
                            recommendationId: {step.recommendationId ?? "—"}
                          </p>
                          {step.error ? (
                            <div className="mt-1 space-y-0.5 text-red-300">
                              <p>
                                exception: {step.error.type}:{" "}
                                {step.error.message}
                              </p>
                              {step.error.stack ? (
                                <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-red-300/80">
                                  {step.error.stack}
                                </pre>
                              ) : null}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>

            {snap.collectionPipeline ? (
              <div className="space-y-2 text-xs">
                <p className="font-medium text-zinc-400">
                  Collection ID pipeline
                </p>
                <div
                  className={`rounded-lg border p-3 font-mono text-[10px] ${
                    snap.collectionPipeline.firstDivergence
                      ? "border-red-500/40 bg-red-950/30 text-red-200"
                      : "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                  }`}
                >
                  First divergence:{" "}
                  {snap.collectionPipeline.firstDivergence ?? "NONE"}
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[10px]">
                  <dt className="text-zinc-500">selectedCollectionIds</dt>
                  <dd className="text-zinc-200">
                    {JSON.stringify(
                      snap.collectionPipeline.selectedCollectionIds,
                    )}
                  </dd>
                  <dt className="text-zinc-500">createNames</dt>
                  <dd className="text-zinc-200">
                    {JSON.stringify(
                      snap.collectionPipeline.createCollectionNames,
                    )}
                  </dd>
                  <dt className="text-zinc-500">afterCreateResolve</dt>
                  <dd className="text-zinc-200">
                    {JSON.stringify(
                      snap.collectionPipeline.afterCreateResolve,
                    )}
                  </dd>
                  <dt className="text-zinc-500">afterMembershipFilter</dt>
                  <dd className="text-zinc-200">
                    {JSON.stringify(
                      snap.collectionPipeline.afterMembershipFilter,
                    )}
                  </dd>
                  <dt className="text-zinc-500">added</dt>
                  <dd className="text-zinc-200">
                    {JSON.stringify(snap.collectionPipeline.added)}
                  </dd>
                  <dt className="text-zinc-500">already</dt>
                  <dd className="text-zinc-200">
                    {JSON.stringify(snap.collectionPipeline.already)}
                  </dd>
                  <dt className="text-zinc-500">list_ids written</dt>
                  <dd className="text-zinc-200">
                    {JSON.stringify(snap.collectionPipeline.listIdsWritten)}
                  </dd>
                </dl>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left font-mono text-[10px]">
                    <thead>
                      <tr className="text-zinc-500">
                        <th className="pr-2">name</th>
                        <th className="pr-2">id</th>
                        <th className="pr-2">source</th>
                        <th className="pr-2">sel</th>
                        <th className="pr-2">memb</th>
                        <th className="pr-2">added</th>
                        <th className="pr-2">already</th>
                        <th>written</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snap.collectionPipeline.uiSelected.map((ref) => (
                        <tr
                          key={ref.collectionId}
                          className="border-t border-zinc-800 text-zinc-300"
                        >
                          <td className="pr-2 py-0.5">{ref.displayName}</td>
                          <td className="pr-2 py-0.5">
                            {truncateId(ref.collectionId)}
                          </td>
                          <td className="pr-2 py-0.5 text-zinc-500">
                            {ref.source}
                          </td>
                          <td className="pr-2 py-0.5">
                            {ref.inSelectedIds || ref.inCreateNames
                              ? "Y"
                              : "—"}
                          </td>
                          <td className="pr-2 py-0.5">
                            {ref.afterMembershipFilter ? "Y" : "N"}
                          </td>
                          <td className="pr-2 py-0.5">
                            {ref.inAdded ? "Y" : "N"}
                          </td>
                          <td className="pr-2 py-0.5">
                            {ref.inAlready ? "Y" : "N"}
                          </td>
                          <td className="py-0.5">
                            {ref.listIdWritten ? "Y" : "N"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <details>
                  <summary className="cursor-pointer text-zinc-500">
                    Home vs Capture catalogs
                  </summary>
                  <pre className="mt-1 max-h-40 overflow-auto text-[10px] text-zinc-400">
                    {JSON.stringify(
                      {
                        home: snap.collectionPipeline.homeCatalog,
                        capture: snap.collectionPipeline.captureCatalog,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </div>
            ) : null}

            <div className="text-xs">
              <p className="mb-1 font-medium text-zinc-400">
                addMovieToCollections branch flow
              </p>
              {snap.branches.length === 0 ? (
                <p className="text-zinc-600">No branch events yet</p>
              ) : (
                <ul className="space-y-1">
                  {snap.branches.map((branch, index) => (
                    <li
                      key={`${branch.label}-${branch.atMs}-${index}`}
                      className="font-mono text-[10px]"
                    >
                      <span className="text-zinc-600">+{branch.msSinceSave}ms</span>{" "}
                      <span
                        className={
                          branch.outcome === "passed" ||
                          branch.outcome === "entered" ||
                          branch.outcome === "await"
                            ? "text-emerald-400"
                            : branch.outcome === "failed" ||
                                branch.outcome === "throw" ||
                                branch.outcome === "catch" ||
                                branch.outcome === "return"
                              ? "text-red-300"
                              : "text-zinc-300"
                        }
                      >
                        [{branch.outcome}]
                      </span>{" "}
                      <span className="text-zinc-200">{branch.label}</span>
                      {branch.detail ? (
                        <span className="block pl-4 text-zinc-500">
                          {branch.detail}
                        </span>
                      ) : null}
                      {index < snap.branches.length - 1 ? (
                        <span className="block pl-2 text-zinc-700">↓</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="text-xs">
              <p className="mb-1 font-medium text-zinc-400">Timeline</p>
              {snap.steps.length === 0 ? (
                <p className="text-zinc-600">No stages recorded yet</p>
              ) : (
                <ul>
                  {snap.steps.map((step, index) => (
                    <TimelineRow
                      key={`${step.name}-${step.atMs}-${index}`}
                      step={step}
                    />
                  ))}
                </ul>
              )}
            </div>

            {snap.idChanges.length > 0 ? (
              <div className="text-xs">
                <p className="mb-1 font-medium text-amber-300">ID changes</p>
                <ul className="space-y-1 text-amber-200">
                  {snap.idChanges.map((change, index) => (
                    <li key={`${change.atStep}-${index}`}>
                      at {change.atStep}:{" "}
                      <span className="font-mono">
                        {change.from} → {change.to}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </Surface>
    </div>
  );
}
