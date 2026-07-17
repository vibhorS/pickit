"use client";

import { RecommendationSourceChip } from "@/components/recommendation/recommendation-source-chip";
import { getVoteGlyph } from "@/lib/match-engine";
import type { Movie, RecommendationSource, VoteValue } from "@/lib/types";

type MovieGridCardProps = {
  movie: Movie;
  source: RecommendationSource;
  vote?: VoteValue;
  partnerVote?: VoteValue;
  onOpen?: (movie: Movie) => void;
};

export function MovieGridCard({
  movie,
  source,
  vote,
  partnerVote,
  onOpen,
}: MovieGridCardProps) {
  const isWatch = vote === "like";
  const isPass = vote === "pass";
  const isNew = !vote;
  const isMutual = vote === "like" && partnerVote === "like";
  const mineGlyph = getVoteGlyph(vote);
  const partnerGlyph = getVoteGlyph(partnerVote);
  const pairLabel = `${mineGlyph}${partnerGlyph}`;

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
      className={`group flex h-full w-full flex-col transition duration-300 ease-out hover:-translate-y-1.5 ${
        onOpen
          ? "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-netflix-red"
          : ""
      }`}
    >
      <div
        className={`relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-netflix-elevated transition-shadow duration-300 group-hover:shadow-[0_16px_36px_rgba(0,0,0,0.5)] ${
          isMutual
            ? "ring-1 ring-rose-400/30 shadow-[0_8px_24px_rgba(244,63,94,0.12)]"
            : isWatch
              ? "ring-1 ring-emerald-400/30 shadow-[0_8px_24px_rgba(16,185,129,0.1)]"
              : isPass
                ? "shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
                : "shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        }`}
      >
        {movie.posterUrl ? (
          <img
            alt={`${movie.title} poster`}
            className={`h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.03] ${
              isPass ? "brightness-[0.92] saturate-[0.85]" : ""
            }`}
            src={movie.posterUrl}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-netflix-muted">
            No poster
          </div>
        )}

        {isNew && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[0.625rem] font-medium text-emerald-300/90 backdrop-blur-sm">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-emerald-400"
            />
            New
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 pt-3.5">
        <h2 className="line-clamp-2 text-[0.8125rem] font-medium leading-snug tracking-tight text-white sm:text-sm">
          {movie.title}
        </h2>
        <RecommendationSourceChip type={source.type} label={source.label} />
        <div className="flex items-center justify-between gap-2">
          <p className="text-[0.6875rem] text-netflix-muted/70">
            {movie.rating.toFixed(1)}
          </p>
          <p
            aria-label={`You ${mineGlyph}, partner ${partnerGlyph}`}
            className={`text-[0.75rem] tracking-tight ${
              isMutual
                ? "text-rose-300/90"
                : "text-netflix-muted/65"
            }`}
          >
            {pairLabel}
          </p>
        </div>
      </div>
    </article>
  );
}
