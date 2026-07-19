"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Film } from "lucide-react";
import { MovieDetailClient } from "@/components/movie/movie-detail-client";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/ui/fade-in";
import { MovieDetailSkeleton } from "@/components/ui/skeleton";
import type { CollectionMovie } from "@/lib/services/movie-service";
import type { Collection } from "@/lib/types";
import { useLocalCollectionStore } from "@/store/local-collection-store";

type MovieDetailResolverProps = {
  collection: Collection;
  movieId: string;
  initialItem: CollectionMovie | null;
};

export function MovieDetailResolver({
  collection,
  movieId,
  initialItem,
}: MovieDetailResolverProps) {
  const [hasHydrated, setHasHydrated] = useState(false);
  const byCollection = useLocalCollectionStore((state) => state.byCollection);
  const localItem = byCollection[collection.id]?.find(
    (item) => item.movie.id === movieId,
  );

  useEffect(() => {
    const unsub = useLocalCollectionStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });
    if (useLocalCollectionStore.persist.hasHydrated()) {
      setHasHydrated(true);
    }
    return unsub;
  }, []);

  if (!movieId) {
    return (
      <FadeIn className="mx-auto w-full max-w-lg">
        <EmptyState
          icon={<Film className="size-7" strokeWidth={1.5} />}
          title="Missing movie"
          description="That link is incomplete. Head back to the collection and try again."
        />
        <div className="text-center">
          <Link
            href={`/collection/${collection.id}`}
            prefetch
            className="btn-primary"
          >
            Back to Collection
          </Link>
        </div>
      </FadeIn>
    );
  }

  if (!hasHydrated && !initialItem) {
    return (
      <div className="mx-auto w-full max-w-lg py-8">
        <MovieDetailSkeleton />
      </div>
    );
  }

  // Match collection grids/stats: locally persisted recommendation context wins.
  const item = localItem ?? initialItem;

  if (!item) {
    return (
      <FadeIn className="mx-auto w-full max-w-lg">
        <EmptyState
          icon={<Film className="size-7" strokeWidth={1.5} />}
          title="Movie not found"
          description="This title isn’t in the collection anymore, or it hasn’t finished saving. Open the collection and try again."
        />
        <div className="text-center">
          <Link
            href={`/collection/${collection.id}`}
            prefetch
            className="btn-primary"
          >
            Back to Collection
          </Link>
        </div>
      </FadeIn>
    );
  }

  return (
    <MovieDetailClient
      collection={collection}
      movie={item.movie}
      source={item.source}
      metadata={item.metadata}
    />
  );
}
