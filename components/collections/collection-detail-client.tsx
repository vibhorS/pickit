"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Film, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { AddMovieModal } from "@/components/collections/add-movie-modal";
import { CollectionRecommendationInsights } from "@/components/collections/collection-recommendation-insights";
import { PartnerStatus } from "@/components/collections/partner-status";
import { MovieGridCard } from "@/components/movie/movie-grid-card";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { EmptyState, Toast } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/ui/fade-in";
import { getPartnerVotesForCollection } from "@/lib/mock-partner-votes";
import { MOTION, staggerContainer } from "@/lib/motion";
import { sourceFromMetadata } from "@/lib/recommendation-metadata";
import { TMDB_SEARCH_SOURCE } from "@/lib/recommendation-source";
import type {
  Collection,
  Movie,
  RecommendationMetadata,
  VoteValue,
} from "@/lib/types";
import { CURRENT_USER } from "@/lib/users";
import { useCollectionStats } from "@/store/collection-stats-selector";
import { useLocalCollectionStore } from "@/store/local-collection-store";
import { useVoteStore } from "@/store/vote-store";

type CollectionDetailClientProps = {
  collection: Collection;
};

type StatCardProps = {
  label: string;
  value: number;
  emphasize?: boolean;
};

function StatCard({ label, value, emphasize = false }: StatCardProps) {
  return (
    <div
      className={`rounded-xl px-3 py-3 sm:px-4 sm:py-3.5 ${
        emphasize ? "bg-rose-500/10" : "bg-white/[0.03]"
      }`}
    >
      <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-netflix-muted/80">
        {label}
      </p>
      <AnimatedNumber
        value={value}
        className={`mt-1 block text-2xl font-semibold tracking-tight sm:text-[1.75rem] ${
          emphasize ? "text-rose-200" : "text-white"
        }`}
      />
    </div>
  );
}

type MovieFilter = "all" | "unrated" | "rated" | "matches";

export function CollectionDetailClient({
  collection,
}: CollectionDetailClientProps) {
  const router = useRouter();
  const [isAddMovieOpen, setIsAddMovieOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<MovieFilter | null>(
    null,
  );

  const addLocalMovie = useLocalCollectionStore((state) => state.addMovie);
  const stats = useCollectionStats(collection.id);
  const {
    items,
    totalMovies,
    myRated: youRated,
    partnerRated,
    unratedMine: remaining,
    unratedPartner,
    mutualMatches: mutualCount,
    completionPercent: completion,
    mutualMatchMovies,
  } = stats;

  const votes = useVoteStore((state) => state.votes);
  const userVotes = votes.filter(
    (vote) =>
      vote.collectionId === collection.id && vote.userId === CURRENT_USER.id,
  );
  const partnerVotes = getPartnerVotesForCollection(collection.id);

  const partnerStatus = unratedPartner === 0 ? "connected" : "waiting";
  const mutualIds = new Set(
    mutualMatchMovies.map((movie) => movie.id),
  );

  const ratedItems = items.filter((item) =>
    userVotes.some((vote) => vote.movieId === item.movie.id),
  );
  const unratedItems = items.filter(
    (item) => !userVotes.some((vote) => vote.movieId === item.movie.id),
  );
  const matchItems = items.filter((item) => mutualIds.has(item.movie.id));

  const movieFilter: MovieFilter =
    selectedFilter ?? (remaining > 0 ? "unrated" : "all");
  const visibleItems =
    movieFilter === "rated"
      ? ratedItems
      : movieFilter === "unrated"
        ? unratedItems
        : movieFilter === "matches"
          ? matchItems
          : items;

  const description =
    collection.description?.trim() ||
    "A collection of recommendations waiting to be decided.";

  const movieCountLabel =
    totalMovies === 1 ? "1 movie" : `${totalMovies} movies`;

  useEffect(() => {
    if (!toastMessage) return;
    const timeoutId = window.setTimeout(() => setToastMessage(null), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  useEffect(() => {
    if (!collection.id) return;
    router.prefetch(`/rate/${collection.id}`);
    router.prefetch(`/tonight/${collection.id}`);
  }, [collection.id, router]);

  function handleAddMovie(
    movie: Movie,
    metadata: RecommendationMetadata,
  ) {
    if (!collection.id) {
      setToastMessage("Couldn't add that movie — collection is missing.");
      return;
    }
    if (!movie?.id) {
      setToastMessage("Couldn't add that movie — missing movie id.");
      return;
    }

    const alreadyInCollection = items.some(
      (item) => item.movie.id === movie.id,
    );
    if (alreadyInCollection) {
      setIsAddMovieOpen(false);
      setToastMessage(`Already in ${collection.name}`);
      return;
    }

    const source = sourceFromMetadata(metadata, TMDB_SEARCH_SOURCE);
    const added = addLocalMovie(
      collection.id,
      movie,
      source,
      metadata,
    );
    setIsAddMovieOpen(false);
    setToastMessage(
      added
        ? `Added to ${collection.name}`
        : `Already in ${collection.name}`,
    );
  }

  function handleOpenMovie(movie: Movie) {
    if (!collection.id || !movie?.id) {
      setToastMessage("Couldn't open that movie. Try again.");
      return;
    }

    const href = `/collection/${collection.id}/movie/${movie.id}`;
    router.prefetch(href);
    router.push(href);
  }

  function voteForMovie(
    movieId: string,
    from: "user" | "partner",
  ): VoteValue | undefined {
    const list = from === "user" ? userVotes : partnerVotes;
    return list.find((vote) => vote.movieId === movieId)?.vote;
  }

  function emptyFilterCopy() {
    if (movieFilter === "rated") {
      return {
        title: "Nothing rated yet",
        description:
          "Open a title and mark I'd Watch or Not for Me to build your list.",
      };
    }
    if (movieFilter === "matches") {
      return {
        title: "No mutual matches yet",
        description:
          "Matches appear when you both mark I'd Watch on the same movie.",
      };
    }
    if (movieFilter === "unrated") {
      return {
        title:
          stats.readinessState === "waiting-for-partner"
            ? "Waiting for partner"
            : "You're all caught up",
        description:
          stats.readinessState === "waiting-for-partner"
            ? "You've rated every movie. Your partner still has ratings left."
            : "Both of you have rated every movie in this collection.",
      };
    }
    return {
      title: "Nothing to show",
      description: "Try another filter.",
    };
  }

  const emptyCopy = emptyFilterCopy();

  return (
    <>
      <FadeIn className="mx-auto w-full max-w-5xl">
        <div className="mb-12">
          <Link
            href="/collections"
            className="btn-ghost -ml-3 inline-flex items-center gap-2"
          >
            <span aria-hidden="true">←</span>
            Collections
          </Link>
        </div>

        <header>
          <div className="flex items-start gap-5 sm:gap-6">
            <span
              aria-hidden="true"
              className="text-5xl leading-none sm:text-6xl"
            >
              {collection.emoji}
            </span>
            <div className="min-w-0 space-y-3 pt-1">
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                {collection.name}
              </h1>
              <p className="text-sm text-netflix-muted">{movieCountLabel}</p>
              <p className="max-w-lg text-sm leading-relaxed text-netflix-muted/80 sm:text-[0.9375rem]">
                {description}
              </p>
              {totalMovies > 0 && (
                <>
                  <PartnerStatus status={partnerStatus} />
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1 text-xs font-medium text-white">
                    <span aria-hidden="true">{stats.readinessEmoji}</span>
                    {stats.readinessLabel}
                  </p>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="mt-8 max-w-4xl">
          <CollectionRecommendationInsights items={items} />
        </div>

        {totalMovies > 0 && (
          <section className="mt-14 max-w-3xl space-y-5">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
              <StatCard label="Movies" value={totalMovies} />
              <StatCard label="You've Rated" value={youRated} />
              <StatCard label="Partner Rated" value={partnerRated} />
              <StatCard
                label="Mutual Matches"
                value={mutualCount}
                emphasize={mutualCount > 0}
              />
              <StatCard label="Mine Left" value={remaining} />
            </div>
            <div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  className="h-full rounded-full bg-netflix-red"
                  initial={false}
                  animate={{ width: `${completion}%` }}
                  transition={{
                    duration: MOTION.durationSlow,
                    ease: MOTION.ease,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-netflix-muted/70">
                {completion}% shared completion · You {youRated}/{totalMovies} ·
                Partner {partnerRated}/{totalMovies}
              </p>
            </div>
          </section>
        )}

        <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {stats.readinessState === "ready" && mutualCount > 0 ? (
              <>
                <Link
                  href={`/tonight/${collection.id}`}
                  prefetch
                  className="btn-primary w-full sm:w-auto"
                >
                  Pick Tonight&apos;s Movie
                </Link>
              </>
            ) : stats.readinessState === "needs-my-ratings" ? (
              <Link
                href={`/rate/${collection.id}`}
                prefetch
                className="btn-primary w-full sm:w-auto"
              >
                Continue Rating
              </Link>
            ) : stats.readinessState === "waiting-for-partner" ? (
              <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-100/90">
                Waiting for partner
              </p>
            ) : totalMovies > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-netflix-muted">
                  No mutual matches yet — keep rating together.
                </p>
                <span
                  aria-disabled="true"
                  className="btn-primary inline-flex cursor-not-allowed opacity-40"
                >
                  Pick Tonight&apos;s Movie
                </span>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setIsAddMovieOpen(true)}
            className="btn-ghost inline-flex items-center gap-1.5"
          >
            <Plus className="size-4" aria-hidden="true" strokeWidth={2} />
            Add
          </button>
        </div>

        {totalMovies === 0 ? (
          <EmptyState
            icon={<Film className="size-7" strokeWidth={1.5} />}
            title="This collection is waiting for its first recommendation."
            description="Add a movie you discovered somewhere — a friend, a feed, or a late-night search."
            action={{
              label: "Add Your First Movie",
              onClick: () => setIsAddMovieOpen(true),
            }}
          />
        ) : (
          <>
            <section className="mt-14 sm:mt-16">
              <button
                type="button"
                onClick={() => setSelectedFilter("matches")}
                className={`group w-full max-w-md rounded-2xl px-5 py-5 text-left transition duration-200 sm:px-6 ${
                  movieFilter === "matches"
                    ? "bg-rose-500/15"
                    : "bg-white/[0.03] hover:bg-white/[0.05]"
                }`}
              >
                <p className="text-sm font-medium text-rose-200/90">
                  Mutual Matches
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-white">
                  <AnimatedNumber value={mutualCount} />
                  <span className="ml-2 text-lg font-medium text-netflix-muted">
                    {mutualCount === 1 ? "Movie" : "Movies"}
                  </span>
                </p>
                <p className="mt-2 text-sm text-netflix-muted/75 transition-colors group-hover:text-netflix-muted">
                  {mutualCount > 0
                    ? "Tap to show only titles you both want to watch."
                    : "Matches appear when you both mark I'd Watch."}
                </p>
              </button>
            </section>

            <section className="mt-12 sm:mt-14">
              <div
                role="tablist"
                aria-label="Filter movies"
                className="mb-8 flex flex-wrap items-center gap-1"
              >
                {(
                  [
                    ["all", `All (${totalMovies})`],
                    ["unrated", `Unrated (${remaining})`],
                    ["rated", `Rated (${youRated})`],
                    ["matches", `Matches (${mutualCount})`],
                  ] as const
                ).map(([filter, label]) => (
                  <button
                    key={filter}
                    type="button"
                    role="tab"
                    aria-selected={movieFilter === filter}
                    onClick={() => setSelectedFilter(filter)}
                    className={`min-h-9 rounded-lg px-3 py-1.5 text-sm transition-colors duration-200 ${
                      movieFilter === filter
                        ? "bg-white/[0.08] font-medium text-white"
                        : "text-netflix-muted hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={movieFilter}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{
                    duration: MOTION.duration,
                    ease: MOTION.ease,
                  }}
                >
                  {visibleItems.length === 0 ? (
                    <EmptyState
                      icon={<Film className="size-7" strokeWidth={1.5} />}
                      title={emptyCopy.title}
                      description={emptyCopy.description}
                    />
                  ) : (
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-12 md:grid-cols-4 lg:grid-cols-5 lg:gap-x-7 lg:gap-y-14"
                    >
                      {visibleItems.map(({ movie, source, metadata }) => (
                        <MovieGridCard
                          key={movie.id}
                          movie={movie}
                          source={source}
                          metadata={metadata}
                          vote={voteForMovie(movie.id, "user")}
                          partnerVote={voteForMovie(movie.id, "partner")}
                          onOpen={handleOpenMovie}
                        />
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>
            </section>
          </>
        )}
      </FadeIn>

      <AddMovieModal
        open={isAddMovieOpen}
        existingMovieIds={items.map((item) => item.movie.id)}
        onClose={() => setIsAddMovieOpen(false)}
        onAdd={handleAddMovie}
      />

      <Toast message={toastMessage} />
    </>
  );
}
