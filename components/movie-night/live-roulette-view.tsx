"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { PosterImage } from "@/components/ui/poster-image";
import type { Movie } from "@/lib/types";

type LiveRouletteViewProps = {
  movies: Movie[];
  seed: number;
  startedAt: string;
  winnerId: string;
  onComplete: () => void;
};

const SPIN_MS = 4500;

function seededIndex(seed: number, length: number): number {
  if (length <= 0) return 0;
  return Math.abs(seed) % length;
}

export function LiveRouletteView({
  movies,
  seed,
  startedAt,
  winnerId,
  onComplete,
}: LiveRouletteViewProps) {
  const [tick, setTick] = useState(0);
  const winnerIndex = useMemo(() => {
    const fromId = movies.findIndex((movie) => movie.id === winnerId);
    if (fromId >= 0) return fromId;
    return seededIndex(seed, movies.length);
  }, [movies, seed, winnerId]);

  const elapsed = Date.now() - new Date(startedAt).getTime();
  const remaining = Math.max(0, SPIN_MS - elapsed);

  useEffect(() => {
    const timer = window.setTimeout(() => onComplete(), remaining);
    return () => window.clearTimeout(timer);
  }, [onComplete, remaining]);

  useEffect(() => {
    const interval = window.setInterval(() => setTick((n) => n + 1), 120);
    return () => window.clearInterval(interval);
  }, []);

  const progress = Math.min(1, (SPIN_MS - remaining + tick * 0) / SPIN_MS);
  const flashIndex =
    progress >= 1
      ? winnerIndex
      : seededIndex(seed + Math.floor((Date.now() - new Date(startedAt).getTime()) / 90), movies.length);
  const current = movies[flashIndex] ?? movies[winnerIndex];

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-5 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-netflix-muted">
        Final Roulette
      </p>
      <motion.div
        key={current?.id ?? "empty"}
        initial={{ opacity: 0.4, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.12 }}
        className="mt-8 w-48 overflow-hidden rounded-2xl shadow-[var(--shadow-elevated)]"
      >
        {current ? (
          <PosterImage
            src={current.posterUrl ?? ""}
            alt={current.title}
            className="aspect-[2/3] w-full object-cover"
          />
        ) : null}
      </motion.div>
      <p className="mt-6 text-2xl font-bold text-white">
        {progress >= 1 ? current?.title : "Spinning…"}
      </p>
    </div>
  );
}
