"use client";

import { RecommendationSourceChip } from "@/components/recommendation/recommendation-source-chip";
import type { Movie, RecommendationSource, VoteValue } from "@/lib/types";

type MovieGridCardProps = {
  movie: Movie;
  source: RecommendationSource;
  vote?: VoteValue;
  onOpen?: (movie: Movie) => void;
};

function voteStatusLabel(vote?: VoteValue): string {
  if (vote === "like") return "❤️ I'd Watch";
  if (vote === "pass") return "❌ Not for Me";
  return "Not Rated";
}

export function MovieGridCard({
  movie,
  source,
  vote,
  onOpen,
}: MovieGridCardProps) {
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
      className={`group flex h-full w-full flex-col transition duration-300 ease-out hover:-translate-y-1 ${
        onOpen
          ? "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-netflix-red"
          : ""
      }`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-netflix-elevated shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-shadow duration-300 group-hover:shadow-[0_16px_36px_rgba(0,0,0,0.5)]">
        {movie.posterUrl ? (
          <img
            alt={`${movie.title} poster`}
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.03]"
            src={movie.posterUrl}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-netflix-muted">
            No poster
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 pt-3.5">
        <h2 className="line-clamp-2 text-[0.8125rem] font-medium leading-snug tracking-tight text-white sm:text-sm">
          {movie.title}
        </h2>
        <RecommendationSourceChip type={source.type} label={source.label} />
        <p className="text-[0.6875rem] text-netflix-muted/70">
          {movie.rating.toFixed(1)}
        </p>
        <p
          className={`text-[0.625rem] font-medium ${
            vote === "like"
              ? "text-netflix-red/80"
              : vote === "pass"
                ? "text-netflix-muted/60"
                : "text-netflix-muted/45"
          }`}
        >
          {voteStatusLabel(vote)}
        </p>
      </div>
    </article>
  );
}
