"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import {
  SwipeableChoiceShell,
  type ChoiceDirection,
} from "@/components/decide/swipeable-choice-shell";
import { DecisionMovieCard } from "@/components/movie-night/decision-movie-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/ui/fade-in";
import { MOTION } from "@/lib/motion";
import type { CollectionMovie } from "@/lib/services/movie-service";
import {
  createQuickPickSession,
  getQuickPickProgress,
  skipQuickPickMovie,
  type QuickPickSession,
} from "@/lib/tonight-queue";
import type { Movie } from "@/lib/types";

type QuickPickGameProps = {
  queue: CollectionMovie[];
  onWin: (movie: Movie) => void;
  onBackToGames: () => void;
  onChooseCollection: () => void;
};

export function QuickPickGame({
  queue,
  onWin,
  onBackToGames,
  onChooseCollection,
}: QuickPickGameProps) {
  const [session, setSession] = useState<QuickPickSession>(() =>
    createQuickPickSession(queue),
  );

  const { currentIndex, total, remainingCount, skippedCount } =
    getQuickPickProgress(session);
  const progress =
    total > 0 ? Math.round(((currentIndex - 1) / total) * 100) : 0;
  const current = session.remaining[0];

  if (!current || remainingCount === 0) {
    return (
      <FadeIn className="mx-auto w-full max-w-lg">
        <EmptyState
          emoji="🍿"
          title="We couldn't decide tonight."
          description="Every candidate was skipped. Mutual matches are unchanged."
        />
        <div className="flex flex-col gap-3 px-4">
          <button
            type="button"
            onClick={() => setSession(createQuickPickSession(queue))}
            className="btn-primary w-full"
          >
            Start Over
          </button>
          <button
            type="button"
            onClick={onBackToGames}
            className="btn-secondary w-full"
          >
            Choose Another Game
          </button>
          <button
            type="button"
            onClick={onChooseCollection}
            className="btn-ghost w-full"
          >
            Choose Another Collection
          </button>
        </div>
      </FadeIn>
    );
  }

  const active = current;

  function handleChoice(direction: ChoiceDirection) {
    if (direction === "accept") {
      onWin(active.movie);
      return;
    }
    setSession((currentSession) => skipQuickPickMovie(currentSession));
  }

  return (
    <FadeIn className="mx-auto w-full max-w-2xl">
      <div className="mb-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-white">
            Movie {currentIndex} of {total}
          </p>
          <p className="text-sm text-netflix-muted">
            {remainingCount} remaining · {skippedCount} skipped
          </p>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full bg-netflix-red"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: MOTION.durationSlow, ease: MOTION.ease }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active.movie.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: MOTION.duration, ease: MOTION.ease }}
        >
          <SwipeableChoiceShell
            acceptLabel="Watch Tonight"
            skipLabel="Skip Tonight"
            onChoice={handleChoice}
            footer={(choose) => (
              <div className="flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:px-8 sm:pb-7">
                <button
                  type="button"
                  onClick={() => choose("skip")}
                  className="btn-secondary w-full sm:flex-1"
                >
                  Skip Tonight
                </button>
                <button
                  type="button"
                  onClick={() => choose("accept")}
                  className="btn-primary w-full sm:flex-1"
                >
                  Watch Tonight
                </button>
              </div>
            )}
          >
            <DecisionMovieCard
              movie={active.movie}
              source={active.source}
              metadata={active.metadata}
            />
          </SwipeableChoiceShell>
        </motion.div>
      </AnimatePresence>
    </FadeIn>
  );
}
