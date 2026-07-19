"use client";

import { Star } from "lucide-react";
import { RecommendationContext } from "@/components/recommendation/recommendation-context";
import { SwipeableVoteShell } from "@/components/rating/swipeable-vote-shell";
import { PosterImage } from "@/components/ui/poster-image";
import type {
  Movie,
  RecommendationMetadata,
  RecommendationSource,
  VoteValue,
} from "@/lib/types";

type RateMovieCardProps = {
  movie: Movie;
  source: RecommendationSource;
  metadata?: RecommendationMetadata;
  onVote: (vote: VoteValue) => void;
};

function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function RateMovieCard({
  movie,
  source,
  metadata,
  onVote,
}: RateMovieCardProps) {
  const metaParts = [
    movie.year > 0 ? String(movie.year) : null,
    `TMDb ${movie.rating.toFixed(1)}`,
    movie.runtime > 0 ? formatRuntime(movie.runtime) : null,
  ].filter(Boolean);

  return (
    <SwipeableVoteShell
      onVote={onVote}
      footer={(vote) => (
        <div className="flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:px-6 sm:pb-6">
          <button
            type="button"
            onClick={() => vote("pass")}
            className="btn-secondary w-full sm:flex-1"
          >
            Not for Me
          </button>
          <button
            type="button"
            onClick={() => vote("like")}
            className="btn-primary w-full sm:flex-1"
          >
            I&apos;d Watch
          </button>
        </div>
      )}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-black sm:aspect-[3/4]">
        <PosterImage
          src={movie.posterUrl}
          alt={`${movie.title} poster`}
          priority
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-netflix-surface via-transparent to-black/25" />
      </div>

      <div className="flex flex-col gap-4 px-5 py-5 sm:px-6 sm:py-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {movie.title}
          </h2>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-netflix-muted">
            <span className="inline-flex items-center gap-1 text-amber-400">
              <Star
                aria-hidden="true"
                className="size-3.5 fill-current"
                strokeWidth={0}
              />
            </span>
            {metaParts.join(" · ")}
          </p>
        </div>

        <RecommendationContext
          metadata={metadata}
          source={source}
          variant="movie-night"
        />

        {movie.genres.length > 0 && (
          <p className="text-sm text-netflix-muted/85">
            {movie.genres.join(" · ")}
          </p>
        )}

        <p className="line-clamp-3 text-sm leading-relaxed text-netflix-muted">
          {movie.overview || "No overview available."}
        </p>
      </div>
    </SwipeableVoteShell>
  );
}
