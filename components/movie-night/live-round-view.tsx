"use client";

import { Heart, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { DecisionMovieCard } from "@/components/movie-night/decision-movie-card";
import { Button } from "@/components/ui/button";
import type { CollectionMovie } from "@/lib/services/movie-service";
import type { MovieNightLastOutcome } from "@/lib/movie-night/live/types";

type LiveRoundViewProps = {
  item: CollectionMovie;
  hasVoted: boolean;
  busy: boolean;
  flashOutcome: MovieNightLastOutcome | null;
  onWatch: () => void;
  onPass: () => void;
};

export function LiveRoundView({
  item,
  hasVoted,
  busy,
  flashOutcome,
  onWatch,
  onPass,
}: LiveRoundViewProps) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <AnimatePresence mode="wait">
        {flashOutcome === "maybe" ? (
          <motion.p
            key="maybe"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 text-center text-sm text-netflix-muted"
          >
            Added to the Maybe pile.
          </motion.p>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={item.movie.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <DecisionMovieCard
            movie={item.movie}
            source={item.source}
            metadata={item.metadata}
            addedByUserId={item.addedByUserId}
            showOverview
          />
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex flex-col items-center gap-3">
        {hasVoted ? null : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex w-full max-w-md gap-3"
          >
            <Button
              variant="secondary"
              className="flex-1"
              disabled={busy}
              onClick={onPass}
            >
              <X className="mr-2 size-4" aria-hidden="true" />
              Pass
            </Button>
            <Button
              className="flex-1"
              disabled={busy}
              onClick={onWatch}
            >
              <Heart className="mr-2 size-4" aria-hidden="true" />
              Watch
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
