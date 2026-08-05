"use client";

import { Heart, X } from "lucide-react";
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
      {flashOutcome === "maybe" ? (
        <p className="mb-4 text-center text-sm text-netflix-muted animate-in fade-in">
          Added to the Maybe pile.
        </p>
      ) : null}

      <DecisionMovieCard
        movie={item.movie}
        source={item.source}
        metadata={item.metadata}
        addedByUserId={item.addedByUserId}
        showOverview
      />

      <div className="mt-8 flex flex-col items-center gap-3">
        {hasVoted ? null : (
          <div className="flex w-full max-w-md gap-3">
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
          </div>
        )}
      </div>
    </div>
  );
}
