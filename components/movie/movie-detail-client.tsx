"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RecommendationSourceChip } from "@/components/recommendation/recommendation-source-chip";
import type { Collection, Movie, RecommendationSource, VoteValue } from "@/lib/types";
import { useVoteStore } from "@/store/vote-store";

type MovieDetailClientProps = {
  collection: Collection;
  movie: Movie;
  source: RecommendationSource;
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

function formatRuntime(minutes: number): string {
  if (!minutes || minutes <= 0) return "";

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function MovieDetailClient({
  collection,
  movie,
  source,
}: MovieDetailClientProps) {
  const router = useRouter();
  const voteMovie = useVoteStore((state) => state.voteMovie);

  function handleVote(vote: VoteValue) {
    voteMovie(collection.id, movie.id, vote);
    router.push(`/collection/${collection.id}`);
  }

  const runtime = formatRuntime(movie.runtime);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <Link
          href={`/collection/${collection.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-netflix-muted transition-colors hover:text-white"
        >
          <span aria-hidden="true">←</span>
          {collection.emoji} {collection.name}
        </Link>
      </div>

      <article className="overflow-hidden rounded-3xl border border-white/5 bg-netflix-surface shadow-[0_16px_48px_rgba(0,0,0,0.55)]">
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-black sm:aspect-[16/9]">
          {movie.posterUrl ? (
            <img
              alt={`${movie.title} poster`}
              className="h-full w-full object-cover"
              src={movie.posterUrl}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-netflix-elevated text-sm text-netflix-muted">
              No poster
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-netflix-surface via-black/20 to-black/30" />

          <div className="absolute inset-x-0 bottom-0 px-6 pb-6 sm:px-10 sm:pb-8">
            <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-lg sm:text-5xl">
              {movie.title}
            </h1>
          </div>
        </div>

        <div className="flex flex-col gap-6 px-6 py-6 sm:px-10 sm:py-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-netflix-muted sm:text-base">
            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-400">
              <StarIcon />
              TMDb {movie.rating.toFixed(1)}
            </span>
            {movie.year > 0 && <span>{movie.year}</span>}
            {runtime && <span>{runtime}</span>}
            <RecommendationSourceChip type={source.type} label={source.label} />
          </div>

          {movie.genres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {movie.genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-netflix-muted"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}

          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">
              Overview
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-netflix-muted sm:text-base">
              {movie.overview || "No overview available."}
            </p>
          </div>

          <div className="mt-2 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row">
            <button
              type="button"
              onClick={() => handleVote("pass")}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-6 py-4 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/10 sm:flex-1"
            >
              ❌ Not for Me
            </button>
            <button
              type="button"
              onClick={() => handleVote("like")}
              className="w-full rounded-xl bg-netflix-red px-6 py-4 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-netflix-red-hover sm:flex-1"
            >
              ❤️ I&apos;d Watch
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
