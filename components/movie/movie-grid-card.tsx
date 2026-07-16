"use client";

import type { MouseEvent } from "react";
import type { Movie, VoteValue } from "@/lib/types";
import { useVoteStore } from "@/store/vote-store";

type MovieGridCardProps = {
  movie: Movie;
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

export function MovieGridCard({ movie, onOpen }: MovieGridCardProps) {
  const vote = useVoteStore((state) =>
    state.votes.find((item) => item.movieId === movie.id),
  );
  const voteMovie = useVoteStore((state) => state.voteMovie);

  function handleVote(nextVote: VoteValue, event: MouseEvent) {
    event.stopPropagation();
    voteMovie(movie.id, nextVote);
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

        {!vote && (
          <span className="absolute left-3 top-3 rounded-full bg-white/10 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-netflix-muted backdrop-blur-sm">
            Not Rated
          </span>
        )}

        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-md bg-black/75 px-2 py-1 text-xs font-semibold text-amber-400 backdrop-blur-sm">
          <StarIcon />
          IMDb {movie.rating.toFixed(1)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3 sm:p-4">
        <div className="space-y-1">
          <h2 className="line-clamp-2 text-sm font-bold leading-snug tracking-tight text-white sm:text-base">
            {movie.title}
          </h2>
          <p className="text-xs font-medium text-netflix-muted sm:text-sm">
            {movie.year > 0 ? movie.year : "—"}
          </p>
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
          {!vote ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={(event) => handleVote("like", event)}
                className="w-full rounded-lg bg-netflix-red px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-netflix-red-hover"
              >
                ❤️ I&apos;d Watch
              </button>
              <button
                type="button"
                onClick={(event) => handleVote("pass", event)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/10"
              >
                ❌ Pass
              </button>
            </div>
          ) : vote.vote === "like" ? (
            <span className="inline-flex w-full items-center justify-center rounded-lg bg-netflix-red/15 px-3 py-2 text-xs font-bold uppercase tracking-wide text-netflix-red">
              ❤️ You&apos;d Watch
            </span>
          ) : (
            <span className="inline-flex w-full items-center justify-center rounded-lg bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-netflix-muted">
              ❌ Passed
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
