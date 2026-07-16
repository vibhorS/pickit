"use client";

import { useEffect } from "react";
import type { Movie } from "@/lib/types";

type MovieDetailDrawerProps = {
  movie: Movie | null;
  onClose: () => void;
  onRemove: (movieId: string) => void;
};

function StarIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0 fill-current"
      viewBox="0 0 20 20"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function formatRuntime(minutes: number) {
  if (!minutes || minutes <= 0) return "—";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes}m`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

export function MovieDetailDrawer({
  movie,
  onClose,
  onRemove,
}: MovieDetailDrawerProps) {
  useEffect(() => {
    if (!movie) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [movie, onClose]);

  if (!movie) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="movie-detail-title"
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-white/10 bg-netflix-surface shadow-[-12px_0_40px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative aspect-[2/3] w-full shrink-0 bg-black sm:aspect-[16/10]">
          {movie.posterUrl ? (
            <img
              src={movie.posterUrl}
              alt={`${movie.title} poster`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-netflix-elevated text-netflix-muted">
              No poster
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-netflix-surface via-transparent to-black/30" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-black/60 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/80"
          >
            Close
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 px-5 py-6 sm:px-6">
          <div className="space-y-3">
            <h2
              id="movie-detail-title"
              className="text-2xl font-black tracking-tight text-white sm:text-3xl"
            >
              {movie.title}
            </h2>

            <div className="flex flex-wrap items-center gap-3 text-sm text-netflix-muted">
              <span className="inline-flex items-center gap-1 font-semibold text-amber-400">
                <StarIcon />
                IMDb {movie.rating.toFixed(1)}
              </span>
              <span>{movie.year > 0 ? movie.year : "—"}</span>
              <span>{formatRuntime(movie.runtime)}</span>
            </div>

            {movie.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {movie.genres.map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-medium text-netflix-muted"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-white">
              Overview
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-netflix-muted">
              {movie.overview || "No overview available."}
            </p>
          </div>

          <div className="rounded-xl border border-dashed border-white/15 bg-black/20 px-4 py-5">
            <p className="text-sm text-netflix-muted">
              Streaming availability coming soon
            </p>
          </div>

          <div className="mt-auto pt-2">
            <button
              type="button"
              onClick={() => onRemove(movie.id)}
              className="w-full rounded-xl border border-netflix-red/40 bg-netflix-red/10 px-4 py-3 text-sm font-bold uppercase tracking-wide text-netflix-red transition-colors hover:bg-netflix-red/20"
            >
              Remove from collection
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
