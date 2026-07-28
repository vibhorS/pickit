"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Library, Plus } from "lucide-react";
import { CollectionCard } from "@/components/collections/collection-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/ui/fade-in";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EMPTY_CREATED_COLLECTIONS,
  mergeCollections,
  useLocalCollectionStore,
} from "@/store/local-collection-store";
import { useCollaborationStore } from "@/store/collaboration-store";
import { useVoteStore } from "@/store/vote-store";
import type { Collection } from "@/lib/types";

type CollectionsClientProps = {
  collections: Collection[];
};

export function CollectionsClient({
  collections: seedCollections,
}: CollectionsClientProps) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const createdCollections = useLocalCollectionStore(
    (state) => state.createdCollections,
  );
  const collectionOverrides = useLocalCollectionStore(
    (state) => state.collectionOverrides,
  );
  const createCollection = useLocalCollectionStore(
    (state) => state.createCollection,
  );
  const memberships = useCollaborationStore(
    (state) => state.memberships,
  );
  const activeUserId = useCollaborationStore(
    (state) => state.activeUserId,
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

  const collections = useMemo(() => {
    const merged = mergeCollections(
        seedCollections,
        createdCollections ?? EMPTY_CREATED_COLLECTIONS,
        collectionOverrides,
      );
    return merged.filter((collection) => {
      const collectionMemberships = memberships.filter(
        (membership) => membership.collectionId === collection.id,
      );
      return (
        collectionMemberships.length === 0 ||
        collectionMemberships.some(
          (membership) => membership.userId === activeUserId,
        )
      );
    });
  }, [
    activeUserId,
    collectionOverrides,
    createdCollections,
    memberships,
    seedCollections,
  ]);

  return (
    <FadeIn className="mx-auto w-full max-w-md pb-28">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-netflix-red">
            Library
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
            Your Lists
          </h1>
        </div>
        <button
          type="button"
          onClick={() => createCollection("New List")}
          className="btn-ghost mt-1 inline-flex min-h-11 items-center gap-1.5 px-3 text-sm"
        >
          <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
          New
        </button>
      </div>

      <div className="mt-10 flex flex-col gap-4">
        {!hydrated ? (
          <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading lists">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl bg-netflix-surface p-5 sm:p-6"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="size-12 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="mt-4 h-3 w-32" />
              </div>
            ))}
          </div>
        ) : collections.length === 0 ? (
          <EmptyState
            icon={<Library className="size-7" strokeWidth={1.5} />}
            title="No lists yet"
            description="Create your first list, or capture a movie and we’ll help you start one."
            action={{
              label: "Capture a movie",
              onClick: () => router.push("/capture"),
            }}
          />
        ) : (
          collections.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))
        )}
      </div>
    </FadeIn>
  );
}
