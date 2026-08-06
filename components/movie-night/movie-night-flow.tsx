"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Layers } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CollectionPickerCard } from "@/components/movie-night/collection-picker-card";
import { ReadinessSheet } from "@/components/movie-night/readiness-sheet";
import { SyncedMovieNightPlay } from "@/components/movie-night/synced-movie-night-play";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/ui/fade-in";
import { useWatchProviders } from "@/hooks/use-watch-providers";
import { resolveCollectionCatalog } from "@/lib/collections/resolve-catalog";
import { buildMovieNightQueue } from "@/lib/movie-night/build-queue";
import { movieNightLiveService } from "@/lib/movie-night/live/service";
import type { MovieNightLiveSession } from "@/lib/movie-night/live/types";
import { staggerContainer, staggerItem } from "@/lib/motion";
import type { MovieNightCollectionCard } from "@/lib/movie-night-types";
import { analytics } from "@/lib/observability/analytics";
import { expandCrewProviderIds } from "@/lib/streaming/provider-catalog";
import type { CollectionMovie } from "@/lib/services/movie-service";
import type { Collection } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import { useCollaborationStore } from "@/store/collaboration-store";
import {
  getTonightQueue,
  type CollectionStats,
  useCollectionStatsList,
} from "@/store/collection-stats-selector";
import {
  selectCrewStreamingProviderIds,
  useCrewPreferencesStore,
} from "@/store/crew-preferences-store";
import { useCrewStore } from "@/store/crew-store";
import {
  EMPTY_CREATED_COLLECTIONS,
  useLocalCollectionStore,
} from "@/store/local-collection-store";
import { useVoteStore } from "@/store/vote-store";

type MovieNightFlowProps = {
  cards: MovieNightCollectionCard[];
};

type PendingCollection = {
  collection: Collection;
  stats: CollectionStats;
  streamingBlocked?: boolean;
};

type Step =
  | { kind: "picker" }
  | {
      kind: "live";
      collection: Collection;
      catalogItems: CollectionMovie[];
      session: MovieNightLiveSession;
    };

export function MovieNightFlow({ cards }: MovieNightFlowProps) {
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "picker" });
  const [pending, setPending] = useState<PendingCollection | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const restoredLive = useRef(false);
  const movieNightStartedAt = useRef(0);
  const liveSessionRef = useRef<MovieNightLiveSession | null>(null);

  const createdCollections = useLocalCollectionStore(
    (state) => state.createdCollections,
  );
  const collectionOverrides = useLocalCollectionStore(
    (state) => state.collectionOverrides,
  );
  const memberships = useCollaborationStore((state) => state.memberships);
  const activeUserId = useCollaborationStore((state) => state.activeUserId);
  const collectionIds = useMemo(
    () => [
      ...cards.map((card) => card.collection.id),
      ...(createdCollections ?? EMPTY_CREATED_COLLECTIONS).map(
        (collection) => collection.id,
      ),
    ],
    [cards, createdCollections],
  );
  const allStats = useCollectionStatsList(collectionIds);
  const statsById = useMemo(
    () =>
      new Map(
        collectionIds.map((collectionId, index) => [
          collectionId,
          allStats[index],
        ]),
      ),
    [collectionIds, allStats],
  );

  const crew = useCrewStore((state) => state.crew);
  const crewId = crew?.id;
  const crewCountry = useCrewPreferencesStore((state) =>
    crewId ? state.byCrewId[crewId]?.country : undefined,
  );
  const selectedProviderIds = useCrewPreferencesStore((state) =>
    selectCrewStreamingProviderIds(state, crewId),
  );
  const crewStreamingProviderIds = useMemo(
    () => expandCrewProviderIds(selectedProviderIds),
    [selectedProviderIds],
  );

  const mutualFingerprint = useMemo(
    () =>
      allStats
        .map((stats) =>
          stats.mutualMatchMovies.map((movie) => movie.id).join(","),
        )
        .join("|"),
    [allStats],
  );

  const mutualTitleKey = useMemo(() => {
    const ids: string[] = [];
    for (const collectionId of collectionIds) {
      for (const entry of getTonightQueue(collectionId)) {
        ids.push(
          `${entry.movie.mediaType === "tv" ? "tv" : "movie"}:${entry.movie.id}`,
        );
      }
    }
    return [...new Set(ids)].sort().join("|");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionIds, mutualFingerprint]);

  const mutualWatchRefs = useMemo(() => {
    if (!mutualTitleKey) return [];
    return mutualTitleKey.split("|").map((token) => {
      const [mediaType, id] = token.split(":");
      return {
        id,
        mediaType: mediaType === "tv" ? ("tv" as const) : ("movie" as const),
      };
    });
  }, [mutualTitleKey]);

  const { byId: watchById, region: watchRegion } = useWatchProviders(
    mutualWatchRefs,
    { regionContext: { crewCountry } },
  );

  useEffect(() => {
    analytics.track("movie_night_opened", { collectionCount: cards.length });
    movieNightStartedAt.current = Date.now();
  }, [cards.length]);

  useEffect(() => {
    const finish = () => {
      if (
        !useVoteStore.persist.hasHydrated() ||
        !useLocalCollectionStore.persist.hasHydrated() ||
        !useCollaborationStore.persist.hasHydrated()
      ) {
        return;
      }
      queueMicrotask(() => setHasHydrated(true));
    };
    const unsubVotes = useVoteStore.persist.onFinishHydration(finish);
    const unsubLocal = useLocalCollectionStore.persist.onFinishHydration(finish);
    const unsubCollaboration =
      useCollaborationStore.persist.onFinishHydration(finish);
    if (
      useVoteStore.persist.hasHydrated() &&
      useLocalCollectionStore.persist.hasHydrated() &&
      useCollaborationStore.persist.hasHydrated()
    ) {
      finish();
    }
    return () => {
      unsubVotes();
      unsubLocal();
      unsubCollaboration();
    };
  }, []);

  const resolvedCards = useMemo(() => {
    const merged = resolveCollectionCatalog(
      cards.map((card) => card.collection),
      createdCollections ?? EMPTY_CREATED_COLLECTIONS,
      collectionOverrides,
    );
    return merged
      .map((collection) => {
        const seedCard = cards.find(
          (card) => card.collection.id === collection.id,
        );
        const items =
          statsById.get(collection.id)?.items ?? seedCard?.items ?? [];
        return { collection, items, movieCount: items.length };
      })
      .filter((card) => {
        const collectionMemberships = memberships.filter(
          (membership) => membership.collectionId === card.collection.id,
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
    cards,
    collectionOverrides,
    createdCollections,
    memberships,
    statsById,
  ]);

  const cardReadiness = useMemo(() => {
    return resolvedCards
      .map((card) => {
        const stats = statsById.get(card.collection.id);
        if (!stats) return null;
        const queue = buildMovieNightQueue({
          collectionId: card.collection.id,
          availabilityById: watchById,
          crewStreamingProviderIds,
          region: watchRegion,
        });
        return {
          collectionId: card.collection.id,
          stats,
          queue,
          mutualCount: stats.mutualMatches,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry != null);
  }, [
    crewStreamingProviderIds,
    resolvedCards,
    statsById,
    watchById,
    watchRegion,
  ]);

  // Restore active synchronized session for this crew.
  useEffect(() => {
    if (!hasHydrated || !isSupabaseConfigured() || !crewId || !profile) {
      return;
    }
    if (restoredLive.current) return;
    restoredLive.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const active = await movieNightLiveService.getActive(crewId);
        if (cancelled || !active) return;

        const card = resolvedCards.find(
          (entry) => entry.collection.id === active.listId,
        );
        const catalogItems =
          statsById.get(active.listId)?.items ?? card?.items ?? [];

        setStep((prev) => {
          if (prev.kind === "live") {
            const current = prev.session;
            const currentUpdated = Date.parse(current.updatedAt);
            const incomingUpdated = Date.parse(active.updatedAt);
            // Newest session wins; never clobber a newer in-progress start.
            if (
              current.id === active.id ||
              (!Number.isNaN(currentUpdated) &&
                !Number.isNaN(incomingUpdated) &&
                currentUpdated > incomingUpdated)
            ) {
              return prev;
            }
            if (
              currentUpdated >= incomingUpdated &&
              prev.catalogItems.length > 0
            ) {
              return prev;
            }
          }
          liveSessionRef.current = active;
          return {
            kind: "live",
            collection: card?.collection ?? {
              id: active.listId,
              name: "Movie Night",
              emoji: "🍿",
              items: [],
            },
            catalogItems,
            session: active,
          };
        });
      } catch (err) {
        if (!cancelled) {
          setLiveError(
            err instanceof Error
              ? err.message
              : "Could not restore Movie Night.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [crewId, hasHydrated, profile, resolvedCards, statsById]);

  const enterLiveSession = useCallback(
    (
      collection: Collection,
      catalogItems: CollectionMovie[],
      session: MovieNightLiveSession,
    ) => {
      liveSessionRef.current = session;
      setStep({
        kind: "live",
        collection,
        catalogItems,
        session,
      });
    },
    [],
  );

  const startLiveSession = useCallback(
    async (collection: Collection, queue: CollectionMovie[]) => {
      if (!crewId) {
        setLiveError("Join a Crew before starting Movie Night.");
        setStep({ kind: "picker" });
        return;
      }
      setLiveError(null);
      const session = await movieNightLiveService.start({
        crewId,
        listId: collection.id,
        movieIds: queue.map((item) => item.movie.id),
      });
      const catalogItems =
        statsById.get(collection.id)?.items ??
        resolvedCards.find((card) => card.collection.id === collection.id)
          ?.items ??
        queue;
      enterLiveSession(collection, catalogItems, session);
      analytics.track("movie_night_started", {
        collectionId: collection.id,
        queueSize: queue.length,
        mode: "synced",
      });
    },
    [crewId, enterLiveSession, resolvedCards, statsById],
  );

  const resumeOrStart = useCallback(
    async (collection: Collection, queue: CollectionMovie[]) => {
      if (!crewId) {
        setLiveError("Join a Crew before starting Movie Night.");
        return;
      }
      setStarting(true);
      setLiveError(null);
      setPending(null);
      try {
        const active = await movieNightLiveService.getActive(crewId);
        if (active) {
          const card = resolvedCards.find(
            (entry) => entry.collection.id === active.listId,
          );
          const catalogItems =
            statsById.get(active.listId)?.items ?? card?.items ?? queue;
          enterLiveSession(
            card?.collection ?? {
              id: active.listId,
              name: collection.name,
              emoji: collection.emoji,
              items: [],
            },
            catalogItems,
            active,
          );
          return;
        }
        await startLiveSession(collection, queue);
      } catch (err) {
        setLiveError(
          err instanceof Error
            ? err.message
            : "Could not start Movie Night. Apply the live sessions migration in Supabase.",
        );
        setStep({ kind: "picker" });
      } finally {
        setStarting(false);
      }
    },
    [
      crewId,
      enterLiveSession,
      resolvedCards,
      startLiveSession,
      statsById,
    ],
  );

  function handleSelectCollection(card: (typeof resolvedCards)[number]) {
    if (starting) return;
    const info = cardReadiness.find(
      (entry) => entry.collectionId === card.collection.id,
    );
    if (!info) return;

    if (info.stats.readinessState !== "ready") {
      setPending({ collection: card.collection, stats: info.stats });
      return;
    }
    if (info.queue.length === 0) {
      setPending({
        collection: card.collection,
        stats: info.stats,
        streamingBlocked: true,
      });
      return;
    }
    void resumeOrStart(card.collection, info.queue);
  }

  const onLiveSessionChange = useCallback((session: MovieNightLiveSession) => {
    liveSessionRef.current = session;
    setStep((prev) => {
      if (prev.kind !== "live") return prev;
      const prevUpdated = Date.parse(prev.session.updatedAt);
      const nextUpdated = Date.parse(session.updatedAt);
      if (
        prev.session.id === session.id &&
        !Number.isNaN(prevUpdated) &&
        !Number.isNaN(nextUpdated) &&
        prevUpdated > nextUpdated
      ) {
        return prev;
      }
      return { ...prev, session };
    });
  }, []);

  if (!hasHydrated) {
    return (
      <div className="mx-auto flex min-h-[40vh] max-w-lg items-center justify-center text-sm text-netflix-muted">
        Loading Movie Night…
      </div>
    );
  }

  if (step.kind === "live") {
    return (
      <SyncedMovieNightPlay
        session={step.session}
        catalogItems={step.catalogItems}
        onSessionChange={onLiveSessionChange}
        onExit={() => {
          liveSessionRef.current = null;
          restoredLive.current = false;
          setStep({ kind: "picker" });
          setLiveError(null);
        }}
      />
    );
  }

  if (resolvedCards.length === 0) {
    return (
      <FadeIn className="mx-auto w-full max-w-lg">
        <EmptyState
          icon={<Layers className="size-7" strokeWidth={1.5} />}
          title="No lists yet"
          description="Add a few movies to a list first, then start Movie Night."
          actionHref={{ label: "Go to Lists", href: "/collections" }}
        />
      </FadeIn>
    );
  }

  return (
    <>
      <FadeIn className="mx-auto w-full max-w-4xl">
        <div className="mb-8">
          <Link
            href="/"
            prefetch
            className="btn-ghost -ml-3 inline-flex items-center gap-2"
          >
            <span aria-hidden="true">←</span>
            Home
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Movie Night
          </h1>
          <p className="mt-2 text-sm text-netflix-muted">
            One shared session. Private votes. A synchronized reveal.
          </p>
          {starting ? (
            <p className="mt-3 text-sm text-white/80">
              Starting synchronized Movie Night…
            </p>
          ) : null}
          {crew && selectedProviderIds.length === 0 ? (
            <p className="mt-3 text-sm text-netflix-muted/80">
              Tip: set your streaming services in{" "}
              <Link
                href="/crew"
                className="text-white underline-offset-2 hover:underline"
              >
                Your Crew
              </Link>{" "}
              to keep Movie Night on platforms you actually have.
            </p>
          ) : null}
          {liveError ? (
            <p className="mt-3 text-sm text-rose-400">{liveError}</p>
          ) : null}
        </div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="flex flex-col gap-4"
        >
          {resolvedCards.map((card) => {
            const info = cardReadiness.find(
              (entry) => entry.collectionId === card.collection.id,
            );
            if (!info) return null;
            return (
              <motion.div key={card.collection.id} variants={staggerItem}>
                <CollectionPickerCard
                  collection={card.collection}
                  movieCount={card.movieCount}
                  posterUrls={card.items
                    .map((item) => item.movie.posterUrl)
                    .filter((url): url is string => Boolean(url))}
                  stats={info.stats}
                  onSelect={() => handleSelectCollection(card)}
                  disabled={starting}
                />
              </motion.div>
            );
          })}
        </motion.div>
      </FadeIn>

      <ReadinessSheet
        open={pending != null}
        stats={pending?.stats ?? null}
        collectionName={pending?.collection.name ?? ""}
        streamingBlocked={pending?.streamingBlocked ?? false}
        onDismiss={() => setPending(null)}
        onRate={() => {
          if (!pending) return;
          router.push(`/rate/${pending.collection.id}`);
        }}
        onConfigureStreaming={() => {
          setPending(null);
          router.push("/crew");
        }}
      />
    </>
  );
}
