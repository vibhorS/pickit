"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RateSession } from "@/components/rate/rate-session";
import { EmptyState } from "@/components/ui/empty-state";
import { MovieDetailSkeleton } from "@/components/ui/skeleton";
import type { CollectionMovie } from "@/lib/services/movie-service";
import type { Collection } from "@/lib/types";
import {
  EMPTY_CREATED_COLLECTIONS,
  useLocalCollectionStore,
} from "@/store/local-collection-store";

type RateSessionResolverProps = {
  collectionId: string;
  seedCollection: Collection | null;
  seedItems: CollectionMovie[];
};

export function RateSessionResolver({
  collectionId,
  seedCollection,
  seedItems,
}: RateSessionResolverProps) {
  const [hydrated, setHydrated] = useState(false);
  const createdCollections = useLocalCollectionStore(
    (state) => state.createdCollections,
  );
  const collectionOverride = useLocalCollectionStore(
    (state) => state.collectionOverrides[collectionId],
  );

  useEffect(() => {
    const finish = () => setHydrated(true);
    const unsubscribe =
      useLocalCollectionStore.persist.onFinishHydration(finish);
    if (useLocalCollectionStore.persist.hasHydrated()) {
      queueMicrotask(finish);
    }
    return unsubscribe;
  }, []);

  if (!hydrated) return <MovieDetailSkeleton />;

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

  if (!collection) {
    return (
      <div className="mx-auto w-full max-w-lg text-center">
        <EmptyState
          emoji="🎬"
          title="List not found"
          description="This list may have been removed."
        />
        <Link href="/collections" className="btn-primary">
          Back to Lists
        </Link>
      </div>
    );
  }

  return <RateSession collection={collection} items={seedItems} />;
}
