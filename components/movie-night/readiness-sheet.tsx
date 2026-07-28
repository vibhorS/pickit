"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { MOTION } from "@/lib/motion";
import type { CollectionStats } from "@/store/collection-stats-selector";

type ReadinessSheetProps = {
  open: boolean;
  stats: CollectionStats | null;
  collectionName: string;
  onRate: () => void;
  onDismiss: () => void;
};

export function ReadinessSheet({
  open,
  stats,
  collectionName,
  onRate,
  onDismiss,
}: ReadinessSheetProps) {
  const waitingForMembers =
    stats?.readinessState === "waiting-for-members";
  const needsMyRatings =
    stats?.readinessState === "waiting-for-you";
  const noMutualMatches =
    stats?.readinessState === "no-mutual-matches";
  const title = waitingForMembers
    ? stats?.readinessLabel ?? "Waiting for members"
    : needsMyRatings
      ? `${stats.unratedMine} ${
          stats.unratedMine === 1 ? "movie needs" : "movies need"
        } your rating`
      : noMutualMatches
        ? "No mutual matches yet"
      : `${collectionName} isn’t ready yet`;
  const description = waitingForMembers
    ? `You've rated everything. ${stats?.waitingMemberNames.join(", ")} ${
        stats?.waitingMemberNames.length === 1 ? "has" : "have"
      } ${stats?.unratedOthers ?? 0} ${
        (stats?.unratedOthers ?? 0) === 1 ? "rating" : "ratings"
      } left.`
    : needsMyRatings
      ? "Finish your ratings to see the list's shared matches."
      : noMutualMatches
        ? "Everyone has finished rating, but no movie was liked by every member."
      : "Add movies and rate them together before starting Movie Night.";

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onDismiss]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.duration, ease: MOTION.ease }}
        >
          <button
            type="button"
            aria-label="Dismiss"
            className="absolute inset-0 bg-black/65"
            onClick={onDismiss}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="readiness-title"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: MOTION.durationSlow, ease: MOTION.ease }}
            className="relative z-10 w-full max-w-md rounded-t-3xl bg-netflix-surface px-6 pb-8 pt-6 shadow-[var(--shadow-elevated)] sm:rounded-3xl sm:px-7 sm:py-7"
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/15 sm:hidden" />

            <p aria-hidden="true" className="text-2xl">
              ⚠️
            </p>
            <h2
              id="readiness-title"
              className="mt-3 text-xl font-semibold tracking-tight text-white"
            >
              {title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-netflix-muted">
              {description}
            </p>

            <div className="mt-7 flex flex-col gap-3">
              {needsMyRatings && (
                <button
                  type="button"
                  onClick={onRate}
                  className="btn-secondary w-full"
                >
                  Rate Movies
                </button>
              )}
              <button
                type="button"
                onClick={onDismiss}
                className="btn-ghost w-full"
              >
                Choose Another Mood
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
