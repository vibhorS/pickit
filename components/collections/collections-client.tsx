"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Library, Plus } from "lucide-react";
import { CollectionCard } from "@/components/collections/collection-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/ui/fade-in";
import {
  EMPTY_CREATED_COLLECTIONS,
  mergeCollections,
  useLocalCollectionStore,
} from "@/store/local-collection-store";
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
  const createCollection = useLocalCollectionStore(
    (state) => state.createCollection,
  );
  useEffect(() => {
    const finish = () => setHydrated(true);
    const unsub = useLocalCollectionStore.persist.onFinishHydration(finish);
    if (useLocalCollectionStore.persist.hasHydrated()) {
      queueMicrotask(finish);
    }
    return unsub;
  }, []);

  const collections = useMemo(
    () =>
      mergeCollections(
        seedCollections,
        createdCollections ?? EMPTY_CREATED_COLLECTIONS,
      ),
    [seedCollections, createdCollections],
  );

  return (
    <FadeIn className="mx-auto w-full max-w-md pb-28">
      <div className="mb-10">
        <Link
          href="/"
          prefetch
          className="btn-ghost -ml-3 inline-flex items-center gap-2"
        >
          <span aria-hidden="true">←</span>
          Home
        </Link>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-netflix-red">
            Library
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
            Your Collections
          </h1>
        </div>
        <button
          type="button"
          onClick={() => createCollection("New Collection")}
          className="btn-ghost mt-1 inline-flex min-h-10 items-center gap-1.5 px-3 text-xs"
        >
          <Plus className="size-3.5" strokeWidth={2} />
          New
        </button>
      </div>

      <div className="mt-10 flex flex-col gap-4">
        {!hydrated ? null : collections.length === 0 ? (
          <EmptyState
            icon={<Library className="size-7" strokeWidth={1.5} />}
            title="No collections yet"
            description="Create your first collection, or capture a movie and we’ll help you start one."
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
