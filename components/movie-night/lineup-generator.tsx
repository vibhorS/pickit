"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { PosterImage } from "@/components/ui/poster-image";
import type { CollectionMovie } from "@/lib/services/movie-service";
import type { Collection } from "@/lib/types";

const STEPS = [
  "Shuffling the list…",
  "Finding mutual matches…",
  "Building tonight's lineup…",
] as const;

type LineupGeneratorProps = {
  collection: Collection;
  queue: CollectionMovie[];
  onComplete: () => void;
};

export function LineupGenerator({
  collection,
  queue,
  onComplete,
}: LineupGeneratorProps) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const stepTimers = [650, 1300].map((delay, index) =>
      window.setTimeout(() => setStepIndex(index + 1), delay),
    );
    const completeTimer = window.setTimeout(onComplete, 2200);
    return () => {
      stepTimers.forEach(window.clearTimeout);
      window.clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className="relative mx-auto flex min-h-[68vh] w-full max-w-4xl items-center justify-center overflow-hidden rounded-[2rem]">
      <div
        aria-hidden="true"
        className="absolute inset-0 grid grid-cols-4 opacity-25 blur-[2px]"
      >
        {queue.slice(0, 8).map((item) => (
          <div key={item.movie.id} className="min-h-40">
            <PosterImage src={item.movie.posterUrl} alt="" />
          </div>
        ))}
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />

      <div className="relative z-10 px-6 text-center">
        <motion.div
          animate={{ rotate: [0, 4, -4, 0], y: [0, -5, 0] }}
          transition={{ duration: 0.9, repeat: Infinity }}
          className="mx-auto grid size-20 place-items-center rounded-3xl bg-white/10 text-4xl shadow-[var(--shadow-elevated)] backdrop-blur-md"
          aria-hidden="true"
        >
          {collection.emoji}
        </motion.div>
        <p className="mt-7 text-xs font-semibold uppercase tracking-[0.22em] text-netflix-red">
          {collection.name}
        </p>
        <motion.h1
          key={stepIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl"
        >
          {STEPS[stepIndex]}
        </motion.h1>
        <div className="mx-auto mt-8 flex w-36 gap-2">
          {STEPS.map((step, index) => (
            <span
              key={step}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                index <= stepIndex ? "bg-netflix-red" : "bg-white/15"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
