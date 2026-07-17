"use client";

import type { MouseEvent } from "react";
import { RecommendationSourceChip } from "@/components/recommendation/recommendation-source-chip";
import type { Movie, RecommendationSource, VoteValue } from "@/lib/types";

type MovieGridCardProps = {
  movie: Movie;
  source: RecommendationSource;
  vote?: VoteValue;
  onVote: (movieId: string, vote: VoteValue) => void;
  onOpen?: (movie: Movie) => void;
};

function StarIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 fill-current"
      viewBox="0 0 20 20"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

export function MovieGridCard({
  movie,
  source,
  vote,
  onVote,
  onOpen,
}: MovieGridCardProps) {
  function handleVote(nextVote: VoteValue, event: MouseEvent) {
    event.stopPropagation();
    onVote(movie.id, nextVote);
  }

  return (
    <article
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen ? () => onOpen(movie) : undefined}
      onKeyDown={
        onOpen
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen(movie);
              }
            }
          : undefined
      }
      className={`group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/5 bg-netflix-surface shadow-[0_8px_30px_rgba(0,0,0,0.45)] transition duration-300 ease-out hover:-translate-y-1.5 hover:scale-[1.02] hover:border-white/15 hover:shadow-[0_18px_44px_rgba(0,0,0,0.6)] ${
        onOpen
          ? "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-netflix-red"
          : ""
      }`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-black">
        {movie.posterUrl ? (
          <img
            alt={`${movie.title} poster`}
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-110 group-hover:brightness-110"
            src={movie.posterUrl}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-netflix-elevated text-sm text-netflix-muted">
            No poster
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

        <span className="absolute left-3 top-3 rounded-full bg-black/75 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          {vote === "like"
            ? "❤️ I'd Watch"
            : vote === "pass"
              ? "❌ Not for Me"
              : "Not Rated"}
        </span>

        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-md bg-black/75 px-2 py-1 text-xs font-semibold text-amber-400 backdrop-blur-sm">
          <StarIcon />
          IMDb {movie.rating.toFixed(1)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3 sm:p-4">
        <div className="space-y-1.5">
          <div className="space-y-1">
            <h2 className="line-clamp-2 text-sm font-bold leading-snug tracking-tight text-white sm:text-base">
              {movie.title}
            </h2>
            <p className="text-xs font-medium text-netflix-muted sm:text-sm">
              {movie.year > 0 ? movie.year : "—"}
            </p>
          </div>
          <RecommendationSourceChip type={source.type} label={source.label} />
        </div>

        {movie.genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {movie.genres.map((genre) => (
              <span
                key={genre}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[0.6875rem] font-medium text-netflix-muted transition-colors group-hover:border-white/20 group-hover:text-white/80"
              >
                {genre}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-1">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              aria-pressed={vote === "like"}
              onClick={(event) => handleVote("like", event)}
              className={`w-full rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors ${
                vote === "like"
                  ? "bg-netflix-red"
                  : "border border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              ❤️ I&apos;d Watch
            </button>
            <button
              type="button"
              aria-pressed={vote === "pass"}
              onClick={(event) => handleVote("pass", event)}
              className={`w-full rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                vote === "pass"
                  ? "border-white/30 bg-white/15 text-white"
                  : "border-white/10 bg-white/5 text-netflix-muted hover:bg-white/10 hover:text-white"
              }`}
            >
              ❌ Not for Me
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
