"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { getDecisionGames } from "@/lib/decision-games/registry";
import type { DecisionGameId } from "@/lib/decision-games/types";
import { MOTION, staggerContainer, staggerItem } from "@/lib/motion";
import { FadeIn } from "@/components/ui/fade-in";

type GamesHubProps = {
  vibeName: string;
  vibeEmoji: string;
  queueSize: number;
  onSelect: (gameId: DecisionGameId) => void;
  onBack: () => void;
};

export function GamesHub({
  vibeName,
  vibeEmoji,
  queueSize,
  onSelect,
  onBack,
}: GamesHubProps) {
  const games = getDecisionGames();

  return (
    <FadeIn className="mx-auto w-full max-w-4xl">
      <button
        type="button"
        onClick={onBack}
        className="btn-ghost -ml-3 mb-8 inline-flex items-center gap-2"
      >
        <span aria-hidden="true">←</span>
        Change vibe
      </button>

      <div className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-netflix-red">
          Game time
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Let&apos;s Go
        </h1>
        <p className="mt-3 text-sm text-netflix-muted sm:text-base">
          {vibeEmoji} {vibeName} is ready. Choose how tonight&apos;s winner
          gets picked.
        </p>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid gap-4 md:grid-cols-3"
      >
        {games.map((game) => (
          <motion.button
            key={game.id}
            type="button"
            variants={staggerItem}
            whileHover={{ y: -6, rotate: game.id === "roulette" ? 1 : 0 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: MOTION.duration, ease: MOTION.ease }}
            onClick={() => onSelect(game.id)}
            className={`group relative min-h-60 w-full overflow-hidden rounded-3xl p-6 text-left shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-elevated)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-netflix-red ${gameCardStyles(game.id)}`}
          >
            <div
              aria-hidden="true"
              className="absolute -right-10 -top-10 size-36 rounded-full bg-white/10 blur-2xl transition duration-300 group-hover:scale-125"
            />
            <div className="relative flex h-full flex-col">
              <span
                aria-hidden="true"
                className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-black/20 text-3xl backdrop-blur-sm"
              >
                {game.emoji}
              </span>
              <div className="mt-auto pt-8">
                <p className="text-xs font-medium text-white/55">
                  {game.estimatedDuration} · {roundsLabel(game.id, queueSize)}
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                  {game.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  {game.blurb}
                </p>
                <ArrowRight
                  className="mt-5 size-5 text-white/45 transition group-hover:translate-x-1 group-hover:text-white"
                  aria-hidden="true"
                />
              </div>
            </div>
          </motion.button>
        ))}
      </motion.div>
    </FadeIn>
  );
}

function gameCardStyles(gameId: DecisionGameId): string {
  if (gameId === "quick-pick") {
    return "bg-[linear-gradient(145deg,rgba(229,9,20,0.88),rgba(95,10,24,0.96))]";
  }
  if (gameId === "roulette") {
    return "bg-[linear-gradient(145deg,rgba(116,65,185,0.92),rgba(43,24,78,0.98))]";
  }
  return "bg-[linear-gradient(145deg,rgba(180,116,22,0.9),rgba(69,39,12,0.98))]";
}

function roundsLabel(
  gameId: DecisionGameId,
  queueSize: number,
): string {
  if (gameId === "roulette") return "1 spin";
  if (gameId === "quick-pick") {
    return `up to ${Math.max(queueSize, 1)} picks`;
  }
  const rounds = Math.max(Math.ceil(Math.log2(Math.max(queueSize, 2))), 1);
  return `${rounds} ${rounds === 1 ? "round" : "rounds"}`;
}
