"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { DecisionMovieCard } from "@/components/movie-night/decision-movie-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/ui/fade-in";
import { MOTION } from "@/lib/motion";
import type { CollectionMovie } from "@/lib/services/movie-service";
import {
  createQuickPickSession,
  skipQuickPickMovie,
  type QuickPickSession,
} from "@/lib/tonight-queue";
import type { Movie } from "@/lib/types";

type QuickPickGameProps = {
  queue: CollectionMovie[];
  onWin: (movie: Movie) => void;
  onBackToGames: () => void;
  onChooseCollection: () => void;
  initialSession?: QuickPickSession;
  onSessionChange?: (session: QuickPickSession) => void;
};

export function QuickPickGame({
  queue,
  onWin,
  onBackToGames,
  onChooseCollection,
  initialSession,
  onSessionChange,
}: QuickPickGameProps) {
  const [session, setSession] = useState<QuickPickSession>(() =>
    initialSession ?? createQuickPickSession(queue),
  );
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    onSessionChange?.(session);
  }, [onSessionChange, session]);

  const active = session.remaining[0];

  if (!active) {
    return (
      <FadeIn className="mx-auto w-full max-w-lg">
        <EmptyState
          emoji="🍿"
          title="Nothing clicked yet?"
          description="Start over or try another way to pick tonight's movie."
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
            Try Another Game
          </button>
          <button
            type="button"
            onClick={onChooseCollection}
            className="btn-ghost w-full"
          >
            Change Vibe
          </button>
        </div>
      </FadeIn>
    );
  }

  function showAnother() {
    setShowDetails(false);
    setSession((current) => skipQuickPickMovie(current));
  }

  return (
    <FadeIn className="mx-auto w-full max-w-4xl">
      <div className="mb-5 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBackToGames}
          className="btn-ghost -ml-3 inline-flex items-center gap-2"
        >
          <span aria-hidden="true">←</span>
          Games
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-netflix-red">
          Quick Pick
        </p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active.movie.id}
          initial={{ opacity: 0, scale: 0.985, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.985, x: -20 }}
          transition={{ duration: MOTION.durationSlow, ease: MOTION.ease }}
          className="overflow-hidden rounded-3xl bg-netflix-surface shadow-[var(--shadow-elevated)]"
        >
          <DecisionMovieCard
            movie={active.movie}
            source={active.source}
            metadata={active.metadata}
            addedByUserId={active.addedByUserId}
            showOverview={showDetails}
          />

          <div className="grid gap-3 px-5 pb-6 pt-4 sm:grid-cols-2 sm:px-8 sm:pb-8">
            <button
              type="button"
              onClick={() => onWin(active.movie)}
              className="btn-primary min-h-12 w-full sm:col-span-2"
            >
              ❤️ That&apos;s the One
            </button>
            <button
              type="button"
              onClick={showAnother}
              className="btn-secondary min-h-11 w-full"
            >
              🎲 Show Another
            </button>
            <button
              type="button"
              onClick={() => setShowDetails((value) => !value)}
              className="btn-ghost min-h-11 w-full"
            >
              📖 {showDetails ? "Hide Details" : "More Details"}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </FadeIn>
  );
}
