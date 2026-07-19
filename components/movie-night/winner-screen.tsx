"use client";

import { RecommendationContext } from "@/components/recommendation/recommendation-context";
import { PosterImage } from "@/components/ui/poster-image";
import { FadeIn } from "@/components/ui/fade-in";
import type {
  Movie,
  RecommendationMetadata,
  RecommendationSource,
} from "@/lib/types";

function formatRuntime(minutes: number): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function StreamingPlaceholder() {
  return (
    <div className="rounded-xl bg-white/[0.04] px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-netflix-muted/70">
        Where to watch
      </p>
      <p className="mt-1.5 text-sm text-netflix-muted">
        Streaming availability coming soon.
      </p>
    </div>
  );
}

type WinnerScreenProps = {
  movie: Movie;
  source?: RecommendationSource;
  metadata?: RecommendationMetadata;
  onHome: () => void;
  onPlayAnotherGame: () => void;
  onChooseCollection: () => void;
};

export function WinnerScreen({
  movie,
  source,
  metadata,
  onHome,
  onPlayAnotherGame,
  onChooseCollection,
}: WinnerScreenProps) {
  const runtime = formatRuntime(movie.runtime);

  return (
    <FadeIn className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-3xl">
      {movie.posterUrl && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center opacity-40 blur-2xl"
          style={{ backgroundImage: `url(${movie.posterUrl})` }}
        />
      )}
      <div className="relative px-5 py-8 sm:px-10 sm:py-12">
        <div className="mx-auto flex max-w-sm flex-col items-center text-center">
          <div className="aspect-[2/3] w-48 overflow-hidden rounded-2xl shadow-[var(--shadow-elevated)] sm:w-56">
            <PosterImage
              src={movie.posterUrl}
              alt={`${movie.title} poster`}
              priority
            />
          </div>

          <p aria-hidden="true" className="mt-8 text-4xl">
            🎉
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Enjoy your movie night!
          </h2>
          <p className="mt-3 text-xl font-semibold text-white">{movie.title}</p>
          <p className="mt-1 text-sm text-netflix-muted">
            {[runtime, movie.genres.slice(0, 3).join(" · ")]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {source && (
            <div className="mt-4 text-left">
              <RecommendationContext
                metadata={metadata}
                source={source}
                variant="movie-night"
              />
            </div>
          )}

          <div className="mt-8 w-full">
            <StreamingPlaceholder />
          </div>

          <button type="button" onClick={onHome} className="btn-primary mt-8 w-full">
            Back Home
          </button>
          <button
            type="button"
            onClick={onPlayAnotherGame}
            className="btn-secondary mt-3 w-full"
          >
            Play Another Game
          </button>
          <button
            type="button"
            onClick={onChooseCollection}
            className="btn-ghost mt-2 w-full"
          >
            Choose Another Collection
          </button>
        </div>
      </div>
    </FadeIn>
  );
}
