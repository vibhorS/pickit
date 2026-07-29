"use client";

import { Check, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { Collection } from "@/lib/types";
import { useCollectionStatsList } from "@/store/collection-stats-selector";
import { resolveCollectionCatalog } from "@/lib/collections/resolve-catalog";
import { useCollaborationStore } from "@/store/collaboration-store";
import {
  EMPTY_CREATED_COLLECTIONS,
  useLocalCollectionStore,
} from "@/store/local-collection-store";

type CaptureCollectionsStepProps = {
  seedCollections: Collection[];
  selectedIds: string[];
  movieCount: number;
  busy: boolean;
  error: string | null;
  onChange: (collectionIds: string[]) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function CaptureCollectionsStep({
  seedCollections,
  selectedIds,
  movieCount,
  busy,
  error,
  onChange,
  onBack,
  onContinue,
}: CaptureCollectionsStepProps) {
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
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("🎬");

  const collections = useMemo(
    () => {
      const merged = resolveCollectionCatalog(
        seedCollections,
        createdCollections ?? EMPTY_CREATED_COLLECTIONS,
        collectionOverrides,
      );
      return merged.filter((collection) => {
        const collectionMemberships = memberships.filter(
          (membership) =>
            membership.collectionId === collection.id,
        );
        return (
          collectionMemberships.length === 0 ||
          collectionMemberships.some(
            (membership) => membership.userId === activeUserId,
          )
        );
      });
    },
    [
      activeUserId,
      collectionOverrides,
      createdCollections,
      memberships,
      seedCollections,
    ],
  );
  const collectionIds = useMemo(
    () => collections.map((collection) => collection.id),
    [collections],
  );
  const collectionStats = useCollectionStatsList(collectionIds);

  const rows = useMemo(
    () =>
      collections.map((collection, index) => {
        return {
          collection,
          stats: collectionStats[index],
        };
      }).filter(
        (
          entry,
        ): entry is {
          collection: Collection;
          stats: NonNullable<typeof entry.stats>;
        } => entry.stats != null,
      ),
    [collections, collectionStats],
  );

  function toggle(collectionId: string) {
    onChange(
      selectedIds.includes(collectionId)
        ? selectedIds.filter((id) => id !== collectionId)
        : [...selectedIds, collectionId],
    );
  }

  function handleCreate() {
    const collection = createCollection(newName, newEmoji);
    onChange([...selectedIds, collection.id]);
    setNewName("");
    setNewEmoji("🎬");
    setCreating(false);
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <button type="button" onClick={onBack} className="btn-ghost -ml-3">
        ← Review movies
      </button>

      <div className="mt-7">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-netflix-red">
          Lists
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Where should these go?
        </h1>
        <p className="mt-2 text-sm text-netflix-muted">
          Save all {movieCount} approved {movieCount === 1 ? "movie" : "movies"}{" "}
          to one or more lists.
        </p>
      </div>

      <ul className="mt-7 space-y-2.5">
        {rows.map(({ collection, stats }) => {
          const selected = selectedIds.includes(collection.id);
          return (
            <li key={collection.id}>
              <button
                type="button"
                onClick={() => toggle(collection.id)}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition ${
                  selected
                    ? "bg-netflix-red/15 ring-1 ring-netflix-red/55"
                    : "bg-white/[0.035] hover:bg-white/[0.065]"
                }`}
              >
                <span className="text-2xl" aria-hidden="true">
                  {collection.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-white">
                    {collection.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-netflix-muted">
                    {stats.totalMovies} movies · {stats.mutualMatches} mutual ·{" "}
                    {stats.completionPercent}% complete
                  </span>
                </span>
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                    selected
                      ? "bg-netflix-red text-white"
                      : "bg-white/10 text-transparent"
                  }`}
                >
                  <Check className="size-4" strokeWidth={2.5} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3">
        {creating ? (
          <div className="rounded-2xl bg-white/[0.035] p-4">
            <p className="text-sm font-semibold text-white">
              Create list
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={newEmoji}
                onChange={(event) =>
                  setNewEmoji(event.target.value.slice(0, 4))
                }
                aria-label="List emoji"
                className="w-14 rounded-xl bg-black/30 px-2 py-2.5 text-center text-lg outline-none focus:ring-2 focus:ring-netflix-red/50"
              />
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="List name"
                aria-label="List name"
                className="min-w-0 flex-1 rounded-xl bg-black/30 px-3 py-2.5 text-sm outline-none placeholder:text-netflix-muted focus:ring-2 focus:ring-netflix-red/50"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newName.trim()}
                onClick={handleCreate}
                className="btn-secondary flex-1"
              >
                Create
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="btn-ghost flex w-full items-center justify-center gap-2"
          >
            <Plus className="size-4" />
            Create list
          </button>
        )}
      </div>

      {collections.length === 0 && !creating && (
        <p className="mt-2 text-center text-sm text-netflix-muted">
          Create a list to continue.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="sticky bottom-4 mt-8 rounded-2xl border border-white/10 bg-netflix-surface/95 p-3 shadow-[var(--shadow-elevated)] backdrop-blur">
        <button
          type="button"
          disabled={busy || selectedIds.length === 0}
          onClick={onContinue}
          className="btn-primary w-full"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
