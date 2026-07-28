"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { RecommendationContext } from "@/components/recommendation/recommendation-context";
import { PosterImage } from "@/components/ui/poster-image";
import { FadeIn } from "@/components/ui/fade-in";
import type {
  Movie,
  RecommendationMetadata,
  RecommendationSource,
} from "@/lib/types";
import { useCollaborationStore } from "@/store/collaboration-store";

function formatRuntime(minutes: number): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

type WinnerScreenProps = {
  movie: Movie;
  source?: RecommendationSource;
  metadata?: RecommendationMetadata;
  addedByUserId?: string;
  onPickAgain: () => void;
};

export function WinnerScreen({
  movie,
  source,
  metadata,
  addedByUserId,
  onPickAgain,
}: WinnerScreenProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const runtime = formatRuntime(movie.runtime);
  const activeUserId = useCollaborationStore(
    (state) => state.activeUserId,
  );
  const addedByUser = useCollaborationStore((state) =>
    state.users.find((user) => user.id === addedByUserId),
  );
  const meta = [
    movie.year > 0 ? String(movie.year) : null,
    runtime,
    movie.genres.slice(0, 2).join(" · "),
    movie.rating > 0 ? `TMDb ${movie.rating.toFixed(1)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  function showPlaceholder(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2400);
  }

  return (
    <FadeIn className="relative mx-auto min-h-[72vh] w-full max-w-4xl overflow-hidden rounded-[2rem] bg-netflix-surface shadow-[var(--shadow-elevated)]">
      {movie.posterUrl && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center opacity-50 blur-xl"
          style={{ backgroundImage: `url(${movie.posterUrl})` }}
        />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/25"
      />

      <div aria-hidden="true" className="absolute inset-x-0 top-0 z-20">
        {["🎉", "✨", "🍿", "⭐", "✨"].map((symbol, index) => (
          <motion.span
            key={`${symbol}-${index}`}
            initial={{ opacity: 0, y: -20, x: `${index * 18 + 8}vw` }}
            animate={{ opacity: [0, 1, 0], y: [0, 90, 170], rotate: 180 }}
            transition={{ duration: 2.2, delay: index * 0.12 }}
            className="absolute text-xl"
          >
            {symbol}
          </motion.span>
        ))}
      </div>

      <div className="relative z-10 flex min-h-[72vh] flex-col items-center justify-end px-5 py-9 text-center sm:px-10 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, delay: 0.15 }}
          className="aspect-[2/3] w-44 overflow-hidden rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,0.65)] sm:w-52"
        >
          <PosterImage
            src={movie.posterUrl}
            alt={`${movie.title} poster`}
            priority
          />
        </motion.div>

        <p className="mt-7 text-xs font-semibold uppercase tracking-[0.24em] text-netflix-red">
          Tonight&apos;s Winner
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-6xl">
          {movie.title}
        </h1>
        {meta && <p className="mt-3 text-sm text-white/65">{meta}</p>}

        {source && (
          <div className="mt-5 max-w-lg text-left">
            <RecommendationContext
              metadata={metadata}
              source={source}
              variant="movie-night"
            />
          </div>
        )}
        {addedByUserId && (
          <p className="mt-3 text-xs text-white/55">
            Added by{" "}
            {addedByUserId === activeUserId
              ? "you"
              : addedByUser?.name ?? "a member"}
          </p>
        )}

        <div className="mt-8 grid w-full max-w-md gap-3 sm:grid-cols-2">
          <a
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${movie.title} ${movie.year} official trailer`)}`}
            target="_blank"
            rel="noreferrer"
            className="btn-primary min-h-12 w-full"
          >
            ▶ Watch Trailer
          </a>
          <button
            type="button"
            onClick={() =>
              showPlaceholder("Streaming availability is coming soon.")
            }
            className="btn-secondary min-h-12 w-full"
          >
            📺 Where to Watch
          </button>
          <button
            type="button"
            onClick={onPickAgain}
            className="btn-ghost min-h-11 w-full sm:col-span-2"
          >
            🔄 Pick Again
          </button>
        </div>

        <div aria-live="polite" className="mt-4 h-5 text-sm text-white/55">
          {notice}
        </div>
      </div>
    </FadeIn>
  );
}
