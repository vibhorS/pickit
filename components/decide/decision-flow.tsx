"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Layers } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CollectionChoiceCard } from "@/components/decide/collection-choice-card";
import {
  CelebrationScreen,
  MovieChoiceCard,
} from "@/components/decide/movie-choice-card";
import {
  SwipeableChoiceShell,
  type ChoiceDirection,
} from "@/components/decide/swipeable-choice-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/ui/fade-in";
import { MovieDetailSkeleton } from "@/components/ui/skeleton";
import type { DecisionCollectionCard } from "@/lib/decision-types";
import { MOTION } from "@/lib/motion";
import type { Collection, Movie } from "@/lib/types";
import { useCollectionStatsList } from "@/store/collection-stats-selector";
import { useLocalCollectionStore } from "@/store/local-collection-store";
import { useVoteStore } from "@/store/vote-store";

type DecisionFlowProps = {
  cards: DecisionCollectionCard[];
};

type Step =
  | { kind: "collections" }
  | { kind: "movies"; collection: Collection; matches: Movie[] }
  | { kind: "celebrate"; movie: Movie; collection: Collection };

function ChoiceButtons({
  onSkip,
  onAccept,
  skipLabel,
  acceptLabel,
}: {
  onSkip: () => void;
  onAccept: () => void;
  skipLabel: string;
  acceptLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:px-8 sm:pb-7">
      <button type="button" onClick={onSkip} className="btn-secondary w-full sm:flex-1">
        {skipLabel}
      </button>
      <button type="button" onClick={onAccept} className="btn-primary w-full sm:flex-1">
        {acceptLabel}
      </button>
    </div>
  );
}

export function DecisionFlow({ cards }: DecisionFlowProps) {
  const router = useRouter();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "collections" });
  const [collectionIndex, setCollectionIndex] = useState(0);
  const [movieQueue, setMovieQueue] = useState<Movie[]>([]);
  const collectionIds = useMemo(
    () => cards.map((card) => card.collection.id),
    [cards],
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
    return cards.map((card) => {
      const movies =
        statsById.get(card.collection.id)?.movies ?? card.movies;

      return {
        ...card,
        movies,
        movieCount: movies.length,
      };
    });
  }, [cards, statsById]);

  const collectionStats = useMemo(() => {
    return resolvedCards.map((card) => {
      return {
        collectionId: card.collection.id,
        stats: statsById.get(card.collection.id),
      };
    }).filter(
      (
        entry,
      ): entry is {
        collectionId: string;
        stats: NonNullable<typeof entry.stats>;
      } => entry.stats != null,
    );
  }, [resolvedCards, statsById]);

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
          description="Add a few movies to a collection first, then come back to decide."
        />
        <div className="text-center">
          <Link href="/collections" prefetch className="btn-primary">
            Go to Collections
          </Link>
        </div>
      </FadeIn>
    );
  }

  if (step.kind === "celebrate") {
    return (
      <FadeIn>
        <CelebrationScreen
          movie={step.movie}
          onDone={() => router.push("/")}
        />
      </FadeIn>
    );
  }

  if (step.kind === "movies") {
    if (movieQueue.length === 0) {
      return (
        <FadeIn className="mx-auto w-full max-w-lg">
          <button
            type="button"
            onClick={() => setStep({ kind: "collections" })}
            className="btn-ghost -ml-3 mb-4 inline-flex items-center gap-2"
          >
            <span aria-hidden="true">←</span>
            Collections
          </button>
          <EmptyState
            icon={<Heart className="size-7" strokeWidth={1.5} />}
            title={
              step.matches.length === 0
                ? "No mutual matches"
                : "That's the queue"
            }
            description={
              step.matches.length === 0
                ? `You and your partner haven't both liked anything in ${step.collection.name} yet.`
                : "You skipped every suggestion for tonight. Pick another collection anytime."
            }
            action={{
              label: "Choose Another Collection",
              onClick: () => {
                setStep({ kind: "collections" });
                setCollectionIndex(0);
              },
            }}
          />
        </FadeIn>
      );
    }

    const currentMovie = movieQueue[0];
    const activeCollection = step.collection;

    function handleMovieChoice(direction: ChoiceDirection) {
      if (direction === "accept") {
        setStep({
          kind: "celebrate",
          movie: currentMovie,
          collection: activeCollection,
        });
        return;
      }

      setMovieQueue((queue) => queue.slice(1));
    }

    return (
      <FadeIn className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setStep({ kind: "collections" })}
            className="btn-ghost -ml-3 inline-flex items-center gap-2"
          >
            <span aria-hidden="true">←</span>
            {activeCollection.emoji} {activeCollection.name}
          </button>
          <p className="text-sm text-netflix-muted">
            {movieQueue.length} left
          </p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentMovie.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: MOTION.duration, ease: MOTION.ease }}
          >
            <SwipeableChoiceShell
              acceptLabel="Watch Tonight"
              skipLabel="Next"
              onChoice={handleMovieChoice}
              footer={(choose) => (
                <ChoiceButtons
                  skipLabel="Next Suggestion"
                  acceptLabel="Watch Tonight"
                  onSkip={() => choose("skip")}
                  onAccept={() => choose("accept")}
                />
              )}
            >
              <MovieChoiceCard movie={currentMovie} />
            </SwipeableChoiceShell>
          </motion.div>
        </AnimatePresence>
      </FadeIn>
    );
  }

  // Collection picker
  const currentCard = resolvedCards[collectionIndex % resolvedCards.length];
  const stats = collectionStats.find(
    (item) => item.collectionId === currentCard.collection.id,
  )?.stats;
  if (!stats) return null;

  function handleCollectionChoice(direction: ChoiceDirection) {
    const card = resolvedCards[collectionIndex % resolvedCards.length];
    const cardStats = collectionStats.find(
      (item) => item.collectionId === card.collection.id,
    )?.stats;
    const matches = cardStats?.mutualMatchMovies ?? [];

    if (direction === "accept") {
      setMovieQueue(matches);
      setStep({
        kind: "movies",
        collection: card.collection,
        matches,
      });
      return;
    }

    setCollectionIndex((index) => (index + 1) % resolvedCards.length);
  }

  return (
    <FadeIn className="mx-auto w-full max-w-lg">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link href="/" prefetch className="btn-ghost -ml-3 inline-flex items-center gap-2">
          <span aria-hidden="true">←</span>
          Home
        </Link>
        <p className="text-sm text-netflix-muted">
          {collectionIndex % resolvedCards.length + 1} of {resolvedCards.length}
        </p>
      </div>

      <p className="mb-4 text-sm font-medium text-netflix-muted">
        Choose a collection
      </p>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentCard.collection.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: MOTION.duration, ease: MOTION.ease }}
        >
          <SwipeableChoiceShell
            acceptLabel="Choose"
            skipLabel="Skip"
            onChoice={handleCollectionChoice}
            footer={(choose) => (
              <ChoiceButtons
                skipLabel="Skip Collection"
                acceptLabel="Choose Collection"
                onSkip={() => choose("skip")}
                onAccept={() => choose("accept")}
              />
            )}
          >
            <CollectionChoiceCard
              collection={currentCard.collection}
              movieCount={currentCard.movieCount}
              stats={stats}
            />
          </SwipeableChoiceShell>
        </motion.div>
      </AnimatePresence>
    </FadeIn>
  );
}
