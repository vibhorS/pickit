"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { RecommendationContext } from "@/components/recommendation/recommendation-context";
import { PosterImage } from "@/components/ui/poster-image";
import { FadeIn } from "@/components/ui/fade-in";
import {
  getTournamentRoundLabel,
  shuffleItems,
} from "@/lib/decision-games/helpers";
import { MOTION } from "@/lib/motion";
import type { CollectionMovie } from "@/lib/services/movie-service";
import type { Movie } from "@/lib/types";

type TournamentGameProps = {
  queue: CollectionMovie[];
  onWin: (movie: Movie) => void;
  onBackToGames: () => void;
  initialState?: TournamentGameState;
  onStateChange?: (state: TournamentGameState) => void;
};

type Pair = [CollectionMovie, CollectionMovie | null];

export type TournamentGameState = {
  round: Pair[];
  pairIndex: number;
  winners: CollectionMovie[];
  remainingInBracket: number;
};

function buildPairs(contenders: CollectionMovie[]): Pair[] {
  const pairs: Pair[] = [];
  for (let i = 0; i < contenders.length; i += 2) {
    pairs.push([contenders[i], contenders[i + 1] ?? null]);
  }
  return pairs;
}

export function TournamentGame({
  queue,
  onWin,
  onBackToGames,
  initialState,
  onStateChange,
}: TournamentGameProps) {
  const initial = useMemo(() => shuffleItems(queue), [queue]);
  const [round, setRound] = useState(
    () => initialState?.round ?? buildPairs(initial),
  );
  const [pairIndex, setPairIndex] = useState(
    () => initialState?.pairIndex ?? 0,
  );
  const [winners, setWinners] = useState<CollectionMovie[]>(
    () => initialState?.winners ?? [],
  );
  const [remainingInBracket, setRemainingInBracket] = useState(
    () => initialState?.remainingInBracket ?? initial.length,
  );

  const currentPair = round[pairIndex] as Pair | undefined;
  const roundLabel = getTournamentRoundLabel(remainingInBracket);

  function advance(winner: CollectionMovie) {
    const nextWinners = [...winners, winner];
    const nextPairIndex = pairIndex + 1;

    if (nextPairIndex < round.length) {
      setWinners(nextWinners);
      setPairIndex(nextPairIndex);
      return;
    }

    if (nextWinners.length === 1) {
      onWin(nextWinners[0].movie);
      return;
    }

    setRemainingInBracket(nextWinners.length);
    setRound(buildPairs(nextWinners));
    setWinners([]);
    setPairIndex(0);
  }

  // Auto-advance byes without rendering a one-sided match.
  useEffect(() => {
    if (!currentPair) return;
    const [, right] = currentPair;
    if (right) return;
    advance(currentPair[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot bye
  }, [currentPair, pairIndex, round]);

  useEffect(() => {
    onStateChange?.({
      round,
      pairIndex,
      winners,
      remainingInBracket,
    });
  }, [
    onStateChange,
    pairIndex,
    remainingInBracket,
    round,
    winners,
  ]);

  if (!currentPair) {
    return null;
  }

  const [left, right] = currentPair;

  if (!right) {
    return (
      <FadeIn className="mx-auto flex w-full max-w-lg items-center justify-center py-24">
        <p className="text-sm text-netflix-muted">Advancing…</p>
      </FadeIn>
    );
  }

  return (
    <FadeIn className="mx-auto w-full max-w-2xl">
      <button
        type="button"
        onClick={onBackToGames}
        className="btn-ghost -ml-3 mb-6 inline-flex items-center gap-2"
      >
        <span aria-hidden="true">←</span>
        Games
      </button>

      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-netflix-red">
          {roundLabel}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Pick a winner
        </h1>
        <p className="mt-1 text-sm text-netflix-muted">
          Match {pairIndex + 1} of {round.length}
        </p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${left.movie.id}-${right.movie.id}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: MOTION.duration, ease: MOTION.ease }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-5"
        >
          <TournamentCard item={left} onPick={() => advance(left)} />
          <p className="text-center text-sm font-semibold uppercase tracking-wide text-netflix-muted">
            vs
          </p>
          <TournamentCard item={right} onPick={() => advance(right)} />
        </motion.div>
      </AnimatePresence>
    </FadeIn>
  );
}

function TournamentCard({
  item,
  onPick,
}: {
  item: CollectionMovie;
  onPick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onPick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: MOTION.duration, ease: MOTION.ease }}
      className="overflow-hidden rounded-2xl bg-netflix-surface text-left shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-elevated)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-netflix-red"
    >
      <div className="aspect-[2/3] w-full">
        <PosterImage
          src={item.movie.posterUrl}
          alt={`${item.movie.title} poster`}
          priority
        />
      </div>
      <div className="space-y-1 px-4 py-4">
        <h2 className="text-lg font-semibold tracking-tight text-white">
          {item.movie.title}
        </h2>
        <p className="text-sm text-netflix-muted">
          {item.movie.year > 0 ? item.movie.year : "—"}
          {item.movie.rating > 0 ? ` · ${item.movie.rating.toFixed(1)}` : ""}
        </p>
        <RecommendationContext
          metadata={item.metadata}
          source={item.source}
        />
      </div>
    </motion.button>
  );
}
