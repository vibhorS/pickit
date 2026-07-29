"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Merge,
  Search,
  X,
  RotateCcw,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PosterImage } from "@/components/ui/poster-image";
import { ConfidenceBadge } from "@/components/capture/intelligence/capture-confidence";
import { CaptureScreenshotPanel } from "@/components/capture/intelligence/capture-screenshot-panel";
import { findDuplicateCollections } from "@/lib/capture/intelligence/duplicates";
import { buildObservation } from "@/lib/capture/intelligence/ux-copy";
import { analytics } from "@/lib/observability/analytics";
import {
  assertStage,
  resetSaveAssertions,
} from "@/lib/sync/save-assertions";
import type {
  CaptureItem,
  MatchedRecommendation,
} from "@/lib/capture/intelligence/types";
import { MOTION } from "@/lib/motion";
import type { Collection, Movie } from "@/lib/types";
import type { CollectionMovie } from "@/lib/services/movie-service";
import { useSettingsStore } from "@/store/settings-store";

type CaptureReviewProps = {
  item: CaptureItem;
  collections: Collection[];
  byCollection: Record<string, CollectionMovie[]>;
  /** How many posters should already be visible (live reveal continues here). */
  revealedCount: number;
  showCollections?: boolean;
  onBack: () => void;
  onPatchMatch: (
    matchId: string,
    patch: Partial<MatchedRecommendation>,
  ) => void;
  onSetMatches: (matches: MatchedRecommendation[]) => void;
  onToggleCollection: (collectionId: string) => void;
  onToggleCreateName: (name: string) => void;
  onImport: () => void;
  importing?: boolean;
  activeMatchId?: string | null;
  onActiveMatchChange?: (id: string | null) => void;
};

export function CaptureReview({
  item,
  collections,
  byCollection,
  revealedCount,
  showCollections = true,
  onBack,
  onPatchMatch,
  onSetMatches,
  onToggleCollection,
  onToggleCreateName,
  onImport,
  importing,
  activeMatchId,
  onActiveMatchChange,
}: CaptureReviewProps) {
  const developerMode = useSettingsStore((state) => state.developerMode);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [rematchBusy, setRematchBusy] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);

  const imageUrl = item.imageDataUrl || item.thumbnailDataUrl || null;
  const observation = buildObservation(item, "ready");
  const titleText = item.headline || "Here's what I found";
  const normalizedTitle = titleText.toLowerCase().trim();
  const normalizedObservation = observation.toLowerCase().trim();
  const tokenize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 4);
  const titleTokens = new Set(tokenize(titleText));
  const observationTokens = new Set(tokenize(observation));
  const sharedTokenCount = Array.from(titleTokens).filter((token) =>
    observationTokens.has(token),
  ).length;
  const overlapRatio =
    titleTokens.size === 0 ? 0 : sharedTokenCount / titleTokens.size;
  const isTooSimilar =
    normalizedObservation === normalizedTitle || overlapRatio >= 0.5;
  const subtitleText =
    isTooSimilar
      ? item.recommendationReason?.trim() ||
        `This looks like a ${item.source.label} recommendation post.`
      : observation;

  const visible = useMemo(
    () =>
      item.matches
        .filter((m) => !m.rejected)
        .slice(0, Math.max(revealedCount, item.matches.length)),
    [item.matches, revealedCount],
  );

  const liveVisible = useMemo(
    () => visible.slice(0, revealedCount),
    [visible, revealedCount],
  );

  const selectedCount = liveVisible.filter((m) => m.selected && m.movie).length;

  useEffect(() => {
    const startedAt = Date.now();
    return () => {
      analytics.timing("capture_review_duration", Date.now() - startedAt, {
        captureId: item.id,
      });
    };
  }, [item.id]);

  function trackCorrection(match: MatchedRecommendation, action: string) {
    analytics.track("capture_manual_correction", {
      captureId: item.id,
      matchId: match.id,
      action,
      decision: match.matchDecision,
      status: match.matchStatus,
    });
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (editingId) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const match = liveVisible[focusIndex];
      if (event.key === "a" || event.key === "A") {
        if (match?.movie) {
          onPatchMatch(match.id, { selected: true, rejected: false });
        }
      }
      if (event.key === "r" || event.key === "R") {
        if (match) {
          onPatchMatch(match.id, { selected: false, rejected: true });
        }
      }
      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        setFocusIndex((i) => Math.min(liveVisible.length - 1, i + 1));
      }
      if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        setFocusIndex((i) => Math.max(0, i - 1));
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (selectedCount > 0 && !importing) onImport();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    editingId,
    focusIndex,
    importing,
    liveVisible,
    onImport,
    onPatchMatch,
    selectedCount,
  ]);

  useEffect(() => {
    const match = liveVisible[focusIndex];
    onActiveMatchChange?.(match?.id ?? null);
  }, [focusIndex, liveVisible, onActiveMatchChange]);

  const rematch = async (match: MatchedRecommendation, title: string) => {
    setRematchBusy(match.id);
    try {
      const response = await fetch("/api/capture/rematch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          year: match.extracted.year,
          alternateTitles: match.extracted.alternateTitles,
        }),
      });
      const data = (await response.json()) as {
        match?: MatchedRecommendation;
        error?: string;
      };
      if (!response.ok || !data.match) {
        throw new Error(data.error ?? "Rematch failed.");
      }
      onPatchMatch(match.id, {
        ...data.match,
        id: match.id,
        selected: data.match.matchStatus === "matched",
        rejected: false,
      });
    } catch {
      // leave as-is
    } finally {
      setRematchBusy(null);
      setEditingId(null);
    }
  };

  const mergeInto = (fromId: string, intoId: string) => {
    const from = item.matches.find((m) => m.id === fromId);
    const into = item.matches.find((m) => m.id === intoId);
    if (!from || !into) return;
    onSetMatches(
      item.matches
        .filter((m) => m.id !== fromId)
        .map((m) =>
          m.id === intoId
            ? {
                ...m,
                extracted: {
                  ...m.extracted,
                  alternateTitles: Array.from(
                    new Set([
                      ...(m.extracted.alternateTitles ?? []),
                      from.extracted.title,
                      ...(from.extracted.alternateTitles ?? []),
                    ]),
                  ),
                  context:
                    [m.extracted.context, from.extracted.context]
                      .filter(Boolean)
                      .join(" · ") || m.extracted.context,
                },
              }
            : m,
        ),
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <button
        type="button"
        onClick={onBack}
        className="btn-ghost -ml-3 inline-flex text-sm"
      >
        ← Inbox
      </button>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)]">
        <div>
          {imageUrl ? (
            <motion.div layoutId="capture-screenshot-card">
              <CaptureScreenshotPanel
                imageUrl={imageUrl}
                matches={item.matches.filter((m) => !m.rejected)}
                revealedCount={revealedCount}
                activeMatchId={activeMatchId}
                onSelectMatch={(id) => {
                  onActiveMatchChange?.(id);
                  const idx = liveVisible.findIndex((m) => m.id === id);
                  if (idx >= 0) setFocusIndex(idx);
                }}
              />
            </motion.div>
          ) : null}
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-netflix-red">
            Review
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {titleText}
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-netflix-muted">
            {subtitleText}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {item.theme ? (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, ease: MOTION.ease, delay: 0.08 }}
              >
                <Badge tone="accent">{item.theme}</Badge>
              </motion.div>
            ) : null}
            {item.mood ? <Badge>{item.mood}</Badge> : null}
            <Badge tone="neutral">{item.source.label}</Badge>
            {typeof item.confidence === "number" ? (
              <ConfidenceBadge value={item.confidence} />
            ) : null}
          </div>

          <p className="mt-5 text-xs text-netflix-muted">
            J/K move · A keep · R skip · ⌘/Ctrl+Enter save
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                onSetMatches(
                  item.matches.map((m) =>
                    m.movie && !m.rejected ? { ...m, selected: true } : m,
                  ),
                )
              }
            >
              Keep all matches
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                onSetMatches(
                  item.matches.map((m) => ({ ...m, selected: false })),
                )
              }
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      <ul className="mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-3 lg:overflow-visible">
        <AnimatePresence initial={false}>
          {liveVisible.map((match, index) => {
            const duplicates = match.movie
              ? findDuplicateCollections(
                  match.movie.id,
                  collections,
                  byCollection,
                )
              : [];
            const focused =
              (activeMatchId ? activeMatchId === match.id : false) ||
              index === focusIndex;
            return (
              <motion.li
                key={match.id}
                layout
                initial={{ opacity: 0, y: 18, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{
                  duration: 0.36,
                  ease: MOTION.ease,
                  delay: Math.min(index * 0.05, 0.35),
                }}
                className={`w-[84vw] max-w-sm shrink-0 snap-center overflow-hidden rounded-2xl border bg-white/[0.03] transition lg:w-auto lg:max-w-none lg:shrink ${
                  focused
                    ? "border-netflix-red/50 ring-1 ring-netflix-red/25"
                    : match.selected
                      ? "border-emerald-400/35"
                      : "border-white/10"
                }`}
                onClick={() => {
                  setFocusIndex(index);
                  onActiveMatchChange?.(match.id);
                }}
              >
                <div className="aspect-[2/3] w-full">
                  {match.movie?.posterUrl ? (
                    <PosterImage
                      src={match.movie.posterUrl}
                      alt={match.movie.title}
                      priority={index < 4}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-netflix-elevated px-4 text-center text-sm text-netflix-muted">
                      {match.matchStatus === "unmatched"
                        ? "Couldn’t find a match"
                        : "Take another look"}
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <ConfidenceBadge
                    value={match.matchConfidence}
                    matchStatus={match.matchStatus}
                    matchDecision={match.matchDecision}
                  />

                  {editingId === match.id ? (
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void rematch(
                          match,
                          editTitle.trim() || match.extracted.title,
                        );
                      }}
                    >
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e: ReactKeyboardEvent) =>
                          e.stopPropagation()
                        }
                        className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white outline-none"
                        autoFocus
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={rematchBusy === match.id}
                      >
                        Go
                      </Button>
                    </form>
                  ) : (
                    <div>
                      <p className="font-semibold text-white">
                        {match.movie?.title ?? match.extracted.title}
                      </p>
                      <p className="text-xs text-netflix-muted">
                        {match.movie?.year || match.extracted.year || "—"}
                        {match.extracted.rank
                          ? ` · #${match.extracted.rank}`
                          : ""}
                      </p>
                    </div>
                  )}

                  {duplicates.length > 0 ? (
                    <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-2.5 py-2 text-xs text-amber-100/90">
                      <p className="font-medium">Already in:</p>
                      <p className="mt-0.5">
                        {duplicates
                          .map(
                            (d) =>
                              `${d.emoji ? `${d.emoji} ` : ""}${d.collectionName}`,
                          )
                          .join(" · ")}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="rounded-full bg-white/10 px-2 py-0.5 hover:bg-white/15"
                          onClick={() =>
                            {
                              trackCorrection(match, "skip_duplicate");
                              onPatchMatch(match.id, {
                                selected: false,
                                rejected: true,
                              });
                            }
                          }
                        >
                          Skip
                        </button>
                        <button
                          type="button"
                          className="rounded-full bg-white/10 px-2 py-0.5 hover:bg-white/15"
                          onClick={() =>
                            {
                              trackCorrection(match, "keep_duplicate");
                              onPatchMatch(match.id, { selected: true });
                            }
                          }
                        >
                          Keep anyway
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {match.alternatives.length > 1 ? (
                    <div className="flex flex-wrap gap-1">
                      {match.alternatives.slice(0, 3).map((alt: Movie) => (
                        <button
                          key={alt.id}
                          type="button"
                          className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-netflix-muted hover:border-white/25 hover:text-white"
                          onClick={() =>
                            {
                              trackCorrection(match, "select_alternative");
                              onPatchMatch(match.id, {
                                movie: alt,
                                matchDecision: "manual-review",
                                decisionReason: "Manually selected alternative",
                                matchStatus: "matched",
                                matchConfidence: Math.max(
                                  match.matchConfidence,
                                  0.75,
                                ),
                                selected: true,
                                rejected: false,
                              });
                            }
                          }
                        >
                          {alt.title}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={match.selected ? "primary" : "secondary"}
                      onClick={() =>
                        {
                          trackCorrection(
                            match,
                            match.selected ? "unkeep_match" : "keep_match",
                          );
                          onPatchMatch(match.id, {
                            selected: !match.selected,
                            rejected: false,
                          });
                        }
                      }
                      disabled={!match.movie}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" />
                      Keep
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        {
                          trackCorrection(match, "skip_match");
                          onPatchMatch(match.id, {
                            selected: false,
                            rejected: true,
                          });
                        }
                      }
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Skip
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        trackCorrection(match, "search_rematch_opened");
                        setEditingId(match.id);
                        setEditTitle(
                          match.movie?.title ?? match.extracted.title,
                        );
                      }}
                    >
                      <Search className="mr-1 h-3.5 w-3.5" />
                      Search
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={rematchBusy === match.id}
                      onClick={() => {
                        trackCorrection(match, "search_again");
                        void rematch(match, match.extracted.title);
                      }}
                    >
                      <RotateCcw className="mr-1 h-3.5 w-3.5" />
                      Again
                    </Button>
                    {index > 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          mergeInto(match.id, liveVisible[index - 1].id)
                        }
                      >
                        <Merge className="mr-1 h-3.5 w-3.5" />
                        Merge
                      </Button>
                    ) : null}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {showCollections ? (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: MOTION.ease, delay: 0.15 }}
          className="mt-10 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-5 sm:p-6"
        >
          <h2 className="text-lg font-bold text-white">Where should these go?</h2>
          <p className="mt-1 text-sm text-netflix-muted">
            Suggestions from the capture — change anything.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {item.suggestedCollectionNames.map((name, index) => {
              const existing = collections.find(
                (c) => c.name.toLowerCase() === name.toLowerCase(),
              );
              if (existing) {
                const on = item.selectedCollectionIds.includes(existing.id);
                return (
                  <motion.button
                    key={`exist-${existing.id}`}
                    type="button"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.28,
                      ease: MOTION.ease,
                      delay: 0.05 * index,
                    }}
                    onClick={() => onToggleCollection(existing.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      on
                        ? "border-netflix-red/50 bg-netflix-red/15 text-white"
                        : "border-white/10 text-netflix-muted hover:text-white"
                    }`}
                  >
                    {on ? "✓ " : ""}
                    {existing.emoji} {existing.name}
                  </motion.button>
                );
              }
              const on = item.createCollectionNames.includes(name);
              return (
                <motion.button
                  key={`create-${name}`}
                  type="button"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.28,
                    ease: MOTION.ease,
                    delay: 0.05 * index,
                  }}
                  onClick={() => onToggleCreateName(name)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    on
                      ? "border-emerald-400/40 bg-emerald-400/10 text-white"
                      : "border-dashed border-white/15 text-netflix-muted hover:text-white"
                  }`}
                >
                  {on ? "✓ " : "+ "}
                  Create {name}
                </motion.button>
              );
            })}
            {collections.slice(0, 12).map((collection) => {
              if (
                item.suggestedCollectionNames.some(
                  (n) => n.toLowerCase() === collection.name.toLowerCase(),
                )
              ) {
                return null;
              }
              const on = item.selectedCollectionIds.includes(collection.id);
              return (
                <button
                  key={collection.id}
                  type="button"
                  onClick={() => onToggleCollection(collection.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    on
                      ? "border-netflix-red/50 bg-netflix-red/15 text-white"
                      : "border-white/10 text-netflix-muted hover:text-white"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {collection.emoji} {collection.name}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-netflix-muted">
              {selectedCount} ready to save
            </p>
            <Button
              type="button"
              disabled={
                importing ||
                selectedCount === 0 ||
                (item.selectedCollectionIds.length === 0 &&
                  item.createCollectionNames.length === 0)
              }
              onClick={() => {
                console.info("STAGE 1: Save button clicked");
                void import("@/lib/sync/rec-id-trace").then(({ resetRecIdTrace }) => {
                  resetRecIdTrace();
                });
                resetSaveAssertions();
                assertStage(
                  1,
                  "Save button clicked",
                  true,
                  JSON.stringify({
                    selectedCount,
                    collectionIds: item.selectedCollectionIds,
                    createNames: item.createCollectionNames,
                    importing,
                  }),
                );
                onImport();
              }}
            >
              {importing ? "Saving…" : "Save recommendations"}
            </Button>
          </div>
        </motion.section>
      ) : null}
      {developerMode ? (
        <section className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-netflix-muted">
            Developer Trace
          </p>
          <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-black/35 p-3 text-[11px] leading-relaxed text-netflix-muted">
            {JSON.stringify(item.rawAiOutput ?? item.vision ?? {}, null, 2)}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
