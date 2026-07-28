"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
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
import { GamesHub } from "@/components/movie-night/games-hub";
import { LineupGenerator } from "@/components/movie-night/lineup-generator";
import { ReadinessSheet } from "@/components/movie-night/readiness-sheet";
import { WinnerScreen } from "@/components/movie-night/winner-screen";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/ui/fade-in";
import { MovieDetailSkeleton } from "@/components/ui/skeleton";
import type { DecisionGameId } from "@/lib/decision-games/types";
import { staggerContainer, staggerItem } from "@/lib/motion";
import type { MovieNightCollectionCard } from "@/lib/movie-night-types";
import { analytics } from "@/lib/observability/analytics";
import type { CollectionMovie } from "@/lib/services/movie-service";
import type { Collection, Movie } from "@/lib/types";
import { useCollaborationStore } from "@/store/collaboration-store";
import {
  getTonightQueue,
  type CollectionStats,
  useCollectionStatsList,
} from "@/store/collection-stats-selector";
import {
  EMPTY_CREATED_COLLECTIONS,
  mergeCollections,
  useLocalCollectionStore,
} from "@/store/local-collection-store";
import { useVoteStore } from "@/store/vote-store";
import { useSessionStore } from "@/store/session-store";
import type { QuickPickSession } from "@/lib/tonight-queue";
import type { RouletteGameState } from "@/components/movie-night/games/roulette-game";
import type { TournamentGameState } from "@/components/movie-night/games/tournament-game";

const QuickPickGame = dynamic(
  () =>
    import("@/components/movie-night/games/quick-pick-game").then(
      (mod) => mod.QuickPickGame,
    ),
  { loading: () => <MovieDetailSkeleton /> },
);
const RouletteGame = dynamic(
  () =>
    import("@/components/movie-night/games/roulette-game").then(
      (mod) => mod.RouletteGame,
    ),
  { loading: () => <MovieDetailSkeleton /> },
);
const TournamentGame = dynamic(
  () =>
    import("@/components/movie-night/games/tournament-game").then(
      (mod) => mod.TournamentGame,
    ),
  { loading: () => <MovieDetailSkeleton /> },
);

type MovieNightFlowProps = {
  cards: MovieNightCollectionCard[];
};

type PendingCollection = {
  collection: Collection;
  stats: CollectionStats;
};

type Step =
  | { kind: "picker" }
  | { kind: "generating"; collection: Collection; queue: CollectionMovie[] }
  | { kind: "games"; collection: Collection; queue: CollectionMovie[] }
  | {
      kind: "play";
      gameId: DecisionGameId;
      collection: Collection;
      queue: CollectionMovie[];
      gameState?: unknown;
    }
  | {
      kind: "winner";
      collection: Collection;
      queue: CollectionMovie[];
      movie: Movie;
      gameId: DecisionGameId;
    };

export function MovieNightFlow({ cards }: MovieNightFlowProps) {
  const router = useRouter();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "picker" });
  const [pending, setPending] = useState<PendingCollection | null>(null);
  const restoredSession = useRef(false);
  const currentSession = useSessionStore((state) => state.current);
  const setCurrentSession = useSessionStore(
    (state) => state.setCurrentSession,
  );
  const clearCurrentSession = useSessionStore(
    (state) => state.clearCurrentSession,
  );

  const createdCollections = useLocalCollectionStore(
    (state) => state.createdCollections,
  );
  const collectionOverrides = useLocalCollectionStore(
    (state) => state.collectionOverrides,
  );
  const memberships = useCollaborationStore(
    (state) => state.memberships,
  );
  const activeUserId = useCollaborationStore(
    (state) => state.activeUserId,
  );
  const recordActivity = useCollaborationStore(
    (state) => state.recordActivity,
  );
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

  useEffect(() => {
    const finish = () => {
      if (
        !useVoteStore.persist.hasHydrated() ||
        !useLocalCollectionStore.persist.hasHydrated() ||
        !useCollaborationStore.persist.hasHydrated() ||
        !useSessionStore.persist.hasHydrated()
      ) {
        return;
      }
      queueMicrotask(() => setHasHydrated(true));
    };
    const unsubVotes = useVoteStore.persist.onFinishHydration(finish);
    const unsubLocal =
      useLocalCollectionStore.persist.onFinishHydration(finish);
    const unsubCollaboration =
      useCollaborationStore.persist.onFinishHydration(finish);
    const unsubSession =
      useSessionStore.persist.onFinishHydration(finish);

    if (
      useVoteStore.persist.hasHydrated() &&
      useLocalCollectionStore.persist.hasHydrated() &&
      useCollaborationStore.persist.hasHydrated() &&
      useSessionStore.persist.hasHydrated()
    ) {
      finish();
    }

    return () => {
      unsubVotes();
      unsubLocal();
      unsubCollaboration();
      unsubSession();
    };
  }, []);

  const resolvedCards = useMemo(() => {
    const merged = mergeCollections(
      cards.map((card) => card.collection),
      createdCollections ?? EMPTY_CREATED_COLLECTIONS,
      collectionOverrides,
    );
    return merged.map((collection) => {
      const seedCard = cards.find(
        (card) => card.collection.id === collection.id,
      );
      const items =
        statsById.get(collection.id)?.items ?? seedCard?.items ?? [];
      return {
        collection,
        items,
        movieCount: items.length,
      };
    }).filter((card) => {
      const collectionMemberships = memberships.filter(
        (membership) =>
          membership.collectionId === card.collection.id,
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
    return resolvedCards.map((card) => {
      const stats = statsById.get(card.collection.id);
      if (!stats) return null;

      return {
        collectionId: card.collection.id,
        stats,
        queue: getTonightQueue(card.collection.id),
      };
    }).filter((entry): entry is NonNullable<typeof entry> => entry != null);
  }, [resolvedCards, statsById]);

  const saveMovieNightSession = useCallback(
    (
      collectionId: string,
      phase: "overview" | "generating" | "games" | "play",
      gameId?: DecisionGameId,
      gameState?: unknown,
      queue?: CollectionMovie[],
    ) => {
      setCurrentSession({
        kind: "movie-night",
        collectionId,
        phase,
        gameId,
        gameState,
        queueMovieIds: queue?.map((item) => item.movie.id),
        updatedAt: new Date().toISOString(),
      });
    },
    [setCurrentSession],
  );

  const saveGameState = useCallback(
    (gameState: unknown) => {
      const active = useSessionStore.getState().current;
      if (
        active?.kind !== "movie-night" ||
        active.phase !== "play" ||
        !active.gameId
      ) {
        return;
      }
      setCurrentSession({
        ...active,
        gameState,
        updatedAt: new Date().toISOString(),
      });
    },
    [setCurrentSession],
  );

  useEffect(() => {
    if (
      !hasHydrated ||
      restoredSession.current ||
      currentSession?.kind !== "movie-night"
    ) {
      return;
    }
    const card = resolvedCards.find(
      (entry) =>
        entry.collection.id === currentSession.collectionId,
    );
    const info = cardReadiness.find(
      (entry) =>
        entry.collectionId === currentSession.collectionId,
    );
    if (!card || !info) {
      clearCurrentSession("movie-night");
      restoredSession.current = true;
      return;
    }

    restoredSession.current = true;
    let resumedStep: Step | null = null;
    const resumedQueue = currentSession.queueMovieIds
      ? currentSession.queueMovieIds.flatMap((movieId) => {
          const item = info.stats.items.find(
            (entry) => entry.movie.id === movieId,
          );
          return item ? [item] : [];
        })
      : info.queue;
    if (currentSession.phase === "generating") {
      resumedStep = {
        kind: "generating",
        collection: card.collection,
        queue: resumedQueue,
      };
    } else if (
      currentSession.phase === "overview" ||
      currentSession.phase === "games"
    ) {
      resumedStep = {
        kind: "games",
        collection: card.collection,
        queue: resumedQueue,
      };
    } else if (currentSession.gameId) {
      resumedStep = {
        kind: "play",
        gameId: currentSession.gameId,
        gameState: currentSession.gameState,
        collection: card.collection,
        queue: resumedQueue,
      };
    }
    if (resumedStep) {
      queueMicrotask(() => setStep(resumedStep));
    }
  }, [
    cardReadiness,
    clearCurrentSession,
    currentSession,
    hasHydrated,
    resolvedCards,
  ]);

  function openGames(collection: Collection, queue: CollectionMovie[]) {
    setPending(null);
    setStep({ kind: "games", collection, queue });
    saveMovieNightSession(
      collection.id,
      "games",
      undefined,
      undefined,
      queue,
    );
  }

  function generateLineup(
    collection: Collection,
    queue: CollectionMovie[],
  ) {
    setPending(null);
    setStep({ kind: "generating", collection, queue });
    saveMovieNightSession(
      collection.id,
      "generating",
      undefined,
      undefined,
      queue,
    );
  }

  function handleSelectCollection(card: (typeof resolvedCards)[number]) {
    const info = cardReadiness.find(
      (entry) => entry.collectionId === card.collection.id,
    );
    if (!info) return;

    if (info.queue.length === 0) {
      setPending({
        collection: card.collection,
        stats: info.stats,
      });
      return;
    }

    generateLineup(card.collection, info.queue);
  }

  if (!hasHydrated) {
    return (
      <div className="mx-auto w-full max-w-lg py-8">
        <MovieDetailSkeleton />
      </div>
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

  if (step.kind === "generating") {
    return (
      <LineupGenerator
        collection={step.collection}
        queue={step.queue}
        onComplete={() => openGames(step.collection, step.queue)}
      />
    );
  }

  if (step.kind === "winner") {
    const winnerItem = step.queue.find(
      (item) => item.movie.id === step.movie.id,
    );
    return (
      <WinnerScreen
        movie={step.movie}
        source={winnerItem?.source}
        metadata={winnerItem?.metadata}
        addedByUserId={winnerItem?.addedByUserId}
        onPickAgain={() => {
          setStep({
            kind: "games",
            collection: step.collection,
            queue: step.queue,
          });
          saveMovieNightSession(
            step.collection.id,
            "games",
            undefined,
            undefined,
            step.queue,
          );
        }}
      />
    );
  }

  if (step.kind === "play") {
    const { collection, queue, gameId } = step;

    function handleWin(movie: Movie) {
      clearCurrentSession("movie-night");
      recordActivity({
        collectionId: collection.id,
        userId: activeUserId,
        type: "movie-night-completed",
        movieId: movie.id,
      });
      analytics.track("movie_picked", {
        gameId,
        collectionId: collection.id,
        movieId: movie.id,
      });
      analytics.track("movie_night_completed", {
        gameId,
        collectionId: collection.id,
      });
      setStep({
        kind: "winner",
        collection,
        queue,
        movie,
        gameId,
      });
    }

    function backToGames() {
      setStep({ kind: "games", collection, queue });
      saveMovieNightSession(
        collection.id,
        "games",
        undefined,
        undefined,
        queue,
      );
    }

    if (gameId === "quick-pick") {
      return (
        <QuickPickGame
          queue={queue}
          onWin={handleWin}
          onBackToGames={backToGames}
          initialSession={step.gameState as QuickPickSession | undefined}
          onSessionChange={saveGameState}
          onChooseCollection={() => {
            clearCurrentSession("movie-night");
            setStep({ kind: "picker" });
          }}
        />
      );
    }

    if (gameId === "roulette") {
      return (
        <RouletteGame
          queue={queue}
          onWin={handleWin}
          onBackToGames={backToGames}
          initialState={step.gameState as RouletteGameState | undefined}
          onStateChange={saveGameState}
          onChooseCollection={() => {
            clearCurrentSession("movie-night");
            setStep({ kind: "picker" });
          }}
        />
      );
    }

    return (
      <TournamentGame
        queue={queue}
        onWin={handleWin}
        onBackToGames={backToGames}
        initialState={step.gameState as TournamentGameState | undefined}
        onStateChange={saveGameState}
      />
    );
  }

  if (step.kind === "games") {
    return (
      <GamesHub
        vibeName={step.collection.name}
        vibeEmoji={step.collection.emoji}
        queueSize={step.queue.length}
        onBack={() => {
          clearCurrentSession("movie-night");
          setStep({ kind: "picker" });
        }}
        onSelect={(gameId) => {
          analytics.track("decision_mode_selected", {
            gameId,
            collectionId: step.collection.id,
          });
          setStep({
            kind: "play",
            gameId,
            collection: step.collection,
            queue: step.queue,
          });
          saveMovieNightSession(
            step.collection.id,
            "play",
            gameId,
            undefined,
            step.queue,
          );
        }}
      />
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
            What&apos;s the vibe like tonight?
          </h1>
          <p className="mt-2 text-sm text-netflix-muted">
            Choose where tonight begins.
          </p>
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
                    .filter(Boolean)}
                  stats={info.stats}
                  onSelect={() => handleSelectCollection(card)}
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
        onDismiss={() => setPending(null)}
        onRate={() => {
          if (!pending) return;
          router.push(`/rate/${pending.collection.id}`);
        }}
      />
    </>
  );
}
