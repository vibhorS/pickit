"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SwipeDeck } from "@/components/movie/swipe-deck";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { collectionService } from "@/lib/services/collection-service";
import { movieService } from "@/lib/services/movie-service";
import { useBucketStore } from "@/store/bucket-store";

export default function DecidePage() {
  const params = useParams<{ collectionId: string }>();
  const collectionId = params.collectionId;
  const collection = collectionService.getById(collectionId);
  const addMovie = useBucketStore((state) => state.addMovie);

  if (!collection) {
    return (
      <PageShell>
        <EmptyState
          emoji="❓"
          title="Collection not found"
          description="This collection doesn’t exist or may have been removed."
        />
        <div className="mt-8 text-center">
          <Link
            href="/collections"
            className="inline-block rounded-xl bg-netflix-red px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-netflix-red-hover"
          >
            Back to Collections
          </Link>
        </div>
      </PageShell>
    );
  }

  const movies = movieService.getMoviesByIds(collection.movieIds);

  return (
    <PageShell wide>
      <div className="mx-auto w-full max-w-md text-center sm:max-w-none">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-netflix-red">
          Decision Mode
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-white">
          {collection.emoji} {collection.name}
        </h1>
        <p className="mt-3 text-netflix-muted">
          Pass or add movies to your shared bucket.
        </p>

        <div className="mt-12">
          {movies.length === 0 ? (
            <EmptyState
              emoji="🎬"
              title="Nothing to decide yet"
              description="Add a few movies to this collection first, then come back to start deciding."
            />
          ) : (
            <SwipeDeck movies={movies} onAdd={addMovie} />
          )}
        </div>

        <div className="mt-10">
          <Link
            href={`/collection/${collection.id}`}
            className="inline-block rounded-xl bg-netflix-elevated/80 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-netflix-elevated"
          >
            Back to Collection
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
