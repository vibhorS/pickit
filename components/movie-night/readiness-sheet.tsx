"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { MOTION } from "@/lib/motion";
import type { CollectionStats } from "@/store/collection-stats-selector";

type ReadinessSheetProps = {
  open: boolean;
  stats: CollectionStats | null;
  collectionName: string;
  onContinue: () => void;
  onRate: () => void;
  onDismiss: () => void;
};

export function ReadinessSheet({
  open,
  stats,
  collectionName,
  onContinue,
  onRate,
  onDismiss,
}: ReadinessSheetProps) {
  const waitingForPartner =
    stats?.readinessState === "waiting-for-partner";
  const needsMyRatings =
    stats?.readinessState === "needs-my-ratings";
  const title = waitingForPartner
    ? "Waiting for partner"
    : needsMyRatings
      ? `${stats.unratedMine} ${
          stats.unratedMine === 1 ? "movie needs" : "movies need"
        } your rating`
      : `${collectionName} isn’t ready yet`;
  const description = waitingForPartner
    ? `You've rated everything. Your partner has ${
        stats?.unratedPartner ?? 0
      } ${(stats?.unratedPartner ?? 0) === 1 ? "movie" : "movies"} left.`
    : needsMyRatings
      ? "Finish your ratings to see the collection's shared matches."
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
              <button
                type="button"
                onClick={onContinue}
                className="btn-primary w-full"
              >
                Continue Anyway
              </button>
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
                Dismiss
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
