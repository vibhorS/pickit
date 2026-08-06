"use client";

import { motion } from "framer-motion";
import { RecommendationContext } from "@/components/recommendation/recommendation-context";
import { PosterImage } from "@/components/ui/poster-image";
import type {
  Movie,
  RecommendationMetadata,
  RecommendationSource,
} from "@/lib/types";
import { useCollaborationStore } from "@/store/collaboration-store";

type DecisionMovieCardProps = {
  movie: Movie;
  source?: RecommendationSource;
  metadata?: RecommendationMetadata;
  addedByUserId?: string;
  showOverview?: boolean;
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
  addedByUserId,
  showOverview = false,
}: DecisionMovieCardProps) {
  const activeUserId = useCollaborationStore(
    (state) => state.activeUserId,
  );
  const addedByUser = useCollaborationStore((state) =>
    state.users.find((user) => user.id === addedByUserId),
  );
  const runtime = formatRuntime(movie.runtime);
  const meta = [
    movie.year > 0 ? String(movie.year) : null,
    runtime,
    movie.rating > 0 ? `TMDb ${movie.rating.toFixed(1)}` : null,
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

          {showOverview && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="text-sm leading-relaxed text-netflix-muted"
            >
              {movie.overview || "No overview available."}
            </motion.p>
          )}

          {source && (
            <RecommendationContext
              metadata={metadata}
              source={source}
              variant="movie-night"
            />
          )}
          {addedByUserId && (
            <p className="text-xs text-netflix-muted/65">
              Added by{" "}
              {addedByUserId === activeUserId
                ? "you"
                : addedByUser?.name ?? "a member"}
            </p>
          )}

          <StreamingPlaceholder />
        </div>
      </div>
    </div>
  );
}
