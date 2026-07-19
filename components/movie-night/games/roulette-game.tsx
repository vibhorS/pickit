"use client";

import { animate, motion, useMotionValue } from "framer-motion";
import { useState } from "react";
import { DecisionMovieCard } from "@/components/movie-night/decision-movie-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/ui/fade-in";
import { PosterImage } from "@/components/ui/poster-image";
import { MOTION } from "@/lib/motion";
import type { CollectionMovie } from "@/lib/services/movie-service";
import type { Movie } from "@/lib/types";

type RouletteGameProps = {
  queue: CollectionMovie[];
  onWin: (movie: Movie) => void;
  onBackToGames: () => void;
  onChooseCollection: () => void;
};

function formatRuntime(minutes: number): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function RouletteGame({
  queue,
  onWin,
  onBackToGames,
  onChooseCollection,
}: RouletteGameProps) {
  const [pool, setPool] = useState(queue);
  const [selected, setSelected] = useState<CollectionMovie | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const spinProgress = useMotionValue(0);

  async function spin() {
    if (spinning || pool.length === 0) return;

    setSelected(null);
    setSpinning(true);

    const winnerIndex = Math.floor(Math.random() * pool.length);
    const spins = 2 + Math.floor(Math.random() * 2);
    const steps = spins * pool.length + winnerIndex;

    spinProgress.set(0);
    await animate(spinProgress, steps, {
      duration: 2.2,
      ease: [0.15, 0.85, 0.15, 1],
      onUpdate: (latest) => {
        setHighlightIndex(Math.floor(latest) % pool.length);
      },
    });

    setSelected(pool[winnerIndex]);
    setHighlightIndex(winnerIndex);
    setSpinning(false);
  }

  function handleSpinAgain() {
    if (!selected) return;

    const nextPool = pool.filter((item) => item.movie.id !== selected.movie.id);
    setPool(nextPool);
    setSelected(null);
    setHighlightIndex(0);

    if (nextPool.length === 0) return;

    // Spec: remove from session, then spin again.
    window.setTimeout(() => {
      void (async () => {
        if (nextPool.length === 0) return;
        setSpinning(true);
        const winnerIndex = Math.floor(Math.random() * nextPool.length);
        const spins = 2 + Math.floor(Math.random() * 2);
        const steps = spins * nextPool.length + winnerIndex;
        spinProgress.set(0);
        await animate(spinProgress, steps, {
          duration: 2.2,
          ease: [0.15, 0.85, 0.15, 1],
          onUpdate: (latest) => {
            setHighlightIndex(Math.floor(latest) % nextPool.length);
          },
        });
        setSelected(nextPool[winnerIndex]);
        setHighlightIndex(winnerIndex);
        setSpinning(false);
      })();
    }, 120);
  }

  if (pool.length === 0) {
    return (
      <FadeIn className="mx-auto w-full max-w-lg">
        <EmptyState
          emoji="🎲"
          title="No candidates left"
          description="Every movie was spun out of this roulette session."
        />
        <div className="flex flex-col gap-3 px-4">
          <button
            type="button"
            onClick={() => {
              setPool(queue);
              setSelected(null);
            }}
            className="btn-primary w-full"
          >
            Start Over
          </button>
          <button type="button" onClick={onBackToGames} className="btn-secondary w-full">
            Choose Another Game
          </button>
          <button type="button" onClick={onChooseCollection} className="btn-ghost w-full">
            Choose Another Collection
          </button>
        </div>
      </FadeIn>
    );
  }

  return (
    <FadeIn className="mx-auto w-full max-w-lg">
      <button
        type="button"
        onClick={onBackToGames}
        className="btn-ghost -ml-3 mb-6 inline-flex items-center gap-2"
      >
        <span aria-hidden="true">←</span>
        Games
      </button>

      <div className="mb-6 text-center">
        <p aria-hidden="true" className="text-3xl">
          🎲
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Roulette
        </h1>
        <p className="mt-1 text-sm text-netflix-muted">
          {pool.length} in the wheel
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
        {pool.map((item, index) => {
          const isHot = index === highlightIndex && (spinning || selected != null);
          return (
            <motion.div
              key={item.movie.id}
              animate={{
                scale: isHot ? 1.04 : 1,
                opacity: isHot ? 1 : 0.55,
              }}
              transition={{ duration: MOTION.duration, ease: MOTION.ease }}
              className={`overflow-hidden rounded-xl ${
                isHot ? "ring-2 ring-netflix-red shadow-[var(--shadow-elevated)]" : ""
              }`}
            >
              <div className="aspect-[2/3]">
                <PosterImage
                  src={item.movie.posterUrl}
                  alt={`${item.movie.title} poster`}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {!selected ? (
        <button
          type="button"
          disabled={spinning}
          onClick={() => void spin()}
          className="btn-primary mt-8 min-h-14 w-full text-base disabled:opacity-60"
        >
          {spinning ? "Spinning…" : "Spin"}
        </button>
      ) : (
        <div className="mt-8 space-y-5">
          <div className="overflow-hidden rounded-2xl bg-netflix-surface shadow-[var(--shadow-card)]">
            <DecisionMovieCard
              movie={selected.movie}
              source={selected.source}
              metadata={selected.metadata}
            />
            <div className="flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:px-6 sm:pb-6">
              <button
                type="button"
                onClick={handleSpinAgain}
                disabled={pool.length <= 1 || spinning}
                className="btn-secondary w-full disabled:opacity-40 sm:flex-1"
              >
                🎲 Spin Again
              </button>
              <button
                type="button"
                onClick={() => onWin(selected.movie)}
                className="btn-primary w-full sm:flex-1"
              >
                🎬 Watch This
              </button>
            </div>
          </div>
          <p className="text-center text-sm text-netflix-muted">
            {selected.movie.title}
            {formatRuntime(selected.movie.runtime)
              ? ` · ${formatRuntime(selected.movie.runtime)}`
              : ""}
          </p>
        </div>
      )}
    </FadeIn>
  );
}
