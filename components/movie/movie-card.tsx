"use client";

import { useState } from "react";
import type { Movie } from "@/lib/types";

type MovieCardProps = {
  movie: Movie;
  onAdd?: (movie: Movie) => void;
  onPass?: (movie: Movie) => void;
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
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function MovieCard({ movie, onAdd, onPass }: MovieCardProps) {
  const [added, setAdded] = useState(false);

  return (
    <article className="group flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/5 bg-netflix-surface shadow-[0_8px_30px_rgba(0,0,0,0.45)] transition duration-300 ease-out hover:-translate-y-1 hover:scale-[1.015] hover:border-white/10 hover:shadow-[0_16px_40px_rgba(0,0,0,0.55)]">
      <div className="relative aspect-[2/3] overflow-hidden bg-black sm:aspect-video">
        <img
          alt={`${movie.title} poster`}
          className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-105"
          src={movie.posterUrl}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-netflix-surface via-transparent to-black/20" />
        <span className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
          {movie.year}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-4 sm:gap-3.5 sm:px-5 sm:pb-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 flex-1 text-xl font-bold leading-tight tracking-tight text-white sm:text-2xl">
            {movie.title}
          </h2>
          <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400/10 px-2.5 py-1 text-sm font-semibold text-amber-400">
            <StarIcon />
            {movie.rating.toFixed(1)}
          </span>
        </div>

        <p className="text-sm text-netflix-muted">{formatRuntime(movie.runtime)}</p>

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

        <p className="line-clamp-3 text-sm leading-relaxed text-netflix-muted">
          {movie.overview}
        </p>

        {(onAdd || onPass) && (
          <div className="mt-auto flex flex-col-reverse gap-2 pt-2 sm:flex-row">
            <button
              type="button"
              onClick={() => onPass?.(movie)}
              className="flex-1 rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 active:scale-[0.98]"
            >
              Pass
            </button>
            <button
              type="button"
              onClick={() => {
                setAdded(true);
                onAdd?.(movie);
              }}
              className="flex-1 rounded-xl bg-netflix-red px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-netflix-red-hover active:scale-[0.98]"
            >
              {added ? "✓ Added" : "❤️ Add to Bucket"}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
