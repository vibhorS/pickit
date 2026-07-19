"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Layers } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CollectionPickerCard } from "@/components/movie-night/collection-picker-card";
import { GamesHub } from "@/components/movie-night/games-hub";
import { QuickPickGame } from "@/components/movie-night/games/quick-pick-game";
import { RouletteGame } from "@/components/movie-night/games/roulette-game";
import { TournamentGame } from "@/components/movie-night/games/tournament-game";
import { QueueOverview } from "@/components/movie-night/queue-overview";
import { ReadinessSheet } from "@/components/movie-night/readiness-sheet";
import { WinnerScreen } from "@/components/movie-night/winner-screen";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/ui/fade-in";
import { MovieDetailSkeleton } from "@/components/ui/skeleton";
import type { DecisionGameId } from "@/lib/decision-games/types";
import { staggerContainer, staggerItem } from "@/lib/motion";
import type { MovieNightCollectionCard } from "@/lib/movie-night-types";
import type { CollectionMovie } from "@/lib/services/movie-service";
import type { Collection, Movie } from "@/lib/types";
import {
  type CollectionStats,
  useCollectionStatsList,
} from "@/store/collection-stats-selector";
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
};

type Step =
  | { kind: "picker" }
  | { kind: "overview"; collection: Collection; queue: CollectionMovie[] }
  | { kind: "games"; collection: Collection; queue: CollectionMovie[] }
  | {
      kind: "play";
      gameId: DecisionGameId;
      collection: Collection;
      queue: CollectionMovie[];
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

  const createdCollections = useLocalCollectionStore(
    (state) => state.createdCollections,
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
    const finish = () => setHasHydrated(true);
    const unsubVotes = useVoteStore.persist.onFinishHydration(finish);
    const unsubLocal =
      useLocalCollectionStore.persist.onFinishHydration(finish);

    if (
      useVoteStore.persist.hasHydrated() &&
      useLocalCollectionStore.persist.hasHydrated()
    ) {
      queueMicrotask(finish);
    }

    return () => {
      unsubVotes();
      unsubLocal();
    };
  }, []);

  const resolvedCards = useMemo(() => {
    const fromSeed = cards.map((card) => {
      const items = statsById.get(card.collection.id)?.items ?? card.items;
      return { ...card, items, movieCount: items.length };
    });

    const seedIds = new Set(fromSeed.map((card) => card.collection.id));
    const fromCreated = (createdCollections ?? EMPTY_CREATED_COLLECTIONS)
      .filter((collection) => !seedIds.has(collection.id))
      .map((collection) => {
        const localItems = statsById.get(collection.id)?.items ?? [];
        return {
          collection,
          items: localItems,
          movieCount: localItems.length,
        };
      });

    return [...fromSeed, ...fromCreated];
  }, [cards, createdCollections, statsById]);

  const cardReadiness = useMemo(() => {
    return resolvedCards.map((card) => {
      const stats = statsById.get(card.collection.id);
      if (!stats) return null;
      const mutualIds = new Set(
        stats.mutualMatchMovies.map((movie) => movie.id),
      );
      const queue = stats.items.filter((item) =>
        mutualIds.has(item.movie.id),
      );

      return {
        collectionId: card.collection.id,
        stats,
        queue,
      };
    }).filter((entry): entry is NonNullable<typeof entry> => entry != null);
  }, [resolvedCards, statsById]);

  function openOverview(collection: Collection, queue: CollectionMovie[]) {
    setPending(null);
    setStep({ kind: "overview", collection, queue });
  }

  function handleSelectCollection(card: (typeof resolvedCards)[number]) {
    const info = cardReadiness.find(
      (entry) => entry.collectionId === card.collection.id,
    );
    if (!info) return;

    if (info.stats.readinessState !== "ready") {
      setPending({
        collection: card.collection,
        stats: info.stats,
      });
      return;
    }

    openOverview(card.collection, info.queue);
  }

  function queueFor(collectionId: string): CollectionMovie[] {
    return (
      cardReadiness.find((entry) => entry.collectionId === collectionId)
        ?.queue ?? []
    );
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
          title="No collections yet"
          description="Add a few movies to a collection first, then start Movie Night."
        />
        <div className="text-center">
          <Link href="/collections" prefetch className="btn-primary">
            Go to Collections
          </Link>
        </div>
      </FadeIn>
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
        onHome={() => router.push("/")}
        onPlayAnotherGame={() =>
          setStep({
            kind: "games",
            collection: step.collection,
            queue: step.queue,
          })
        }
        onChooseCollection={() => setStep({ kind: "picker" })}
      />
    );
  }

  if (step.kind === "play") {
    const { collection, queue, gameId } = step;

    function handleWin(movie: Movie) {
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
    }

    if (gameId === "quick-pick") {
      return (
        <QuickPickGame
          queue={queue}
          onWin={handleWin}
          onBackToGames={backToGames}
          onChooseCollection={() => setStep({ kind: "picker" })}
        />
      );
    }

    if (gameId === "roulette") {
      return (
        <RouletteGame
          queue={queue}
          onWin={handleWin}
          onBackToGames={backToGames}
          onChooseCollection={() => setStep({ kind: "picker" })}
        />
      );
    }

    return (
      <TournamentGame
        queue={queue}
        onWin={handleWin}
        onBackToGames={backToGames}
      />
    );
  }

  if (step.kind === "games") {
    return (
      <GamesHub
        onBack={() =>
          setStep({
            kind: "overview",
            collection: step.collection,
            queue: step.queue,
          })
        }
        onSelect={(gameId) =>
          setStep({
            kind: "play",
            gameId,
            collection: step.collection,
            queue: step.queue,
          })
        }
      />
    );
  }

  if (step.kind === "overview") {
    if (step.queue.length === 0) {
      return (
        <FadeIn className="mx-auto w-full max-w-lg">
          <EmptyState
            emoji="❤️"
            title="No mutual matches yet"
            description="Tonight's Queue fills when you both mark I'd Watch on the same movies."
          />
          <div className="flex flex-col gap-3 px-4">
            <button
              type="button"
              onClick={() => router.push(`/rate/${step.collection.id}`)}
              className="btn-primary w-full"
            >
              Rate Movies
            </button>
            <button
              type="button"
              onClick={() => setStep({ kind: "picker" })}
              className="btn-secondary w-full"
            >
              Choose Another Collection
            </button>
          </div>
        </FadeIn>
      );
    }

    return (
      <QueueOverview
        collectionName={step.collection.name}
        collectionEmoji={step.collection.emoji}
        queue={step.queue}
        onContinue={() =>
          setStep({
            kind: "games",
            collection: step.collection,
            queue: step.queue,
          })
        }
        onBack={() => setStep({ kind: "picker" })}
      />
    );
  }

  return (
    <>
      <FadeIn className="mx-auto w-full max-w-lg">
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
            Choose a collection — then pick how you want to decide.
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
        onContinue={() => {
          if (!pending) return;
          openOverview(pending.collection, queueFor(pending.collection.id));
        }}
        onRate={() => {
          if (!pending) return;
          router.push(`/rate/${pending.collection.id}`);
        }}
      />
    </>
  );
}
