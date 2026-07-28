"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { RecommendationContext } from "@/components/recommendation/recommendation-context";
import { FadeIn } from "@/components/ui/fade-in";
import { PosterImage } from "@/components/ui/poster-image";
import { SwipeableVoteShell } from "@/components/rating/swipeable-vote-shell";
import type {
  Collection,
  Movie,
  RecommendationMetadata,
  RecommendationSource,
  VoteValue,
} from "@/lib/types";
import { useCollaborationStore } from "@/store/collaboration-store";
import { useVoteStore } from "@/store/vote-store";

type MovieDetailClientProps = {
  collection: Collection;
  movie: Movie;
  source: RecommendationSource;
  metadata?: RecommendationMetadata;
  addedByUserId: string;
};

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
  metadata,
  addedByUserId,
}: MovieDetailClientProps) {
  const router = useRouter();
  const voteMovie = useVoteStore((state) => state.voteMovie);
  const activeUserId = useCollaborationStore(
    (state) => state.activeUserId,
  );
  const activeUser = useCollaborationStore((state) =>
    state.users.find((user) => user.id === activeUserId),
  );
  const addedByUser = useCollaborationStore((state) =>
    state.users.find((user) => user.id === addedByUserId),
  );

  function handleVote(vote: VoteValue) {
    voteMovie(collection.id, movie.id, vote);
    router.push(`/collection/${collection.id}`);
  }

  const runtime = formatRuntime(movie.runtime);

  return (
    <FadeIn className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <Link
          href={`/collection/${collection.id}`}
          prefetch
          className="btn-ghost -ml-3 inline-flex items-center gap-2"
        >
          <span aria-hidden="true">←</span>
          {collection.emoji} {collection.name}
        </Link>
      </div>

      <SwipeableVoteShell
        onVote={handleVote}
        footer={(vote) => (
          <div className="flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:flex-wrap sm:px-8 sm:pb-7">
            <p className="w-full text-center text-xs text-netflix-muted/70">
              Rating as {activeUser?.name ?? "current user"}
            </p>
            <button
              type="button"
              onClick={() => vote("pass")}
              className="btn-secondary w-full sm:flex-1"
            >
              Not for Me
            </button>
            <button
              type="button"
              onClick={() => vote("like")}
              className="btn-primary w-full sm:flex-1"
            >
              I&apos;d Watch
            </button>
          </div>
        )}
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-black sm:aspect-[16/9]">
          <PosterImage
            src={movie.posterUrl}
            alt={`${movie.title} poster`}
            priority
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-netflix-surface via-black/20 to-black/30" />
          <div className="absolute inset-x-0 bottom-0 px-5 pb-5 sm:px-8 sm:pb-7">
            <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-lg sm:text-5xl">
              {movie.title}
            </h1>
          </div>
        </div>

        <div className="flex flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-netflix-muted sm:text-base">
            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-400">
              <Star
                aria-hidden="true"
                className="size-4 fill-current"
                strokeWidth={0}
              />
              TMDb {movie.rating.toFixed(1)}
            </span>
            {movie.year > 0 && <span>{movie.year}</span>}
            {runtime && <span>{runtime}</span>}
          </div>

          {movie.genres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {movie.genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-full bg-white/[0.05] px-3 py-1 text-xs font-medium text-netflix-muted"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
              Overview
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-netflix-muted sm:text-base">
              {movie.overview || "No overview available."}
            </p>
          </div>

          <RecommendationContext
            metadata={metadata}
            source={source}
            variant="detail"
          />
          <p className="text-xs text-netflix-muted/65">
            Added to PickIt by{" "}
            {addedByUserId === activeUserId
              ? "you"
              : addedByUser?.name ?? "a member"}
          </p>
        </div>
      </SwipeableVoteShell>
    </FadeIn>
  );
}
