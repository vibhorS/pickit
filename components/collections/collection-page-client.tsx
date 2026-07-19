"use client";

import Link from "next/link";
import { Library } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CollectionDetailClient } from "@/components/collections/collection-detail-client";
import { MovieDetailSkeleton } from "@/components/ui/skeleton";
import {
  EMPTY_CREATED_COLLECTIONS,
  useLocalCollectionStore,
} from "@/store/local-collection-store";
import type { Collection } from "@/lib/types";

type CollectionPageClientProps = {
  collectionId: string;
  seedCollection: Collection | null;
};

export function CollectionPageClient({
  collectionId,
  seedCollection,
}: CollectionPageClientProps) {
  const [hydrated, setHydrated] = useState(false);
  const createdCollections = useLocalCollectionStore(
    (state) => state.createdCollections,
  );

  useEffect(() => {
    const finish = () => setHydrated(true);
    const unsub = useLocalCollectionStore.persist.onFinishHydration(finish);
    if (useLocalCollectionStore.persist.hasHydrated()) {
      queueMicrotask(finish);
    }
    return unsub;
  }, []);

  const collection = useMemo(() => {
    if (seedCollection) return seedCollection;
    return (createdCollections ?? EMPTY_CREATED_COLLECTIONS).find(
      (entry) => entry.id === collectionId,
    );
  }, [seedCollection, createdCollections, collectionId]);

  if (!hydrated) {
    return <MovieDetailSkeleton />;
  }

  if (!collection) {
    return (
      <div className="px-4 py-14 text-center">
        <Library
          className="mx-auto size-7 text-netflix-muted"
          strokeWidth={1.5}
        />
        <h3 className="mt-6 text-xl font-semibold text-white">
          Collection not found
        </h3>
        <p className="mt-2 text-sm text-netflix-muted">
          It may have been removed, or this link is out of date.
        </p>
        <Link href="/collections" prefetch className="btn-primary mt-8 inline-flex">
          Back to collections
        </Link>
      </div>
    );
  }

  return <CollectionDetailClient collection={collection} />;
}
