"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { PosterImage } from "@/components/ui/poster-image";
import { useCollectionStatsList } from "@/store/collection-stats-selector";
import {
  EMPTY_CAPTURES,
  EMPTY_CREATED_COLLECTIONS,
  mergeCollections,
  useLocalCollectionStore,
} from "@/store/local-collection-store";
import { useVoteStore } from "@/store/vote-store";
import type { Collection, Movie } from "@/lib/types";

type HomeCaptureSectionsProps = {
  seedCollections: Collection[];
};

type RecentGroup = {
  collectionId: string;
  collectionName: string;
  emoji: string;
  movies: Movie[];
};

export function HomeCaptureSections({
  seedCollections,
}: HomeCaptureSectionsProps) {
  const [hydrated, setHydrated] = useState(false);
  const captures = useLocalCollectionStore((state) => state.captures);
  const createdCollections = useLocalCollectionStore(
    (state) => state.createdCollections,
  );

  useEffect(() => {
    const finish = () => setHydrated(true);
    const unsubLocal =
      useLocalCollectionStore.persist.onFinishHydration(finish);
    const unsubVotes = useVoteStore.persist.onFinishHydration(finish);

    if (
      useLocalCollectionStore.persist.hasHydrated() &&
      useVoteStore.persist.hasHydrated()
    ) {
      queueMicrotask(finish);
    }

    return () => {
      unsubLocal();
      unsubVotes();
    };
  }, []);

  const collections = useMemo(
    () =>
      mergeCollections(
        seedCollections,
        createdCollections ?? EMPTY_CREATED_COLLECTIONS,
      ),
    [seedCollections, createdCollections],
  );
  const collectionIds = useMemo(
    () => collections.map((collection) => collection.id),
    [collections],
  );
  const collectionStats = useCollectionStatsList(collectionIds);

  const recentGroups = useMemo(() => {
    const list = captures ?? EMPTY_CAPTURES;
    const movieSlots: { movie: Movie; collectionId: string }[] = [];

    for (const event of list) {
      for (const collectionId of event.collectionIds) {
        movieSlots.push({ movie: event.movie, collectionId });
        if (movieSlots.length >= 5) break;
      }
      if (movieSlots.length >= 5) break;
    }

    const byCollectionId = new Map<string, RecentGroup>();

    for (const slot of movieSlots) {
      const collection = collections.find(
        (entry) => entry.id === slot.collectionId,
      );
      if (!collection) continue;

      const existing = byCollectionId.get(slot.collectionId);
      if (existing) {
        if (!existing.movies.some((movie) => movie.id === slot.movie.id)) {
          existing.movies.push(slot.movie);
        }
      } else {
        byCollectionId.set(slot.collectionId, {
          collectionId: collection.id,
          collectionName: collection.name,
          emoji: collection.emoji,
          movies: [slot.movie],
        });
      }
    }

    return Array.from(byCollectionId.values());
  }, [captures, collections]);

  const recentlyCaptured = useMemo(() => {
    const list = captures ?? EMPTY_CAPTURES;
    const seen = new Set<string>();
    const movies: Movie[] = [];

    for (const event of list) {
      if (seen.has(event.movie.id)) continue;
      seen.add(event.movie.id);
      movies.push(event.movie);
      if (movies.length >= 8) break;
    }

    return movies;
  }, [captures]);

  const unratedCount = useMemo(() => {
    return collectionStats.reduce(
      (total, stats) => total + stats.unratedMine,
      0,
    );
  }, [collectionStats]);

  const rateTargetId = collections[0]?.id ?? null;

  if (!hydrated) return null;

  const showRecentlyAdded = recentGroups.length > 0;
  const showRecentlyCaptured = recentlyCaptured.length > 0;
  const showUnratedNudge = unratedCount >= 3 && rateTargetId;

  if (!showRecentlyAdded && !showRecentlyCaptured && !showUnratedNudge) {
    return null;
  }

  return (
    <div className="mt-14 space-y-10 border-t border-white/5 pt-10 text-left">
      {showUnratedNudge && (
        <section className="rounded-2xl bg-white/[0.03] px-4 py-4">
          <p className="text-sm leading-relaxed text-netflix-muted">
            You&apos;ve saved{" "}
            <span className="font-medium text-white">{unratedCount}</span>{" "}
            {unratedCount === 1 ? "movie" : "movies"} that you haven&apos;t
            rated yet.
          </p>
          <Link
            href={`/rate/${rateTargetId}`}
            prefetch
            className="btn-ghost mt-3 inline-flex min-h-9 px-3 text-sm text-netflix-red"
          >
            Rate Now
          </Link>
        </section>
      )}

      {showRecentlyAdded && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-netflix-muted">
            Recently Added
          </h2>
          <div className="mt-4 space-y-5">
            {recentGroups.map((group) => (
              <div key={group.collectionId}>
                <Link
                  href={`/collection/${group.collectionId}`}
                  prefetch
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-white transition hover:text-netflix-red"
                >
                  <span aria-hidden="true">{group.emoji}</span>
                  {group.collectionName}
                </Link>
                <ul className="mt-2.5 flex gap-2.5 overflow-x-auto pb-1">
                  {group.movies.map((movie) => (
                    <li key={`${group.collectionId}-${movie.id}`} className="w-16 shrink-0">
                      <Link
                        href={`/collection/${group.collectionId}/movie/${movie.id}`}
                        prefetch
                        className="block overflow-hidden rounded-md"
                      >
                        <div className="aspect-[2/3] w-full">
                          <PosterImage
                            src={movie.posterUrl}
                            alt={`${movie.title} poster`}
                          />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {showRecentlyCaptured && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-netflix-muted">
            Recently Captured
          </h2>
          <p className="mt-1 text-xs text-netflix-muted/80">
            Resume rating whenever you&apos;re ready.
          </p>
          <ul className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {recentlyCaptured.map((movie) => {
              const collectionId =
                (captures ?? EMPTY_CAPTURES).find(
                  (event) => event.movie.id === movie.id,
                )?.collectionIds[0] ?? rateTargetId;

              return (
                <li key={movie.id} className="w-[4.5rem] shrink-0">
                  {collectionId ? (
                    <Link
                      href={`/collection/${collectionId}/movie/${movie.id}`}
                      prefetch
                      className="block"
                    >
                      <div className="aspect-[2/3] overflow-hidden rounded-md">
                        <PosterImage
                          src={movie.posterUrl}
                          alt={`${movie.title} poster`}
                        />
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[0.6875rem] leading-snug text-netflix-muted">
                        {movie.title}
                      </p>
                    </Link>
                  ) : (
                    <div>
                      <div className="aspect-[2/3] overflow-hidden rounded-md">
                        <PosterImage
                          src={movie.posterUrl}
                          alt={`${movie.title} poster`}
                        />
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[0.6875rem] leading-snug text-netflix-muted">
                        {movie.title}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
