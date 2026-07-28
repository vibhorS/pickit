"use client";

import { Library } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CollectionDetailClient } from "@/components/collections/collection-detail-client";
import { EmptyState } from "@/components/ui/empty-state";
import { MovieDetailSkeleton } from "@/components/ui/skeleton";
import {
  EMPTY_CREATED_COLLECTIONS,
  useLocalCollectionStore,
} from "@/store/local-collection-store";
import type { Collection } from "@/lib/types";
import { useCollaborationStore } from "@/store/collaboration-store";
import { useVoteStore } from "@/store/vote-store";

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
  const collectionOverrides = useLocalCollectionStore(
    (state) => state.collectionOverrides,
  );

  useEffect(() => {
    const finish = () => setHydrated(true);
    const unsubLocal =
      useLocalCollectionStore.persist.onFinishHydration(finish);
    const unsubCollaboration =
      useCollaborationStore.persist.onFinishHydration(finish);
    const unsubVotes = useVoteStore.persist.onFinishHydration(finish);
    if (
      useLocalCollectionStore.persist.hasHydrated() &&
      useCollaborationStore.persist.hasHydrated() &&
      useVoteStore.persist.hasHydrated()
    ) {
      queueMicrotask(finish);
    }
    return () => {
      unsubLocal();
      unsubCollaboration();
      unsubVotes();
    };
  }, []);

  const collection = useMemo(() => {
    const base =
      seedCollection ??
      (createdCollections ?? EMPTY_CREATED_COLLECTIONS).find(
        (entry) => entry.id === collectionId,
      );
    const override = collectionOverrides[collectionId];
    if (!base || override?.deleted) return undefined;
    return {
      ...base,
      name: override?.name ?? base.name,
      emoji: override?.emoji ?? base.emoji,
    };
  }, [
    collectionId,
    collectionOverrides,
    createdCollections,
    seedCollection,
  ]);

  if (!hydrated) {
    return <MovieDetailSkeleton />;
  }

  if (!collection) {
    return (
      <EmptyState
        icon={<Library className="size-7" strokeWidth={1.5} />}
        title="List not found"
        description="It may have been removed, or this link is out of date."
        actionHref={{ label: "Back to lists", href: "/collections" }}
      />
    );
  }

  return <CollectionDetailClient collection={collection} />;
}
