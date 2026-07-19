"use client";

import { RecommendationContext } from "@/components/recommendation/recommendation-context";
import { PosterImage } from "@/components/ui/poster-image";
import type {
  Movie,
  RecommendationMetadata,
  RecommendationSource,
} from "@/lib/types";

type DecisionMovieCardProps = {
  movie: Movie;
  source?: RecommendationSource;
  metadata?: RecommendationMetadata;
};

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

export function DecisionMovieCard({
  movie,
  source,
  metadata,
}: DecisionMovieCardProps) {
  const runtime = formatRuntime(movie.runtime);
  const meta = [
    movie.year > 0 ? String(movie.year) : null,
    runtime,
    movie.rating > 0 ? movie.rating.toFixed(1) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="relative overflow-hidden">
      {movie.posterUrl && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${movie.posterUrl})` }}
        />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-netflix-surface via-netflix-surface/92 to-black/55"
      />

      <div className="relative flex flex-col gap-7 px-5 pb-2 pt-8 sm:flex-row sm:items-end sm:gap-8 sm:px-8 sm:pt-12">
        <div className="mx-auto w-40 shrink-0 overflow-hidden rounded-xl shadow-[var(--shadow-elevated)] sm:mx-0 sm:w-44">
          <div className="aspect-[2/3]">
            <PosterImage
              src={movie.posterUrl}
              alt={`${movie.title} poster`}
              priority
            />
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3.5 pb-1">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {movie.title}
            </h2>
            {meta && (
              <p className="mt-2 text-sm text-netflix-muted">{meta}</p>
            )}
          </div>

          {movie.genres.length > 0 && (
            <p className="text-sm text-netflix-muted/85">
              {movie.genres.join(" · ")}
            </p>
          )}

          <p className="line-clamp-4 text-sm leading-relaxed text-netflix-muted">
            {movie.overview || "No overview available."}
          </p>

          {source && (
            <RecommendationContext
              metadata={metadata}
              source={source}
              variant="movie-night"
            />
          )}

          <StreamingPlaceholder />
        </div>
      </div>
    </div>
  );
}

type CelebrationProps = {
  movie: Movie;
  onHome: () => void;
  onPickAgain: () => void;
};

/** @deprecated Prefer WinnerScreen — kept for any legacy imports. */
export function MovieNightCelebration({
  movie,
  onHome,
  onPickAgain,
}: CelebrationProps) {
  const runtime = formatRuntime(movie.runtime);

  return (
    <div className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-3xl">
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
          {runtime && (
            <p className="mt-1 text-sm text-netflix-muted">{runtime}</p>
          )}

          <div className="mt-8 w-full">
            <StreamingPlaceholder />
          </div>

          <button type="button" onClick={onHome} className="btn-primary mt-8 w-full">
            Back Home
          </button>
          <button
            type="button"
            onClick={onPickAgain}
            className="btn-ghost mt-2 w-full"
          >
            Pick Again
          </button>
        </div>
      </div>
    </div>
  );
}
