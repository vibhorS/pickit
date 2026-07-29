"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CaptureDropzone,
  CaptureInboxEmpty,
  type CaptureDropPayload,
} from "@/components/capture/intelligence/capture-dropzone";
import { CaptureInbox } from "@/components/capture/intelligence/capture-inbox";
import { CaptureCelebration } from "@/components/capture/intelligence/capture-celebration";
import { CaptureReview } from "@/components/capture/intelligence/capture-review";
import { CaptureThinkingExperience } from "@/components/capture/intelligence/capture-thinking-experience";
import { getCaptureMedia } from "@/lib/capture/intelligence/image-store";
import {
  buildObservation,
  THINKING_STAGES,
  type ThinkingStageId,
} from "@/lib/capture/intelligence/ux-copy";
import type {
  AnalyzeCaptureResponse,
  CaptureItem,
  MatchedRecommendation,
} from "@/lib/capture/intelligence/types";
import { fadeUp, MOTION } from "@/lib/motion";
import { analytics } from "@/lib/observability/analytics";
import { assertStage } from "@/lib/sync/save-assertions";
import {
  buildCollectionRef,
  savePathDebug,
} from "@/lib/debug/save-path-debug";
import type { Collection } from "@/lib/types";
import {
  filterInboxItems,
  useCaptureInboxStore,
} from "@/store/capture-inbox-store";
import { useCollaborationStore } from "@/store/collaboration-store";
import {
  resolveCollectionCatalog,
} from "@/lib/collections/resolve-catalog";
import {
  useLocalCollectionStore,
} from "@/store/local-collection-store";

type View = "home" | "settle" | "thinking" | "review";

type CelebrationState = {
  count: number;
  captureId: string;
  movieIds: string[];
  collectionIds: string[];
};

type CaptureIntelligenceClientProps = {
  seedCollections: Collection[];
};

function friendlyCaptureError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("not configured")) {
    return "Capture AI isn't ready yet. Please try again in a bit.";
  }
  if (lower.includes("too large")) {
    return "That screenshot is too large. Try cropping it and uploading again.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Connection issue while reading your screenshot. Check internet and retry.";
  }
  if (lower.includes("no recommendations")) {
    return "I couldn't find any movie recommendations in this screenshot.";
  }
  return "I couldn't process this screenshot. Try another screenshot or retake it.";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function statusFromStage(stage: ThinkingStageId): CaptureItem["status"] {
  if (stage === "reading") return "reading";
  if (stage === "understanding") return "understanding";
  if (stage === "matching") return "matching";
  return "preparing";
}

export function CaptureIntelligenceClient({
  seedCollections,
}: CaptureIntelligenceClientProps) {
  const items = useCaptureInboxStore((s) => s.items);
  const activeId = useCaptureInboxStore((s) => s.activeId);
  const searchQuery = useCaptureInboxStore((s) => s.searchQuery);
  const statusFilter = useCaptureInboxStore((s) => s.statusFilter);
  const setSearchQuery = useCaptureInboxStore((s) => s.setSearchQuery);
  const setStatusFilter = useCaptureInboxStore((s) => s.setStatusFilter);
  const setActiveId = useCaptureInboxStore((s) => s.setActiveId);
  const createFromMedia = useCaptureInboxStore((s) => s.createFromMedia);
  const updateItem = useCaptureInboxStore((s) => s.updateItem);
  const setMatches = useCaptureInboxStore((s) => s.setMatches);
  const patchMatch = useCaptureInboxStore((s) => s.patchMatch);
  const deleteItem = useCaptureInboxStore((s) => s.deleteItem);
  const archiveItem = useCaptureInboxStore((s) => s.archiveItem);

  const createdCollections = useLocalCollectionStore((s) => s.createdCollections);
  const collectionOverrides = useLocalCollectionStore(
    (s) => s.collectionOverrides,
  );
  const byCollection = useLocalCollectionStore((s) => s.byCollection);
  const addMovieToCollections = useLocalCollectionStore(
    (s) => s.addMovieToCollections,
  );
  const createCollection = useLocalCollectionStore((s) => s.createCollection);
  const removeMovie = useLocalCollectionStore((s) => s.removeMovie);

  const collections = useMemo(
    () =>
      resolveCollectionCatalog(
        seedCollections,
        createdCollections,
        collectionOverrides,
      ),
    [seedCollections, createdCollections, collectionOverrides],
  );

  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<View>("home");
  const [settlePreview, setSettlePreview] = useState<string | null>(null);
  const [stage, setStage] = useState<ThinkingStageId>("reading");
  const [revealedCount, setRevealedCount] = useState(0);
  const [observation, setObservation] = useState(
    "Looking closely at what you captured…",
  );
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<CelebrationState | null>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    const finish = () => {
      if (!useCaptureInboxStore.persist.hasHydrated()) return;
      queueMicrotask(() => setHydrated(true));
    };
    finish();
    return useCaptureInboxStore.persist.onFinishHydration(finish);
  }, []);

  const active = useMemo(
    () => items.find((item) => item.id === activeId) ?? null,
    [items, activeId],
  );

  const filtered = useMemo(
    () => filterInboxItems(items, { searchQuery, statusFilter }),
    [items, searchQuery, statusFilter],
  );

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    void (async () => {
      for (const item of items) {
        if (item.imageDataUrl || item.thumbnailDataUrl) continue;
        try {
          const media = await getCaptureMedia(item.id);
          if (cancelled || !media) continue;
          updateItem(item.id, {
            imageDataUrl: media.fullDataUrl,
            thumbnailDataUrl: media.thumbnailDataUrl,
          });
        } catch {
          // ignore
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const revealMatchesLive = useCallback(
    async (
      itemId: string,
      allMatches: MatchedRecommendation[],
      runId: number,
    ) => {
      setRevealedCount(0);
      for (let i = 0; i < allMatches.length; i += 1) {
        if (runIdRef.current !== runId) return;
        setRevealedCount(i + 1);
        setActiveMatchId(allMatches[i]?.id ?? null);
        const partial = useCaptureInboxStore.getState().getItem(itemId);
        if (partial) {
          setObservation(
            buildObservation(
              {
                ...partial,
                detectedCount: allMatches.length,
              },
              "revealing",
              i + 1,
            ),
          );
        }
        await sleep(260 + Math.min(i * 18, 120));
      }
    },
    [],
  );

  const runPipeline = useCallback(
    async (item: CaptureItem) => {
      const runStartedAt = Date.now();
      const runId = ++runIdRef.current;
      let dataForTelemetry: AnalyzeCaptureResponse | null = null;
      setError(null);
      setActiveId(item.id);
      setRevealedCount(0);
      setActiveMatchId(null);
      setStage("reading");
      setObservation(buildObservation(item, "reading"));

      setView("thinking");

      const gate: {
        result: AnalyzeCaptureResponse | null;
        error: Error | null;
      } = { result: null, error: null };

      const imageForAi =
        item.imageDataUrl ??
        (await getCaptureMedia(item.id).then((m) => m?.fullDataUrl ?? null));

      const analyzePromise = fetch("/api/capture/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: imageForAi ?? undefined,
          text: item.textContent ?? undefined,
          sourceUrl: item.sourceUrl ?? undefined,
          existingCollectionNames: collections.map((c) => c.name),
        }),
      })
        .then(async (response) => {
          const data = (await response.json()) as AnalyzeCaptureResponse & {
            error?: string;
          };
          if (!response.ok) {
            throw new Error(data.error ?? "Capture analysis failed.");
          }
          gate.result = data;
        })
        .catch((err: unknown) => {
          gate.error =
            err instanceof Error ? err : new Error("Something went wrong.");
        });

      try {
        // Intentional stage walk — never skip even if AI finishes early.
        for (const thinking of THINKING_STAGES) {
          if (runIdRef.current !== runId) return;
          setStage(thinking.id);
          updateItem(item.id, {
            status: statusFromStage(thinking.id),
            errorMessage: null,
          });

          const stageStart = Date.now();
          const snapshot = gate.result;

          if (thinking.id === "understanding" && snapshot) {
            setObservation(
              buildObservation(
                {
                  ...item,
                  theme: snapshot.vision.theme,
                  mood: snapshot.vision.mood,
                  headline: snapshot.vision.headline,
                  detectedCount: snapshot.matches.length,
                  source: snapshot.source,
                  vision: snapshot.vision,
                },
                "understanding",
              ),
            );
          } else if (thinking.id === "organizing") {
            const current = useCaptureInboxStore.getState().getItem(item.id);
            setObservation(
              buildObservation(
                current ?? item,
                "organizing",
                current?.matches.length ?? 0,
              ),
            );
          } else if (thinking.id !== "matching") {
            setObservation(buildObservation(item, thinking.id));
          }

          // Kick matching reveal as soon as results exist during matching stage.
          if (thinking.id === "matching") {
            while (!gate.result && !gate.error) {
              if (runIdRef.current !== runId) return;
              await sleep(80);
            }
            if (gate.error) throw gate.error;
            const data = gate.result;
            if (!data) {
              throw new Error("Capture analysis failed.");
            }
            dataForTelemetry = data;

            const matches: MatchedRecommendation[] = data.matches.map(
              (match) => {
                const alreadyInCollectionIds = match.movie
                  ? collections
                      .filter((collection) =>
                        (byCollection[collection.id] ?? []).some(
                          (row) => row.movie.id === match.movie!.id,
                        ),
                      )
                      .map((c) => c.id)
                  : [];
                return { ...match, alreadyInCollectionIds };
              },
            );

            updateItem(item.id, {
              headline: data.vision.headline,
              theme: data.vision.theme,
              mood: data.vision.mood,
              recommendationReason: data.vision.recommendationReason,
              confidence: data.vision.confidence,
              vision: data.vision,
              rawAiOutput: data.rawAiOutput,
              source: data.source,
              suggestedCollectionNames: data.suggestedCollectionNames,
              selectedCollectionIds: collections
                .filter((c) =>
                  data.suggestedCollectionNames.some(
                    (name) => name.toLowerCase() === c.name.toLowerCase(),
                  ),
                )
                .map((c) => c.id),
              createCollectionNames: data.suggestedCollectionNames.filter(
                (name) =>
                  !collections.some(
                    (c) => c.name.toLowerCase() === name.toLowerCase(),
                  ),
              ),
              detectedCount: matches.length,
              matches,
              status: "matching",
            });
            analytics.timing("capture_tmdb_pipeline", Date.now() - runStartedAt, {
              captureId: item.id,
            });

            await revealMatchesLive(item.id, matches, runId);
          }

          const elapsed = Date.now() - stageStart;
          const remaining = thinking.minMs - elapsed;
          if (remaining > 0) await sleep(remaining);
        }

        await analyzePromise;
        if (gate.error) throw gate.error;
        if (runIdRef.current !== runId) return;

        updateItem(item.id, { status: "ready" });
        const readyItem = useCaptureInboxStore.getState().getItem(item.id);
        if (readyItem) {
          setObservation(buildObservation(readyItem, "ready"));
          setRevealedCount(readyItem.matches.length);
        }
        analytics.track("capture_completed", {
          captureId: item.id,
          detectedCount:
            useCaptureInboxStore.getState().getItem(item.id)?.matches.length ??
            0,
          durationMs: Date.now() - runStartedAt,
          extractionSuccess: dataForTelemetry?.reliability?.extractionSuccess,
          extractionCount: dataForTelemetry?.reliability?.extractionCount,
          recoveryPassUsed: dataForTelemetry?.reliability?.recoveryPassUsed,
          tmdbMatchSuccessRate:
            dataForTelemetry?.reliability?.tmdbMatchSuccessRate,
          autoSelectionRate: dataForTelemetry?.reliability?.autoSelectionRate,
          manualReviewRate: dataForTelemetry?.reliability?.manualReviewRate,
          failureReasons:
            dataForTelemetry?.reliability?.failureReasons.join("|") ?? "",
          understandingLatencyMs: (
            dataForTelemetry?.rawAiOutput as
              | { trace?: { timingsMs?: { understanding?: number } } }
              | undefined
          )?.trace?.timingsMs?.understanding,
          tmdbLatencyMs: (
            dataForTelemetry?.rawAiOutput as
              | { trace?: { timingsMs?: { matching?: number } } }
              | undefined
          )?.trace?.timingsMs?.matching,
        });
        analytics.track("review_opened", { captureId: item.id });
        setView("review");
      } catch (err) {
        if (runIdRef.current !== runId) return;
        const message =
          err instanceof Error ? err.message : "Something went wrong.";
        updateItem(item.id, { status: "failed", errorMessage: message });
        setError(friendlyCaptureError(message));
        analytics.track("capture_failed", {
          captureId: item.id,
          reason: message.slice(0, 180),
          durationMs: Date.now() - runStartedAt,
        });
        analytics.error("capture_pipeline_failed", {
          captureId: item.id,
          reason: message.slice(0, 180),
        });
        setView("home");
        setSettlePreview(null);
      }
    },
    [
      byCollection,
      collections,
      revealMatchesLive,
      setActiveId,
      updateItem,
    ],
  );

  const onCapture = async (payload: CaptureDropPayload) => {
    const preview =
      payload.thumbnailDataUrl || payload.imageDataUrl || null;
    setSettlePreview(preview);
    setView("settle");
    setError(null);
    analytics.track("capture_started", {
      method: "screenshot",
      hasImage: Boolean(payload.imageDataUrl),
    });

    // Let the settle animation play — do not jump screens.
    await sleep(920);

    const item = await createFromMedia({
      mediaKind: "screenshot",
      imageDataUrl: payload.imageDataUrl,
      thumbnailDataUrl: payload.thumbnailDataUrl ?? null,
      textContent: null,
      sourceUrl: null,
    });

    setSettlePreview(
      item.thumbnailDataUrl || item.imageDataUrl || preview,
    );
    await runPipeline(item);
  };

  const openItem = (id: string) => {
    const item = items.find((row) => row.id === id);
    if (!item) return;
    setActiveId(id);
    setError(null);
    setSettlePreview(item.thumbnailDataUrl || item.imageDataUrl || null);
    if (
      item.status === "ready" ||
      item.status === "imported" ||
      (item.matches.length > 0 && item.status !== "failed")
    ) {
      setRevealedCount(item.matches.length);
      setObservation(buildObservation(item, "ready"));
      setView("review");
      analytics.track("review_opened", { captureId: item.id, fromInbox: true });
      return;
    }
    void runPipeline(item);
  };

  const onImport = () => {
    savePathDebug.mark("onImport");
    console.error("CALLGRAPH ✓ onImport entered", {
      file: "components/capture/intelligence/capture-intelligence-client.tsx",
    });
    console.info("STAGE 2: Save handler entered");
    try {
      assertStage(
        2,
        "Save handler entered",
        Boolean(active),
        active
          ? JSON.stringify({
              captureId: active.id,
              selectedCollectionIds: active.selectedCollectionIds,
              createCollectionNames: active.createCollectionNames,
              selectedMatches: active.matches.filter(
                (m) => m.selected && !m.rejected && m.movie,
              ).length,
            })
          : "active capture is null — handler aborted",
      );
    } catch (err) {
      console.error("[SAVE-ASSERT] stopped in onImport stage 2", err);
      return;
    }

    if (!active) return;
    setImporting(true);
    try {
      const seedIds = new Set(seedCollections.map((c) => c.id));
      const createdIds = new Set(createdCollections.map((c) => c.id));
      const memberships = useCollaborationStore.getState().memberships;
      const activeUserId = useCollaborationStore.getState().activeUserId;

      const homeCatalog = collections
        .filter((collection) => {
          const collectionMemberships = memberships.filter(
            (m) => m.collectionId === collection.id,
          );
          return (
            collectionMemberships.length === 0 ||
            collectionMemberships.some((m) => m.userId === activeUserId)
          );
        })
        .map((c) => ({
          id: c.id,
          name: c.name,
          source: seedIds.has(c.id)
            ? "seed-mock"
            : c.id.startsWith("demo-") || c.id.startsWith("collection-")
              ? "cloud-hydrated"
              : "created-local",
        }));

      const captureCatalog = collections.map((c) => ({
        id: c.id,
        name: c.name,
        source: seedIds.has(c.id)
          ? "seed-mock"
          : c.id.startsWith("demo-") || c.id.startsWith("collection-")
            ? "cloud-hydrated"
            : "created-local",
      }));

      const uiSelected = [
        ...active.selectedCollectionIds.map((id) => {
          const c = collections.find((row) => row.id === id);
          return buildCollectionRef({
            id,
            name: c?.name ?? `(missing:${id})`,
            emoji: c?.emoji,
            seedIds,
            createdIds,
            flags: { inSelectedIds: true, afterResolve: true },
          });
        }),
        ...active.createCollectionNames.map((name) =>
          buildCollectionRef({
            id: `pending-create:${name}`,
            name,
            seedIds,
            createdIds,
            flags: { inCreateNames: true },
          }),
        ),
      ];

      savePathDebug.setCollectionPipeline({
        uiSelected,
        selectedCollectionIds: [...active.selectedCollectionIds],
        createCollectionNames: [...active.createCollectionNames],
        afterCreateResolve: [],
        afterMembershipFilter: [],
        added: [],
        already: [],
        listIdsWritten: [],
        homeCatalog,
        captureCatalog,
        firstDivergence: null,
      });

      const collectionIds = [...active.selectedCollectionIds];
      for (const name of active.createCollectionNames) {
        const created = createCollection(name);
        collectionIds.push(created.id);
        savePathDebug.patchCollectionPipeline({
          uiSelected: [
            ...uiSelected.filter((r) => r.collectionId !== `pending-create:${name}`),
            buildCollectionRef({
              id: created.id,
              name: created.name,
              emoji: created.emoji,
              seedIds,
              createdIds: new Set([...createdIds, created.id]),
              flags: {
                inCreateNames: true,
                afterResolve: true,
              },
            }),
          ],
        });
      }
      const uniqueIds = Array.from(new Set(collectionIds));
      savePathDebug.patchCollectionPipeline({
        afterCreateResolve: uniqueIds,
      });
      console.info("STAGE 2b: Collections resolved", { uniqueIds });
      if (uniqueIds.length === 0) {
        console.error(
          "[SAVE-ASSERT] FIRST FAILURE after STAGE 2: no collection IDs — Repository.save path will never run",
        );
        throw new Error(
          "SAVE PIPELINE STOPPED: no collection IDs resolved",
        );
      }
      const imported: string[] = [];
      for (const match of active.matches) {
        if (!match.selected || match.rejected || !match.movie) continue;
        addMovieToCollections(uniqueIds, match.movie, active.source, {
          sourcePlatform: active.source.type,
          sourceUrl: active.sourceUrl ?? undefined,
          notes: active.recommendationReason ?? undefined,
          captureMethod: "capture-intelligence",
          savedAt: new Date().toISOString(),
        });
        imported.push(match.movie.id);
      }
      console.info("STAGE 2c: Movies handed to store", { imported });
      if (imported.length === 0) {
        console.error(
          "[SAVE-ASSERT] FIRST FAILURE after STAGE 2: no selected movies — Repository.save path will never run",
        );
        throw new Error(
          "SAVE PIPELINE STOPPED: no selected matches to persist",
        );
      }
      updateItem(active.id, {
        status: "imported",
        importedMovieIds: imported,
        importedAt: new Date().toISOString(),
        selectedCollectionIds: uniqueIds,
        createCollectionNames: [],
      });
      analytics.track("recommendation_imported", {
        captureId: active.id,
        importedCount: imported.length,
        collectionCount: uniqueIds.length,
      });
      setCelebration({
        count: imported.length,
        captureId: active.id,
        movieIds: imported,
        collectionIds: uniqueIds,
      });
      // STAGE 10 is asserted only after Supabase insert returns (see cloud repo / store).
      console.info(
        "[SAVE-ASSERT] Local UI celebration shown — awaiting STAGE 3–9 from cloud path",
      );
    } catch (err) {
      console.error("[SAVE-ASSERT] stopped in onImport", err);
    } finally {
      setImporting(false);
    }
  };

  const undoImport = () => {
    if (!celebration) return;
    for (const collectionId of celebration.collectionIds) {
      for (const movieId of celebration.movieIds) {
        removeMovie(collectionId, movieId);
      }
    }
    updateItem(celebration.captureId, {
      status: "ready",
      importedMovieIds: [],
      importedAt: null,
    });
    setActiveId(celebration.captureId);
    setRevealedCount(
      useCaptureInboxStore.getState().getItem(celebration.captureId)?.matches
        .length ?? 0,
    );
    setCelebration(null);
    setView("review");
  };

  const finishCelebration = () => {
    setCelebration(null);
    setView("home");
    setActiveId(null);
    setSettlePreview(null);
  };

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-3xl py-20 text-center text-sm text-netflix-muted">
        Loading Capture…
      </div>
    );
  }

  const blurredHome = view === "settle";

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <AnimatePresence>
        {blurredHome ? (
          <motion.div
            key="backdrop"
            aria-hidden
            className="pointer-events-none fixed inset-0 z-0 bg-black/45 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: MOTION.ease }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {view === "home" || view === "settle" ? (
          <motion.div
            key="home"
            {...fadeUp}
            transition={{ duration: MOTION.duration, ease: MOTION.ease }}
            className={`relative z-10 ${
              blurredHome ? "pointer-events-none select-none" : ""
            }`}
            animate={{
              filter: blurredHome ? "blur(6px)" : "blur(0px)",
              opacity: blurredHome ? 0.45 : 1,
              scale: blurredHome ? 0.985 : 1,
            }}
          >
            <Link href="/" prefetch className="btn-ghost -ml-3 inline-flex">
              ← Home
            </Link>

            <header className="mt-8">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-netflix-red">
                Capture
              </p>
              <h1 className="mt-2 max-w-2xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Recommendations,
                <span className="block text-netflix-muted">understood.</span>
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-netflix-muted sm:text-[0.9375rem]">
                Screenshot anything on the internet. PickIt reads the
                recommendation — titles, theme, mood — and matches them to
                movies you can save in one tap.
              </p>
            </header>

            <div className="mt-10" ref={dropzoneRef}>
              <CaptureDropzone
                disabled={blurredHome}
                onCapture={(p) => void onCapture(p)}
              />
            </div>

            {error ? (
              <p className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                {error}
              </p>
            ) : null}

            <CaptureInbox
              items={filtered}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={(value) =>
                setStatusFilter(value as typeof statusFilter)
              }
              onOpen={openItem}
              onArchive={archiveItem}
              onDelete={(id) => void deleteItem(id)}
              emptyState={
                <CaptureInboxEmpty
                  onFocusUpload={() =>
                    dropzoneRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    })
                  }
                />
              }
            />
          </motion.div>
        ) : null}

        {view === "settle" && settlePreview ? (
          <motion.div
            key="settle-overlay"
            className="fixed inset-0 z-40 flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              layoutId="capture-screenshot-card"
              className="overflow-hidden rounded-[1.5rem] border border-white/15 shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
              initial={{ scale: 1.12, y: 24, rotate: -1.5 }}
              animate={{ scale: 1, y: 0, rotate: 0 }}
              transition={{ duration: 0.55, ease: MOTION.ease }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={settlePreview}
                alt="Captured screenshot"
                className="max-h-[70vh] w-auto max-w-[min(92vw,22rem)] object-contain"
              />
            </motion.div>
            <motion.p
              className="absolute bottom-16 left-1/2 -translate-x-1/2 text-sm text-white/80"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.3 }}
            >
              Got it — reading this next…
            </motion.p>
          </motion.div>
        ) : null}

        {view === "thinking" && active ? (
          <motion.div
            key="thinking"
            className="relative z-10 py-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.32, ease: MOTION.ease }}
          >
            <CaptureThinkingExperience
              stage={stage}
              observation={observation}
              imageUrl={
                active.imageDataUrl ||
                active.thumbnailDataUrl ||
                settlePreview
              }
              matches={active.matches}
              revealedCount={revealedCount}
              activeMatchId={activeMatchId}
              onSelectMatch={setActiveMatchId}
            />
          </motion.div>
        ) : null}

        {view === "review" && active ? (
          <motion.div
            key="review"
            className="relative z-10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.32, ease: MOTION.ease }}
          >
            <CaptureReview
              item={active}
              collections={collections}
              byCollection={byCollection}
              revealedCount={revealedCount}
              activeMatchId={activeMatchId}
              onActiveMatchChange={setActiveMatchId}
              onBack={() => {
                analytics.track("capture_review_abandoned", {
                  captureId: active.id,
                  selectedCount: active.matches.filter((match) => match.selected).length,
                });
                setView("home");
                setActiveId(null);
                setSettlePreview(null);
              }}
              onPatchMatch={(matchId, patch) =>
                patchMatch(active.id, matchId, patch)
              }
              onSetMatches={(matches) => setMatches(active.id, matches)}
              onToggleCollection={(collectionId) => {
                const selected = active.selectedCollectionIds.includes(
                  collectionId,
                )
                  ? active.selectedCollectionIds.filter(
                      (id) => id !== collectionId,
                    )
                  : [...active.selectedCollectionIds, collectionId];
                updateItem(active.id, { selectedCollectionIds: selected });
              }}
              onToggleCreateName={(name) => {
                const selected = active.createCollectionNames.includes(name)
                  ? active.createCollectionNames.filter((n) => n !== name)
                  : [...active.createCollectionNames, name];
                updateItem(active.id, { createCollectionNames: selected });
              }}
              onImport={onImport}
              importing={importing}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {celebration ? (
          <CaptureCelebration
            key="celebration"
            count={celebration.count}
            onUndo={undoImport}
            onDone={finishCelebration}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
