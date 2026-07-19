"use client";

import { motion } from "framer-motion";
import { getDecisionGames } from "@/lib/decision-games/registry";
import type { DecisionGameId } from "@/lib/decision-games/types";
import { MOTION, staggerContainer, staggerItem } from "@/lib/motion";
import { FadeIn } from "@/components/ui/fade-in";

type GamesHubProps = {
  onSelect: (gameId: DecisionGameId) => void;
  onBack: () => void;
};

export function GamesHub({ onSelect, onBack }: GamesHubProps) {
  const games = getDecisionGames();

  return (
    <FadeIn className="mx-auto w-full max-w-lg">
      <button
        type="button"
        onClick={onBack}
        className="btn-ghost -ml-3 mb-8 inline-flex items-center gap-2"
      >
        <span aria-hidden="true">←</span>
        Tonight&apos;s Queue
      </button>

      <div className="mb-8 text-center sm:text-left">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          How do you want to decide tonight?
        </h1>
        <p className="mt-2 text-sm text-netflix-muted">
          Pick a game — every path ends with one movie.
        </p>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="flex flex-col gap-4"
      >
        {games.map((game) => (
          <motion.button
            key={game.id}
            type="button"
            variants={staggerItem}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.99 }}
            transition={{ duration: MOTION.duration, ease: MOTION.ease }}
            onClick={() => onSelect(game.id)}
            className="w-full rounded-2xl bg-netflix-surface p-5 text-left shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-elevated)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-netflix-red sm:p-6"
          >
            <div className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-2xl"
              >
                {game.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-xl font-semibold tracking-tight text-white">
                    {game.title}
                  </h2>
                  <p className="text-xs font-medium text-netflix-muted">
                    {game.estimatedDuration}
                  </p>
                </div>
                <p className="mt-1 text-sm font-medium text-rose-200/85">
                  {game.blurb}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-netflix-muted">
                  {game.description}
                </p>
              </div>
            </div>
          </motion.button>
        ))}
      </motion.div>
    </FadeIn>
  );
}
