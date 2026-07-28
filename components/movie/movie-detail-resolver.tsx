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
import {
  EMPTY_CREATED_COLLECTIONS,
  useLocalCollectionStore,
} from "@/store/local-collection-store";
import { useCollaborationStore } from "@/store/collaboration-store";

type MovieDetailResolverProps = {
  collectionId: string;
  seedCollection: Collection | null;
  movieId: string;
  initialItem: CollectionMovie | null;
};

export function MovieDetailResolver({
  collectionId,
  seedCollection,
  movieId,
  initialItem,
}: MovieDetailResolverProps) {
  const [hasHydrated, setHasHydrated] = useState(false);
  const byCollection = useLocalCollectionStore((state) => state.byCollection);
  const createdCollections = useLocalCollectionStore(
    (state) => state.createdCollections,
  );
  const collectionOverride = useLocalCollectionStore(
    (state) => state.collectionOverrides[collectionId],
  );
  const baseCollection =
    seedCollection ??
    (createdCollections ?? EMPTY_CREATED_COLLECTIONS).find(
      (entry) => entry.id === collectionId,
    );
  const collection =
    baseCollection && !collectionOverride?.deleted
      ? {
          ...baseCollection,
          name: collectionOverride?.name ?? baseCollection.name,
          emoji: collectionOverride?.emoji ?? baseCollection.emoji,
        }
      : undefined;
  const localItem = byCollection[collectionId]?.find(
    (item) => item.movie.id === movieId,
  );

  useEffect(() => {
    const finish = () => setHasHydrated(true);
    const unsubLocal =
      useLocalCollectionStore.persist.onFinishHydration(finish);
    const unsubCollaboration =
      useCollaborationStore.persist.onFinishHydration(finish);
    if (
      useLocalCollectionStore.persist.hasHydrated() &&
      useCollaborationStore.persist.hasHydrated()
    ) {
      queueMicrotask(finish);
    }
    return () => {
      unsubLocal();
      unsubCollaboration();
    };
  }, []);

  if (!movieId || !collectionId) {
    return (
      <FadeIn className="mx-auto w-full max-w-lg">
        <EmptyState
          icon={<Film className="size-7" strokeWidth={1.5} />}
          title="Missing movie"
          description="That link is incomplete. Head back to the list and try again."
        />
        <div className="text-center">
          <Link
            href={`/collection/${collectionId}`}
            prefetch
            className="btn-primary"
          >
            Back to List
          </Link>
        </div>
      </FadeIn>
    );
  }

  if (!hasHydrated) {
    return (
      <div className="mx-auto w-full max-w-lg py-8">
        <MovieDetailSkeleton />
      </div>
    );
  }

  // Match collection grids/stats: locally persisted recommendation context wins.
  const removed = collectionOverride?.removedMovieIds?.includes(movieId);
  const item = removed ? null : localItem ?? initialItem;

  if (!item || !collection) {
    return (
      <FadeIn className="mx-auto w-full max-w-lg">
        <EmptyState
          icon={<Film className="size-7" strokeWidth={1.5} />}
          title="Movie not found"
          description="This title isn’t in the list anymore, or it hasn’t finished saving. Open the list and try again."
        />
        <div className="text-center">
          <Link
            href={`/collection/${collectionId}`}
            prefetch
            className="btn-primary"
          >
            Back to List
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
      addedByUserId={item.addedByUserId}
    />
  );
}
