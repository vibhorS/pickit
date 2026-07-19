"use client";

import { motion } from "framer-motion";
import { RecommendationContext } from "@/components/recommendation/recommendation-context";
import { PosterImage } from "@/components/ui/poster-image";
import { getVoteGlyph } from "@/lib/match-engine";
import { MOTION, staggerItem } from "@/lib/motion";
import type {
  Movie,
  RecommendationMetadata,
  RecommendationSource,
  VoteValue,
} from "@/lib/types";

type MovieGridCardProps = {
  movie: Movie;
  source: RecommendationSource;
  metadata?: RecommendationMetadata;
  vote?: VoteValue;
  partnerVote?: VoteValue;
  onOpen?: (movie: Movie) => void;
};

export function MovieGridCard({
  movie,
  source,
  metadata,
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
    <motion.article
      layout
      variants={staggerItem}
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
      whileHover={onOpen ? { y: -6 } : undefined}
      transition={{ duration: MOTION.duration, ease: MOTION.ease }}
      className={`group flex h-full w-full flex-col ${
        onOpen
          ? "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-netflix-red"
          : ""
      }`}
    >
      <div
        className={`relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-netflix-elevated transition-shadow duration-200 group-hover:shadow-[var(--shadow-elevated)] ${
          isMutual
            ? "ring-1 ring-rose-400/30 shadow-[0_8px_24px_rgba(244,63,94,0.12)]"
            : isWatch
              ? "ring-1 ring-emerald-400/30 shadow-[0_8px_24px_rgba(16,185,129,0.1)]"
              : "shadow-[var(--shadow-card)]"
        }`}
      >
        <div
          className={`h-full w-full transition duration-500 ease-out group-hover:scale-[1.03] ${
            isPass ? "brightness-[0.92] saturate-[0.85]" : ""
          }`}
        >
          <PosterImage
            src={movie.posterUrl}
            alt={`${movie.title} poster`}
          />
        </div>

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
        <RecommendationContext metadata={metadata} source={source} />
        <div className="flex items-center justify-between gap-2">
          <p className="text-[0.6875rem] text-netflix-muted/70">
            {movie.rating.toFixed(1)}
          </p>
          <p
            aria-label={`You ${mineGlyph}, partner ${partnerGlyph}`}
            className={`text-[0.75rem] tracking-tight ${
              isMutual ? "text-rose-300/90" : "text-netflix-muted/65"
            }`}
          >
            {pairLabel}
          </p>
        </div>
      </div>
    </motion.article>
  );
}
