"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AddMovieModal } from "@/components/collections/add-movie-modal";
import { PartnerStatus } from "@/components/collections/partner-status";
import { MovieGridCard } from "@/components/movie/movie-grid-card";
import {
  countStillWaiting,
  getMutualMatchMovies,
  getPartnerRatingStatus,
} from "@/lib/match-engine";
import { getPartnerVotesForCollection } from "@/lib/mock-partner-votes";
import { TMDB_SEARCH_SOURCE } from "@/lib/recommendation-source";
import type { CollectionMovie } from "@/lib/services/movie-service";
import { countRatedMovies } from "@/lib/vote-status";
import type { Collection, Movie, VoteValue } from "@/lib/types";
import { CURRENT_USER } from "@/lib/users";
import { useVoteStore } from "@/store/vote-store";

type CollectionDetailClientProps = {
  collection: Collection;
  initialItems: CollectionMovie[];
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
      <p
        className={`mt-1 text-2xl font-semibold tracking-tight sm:text-[1.75rem] ${
          emphasize ? "text-rose-200" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

type MovieFilter = "all" | "unrated" | "rated" | "matches";

export function CollectionDetailClient({
  collection,
  initialItems,
}: CollectionDetailClientProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [isAddMovieOpen, setIsAddMovieOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // null = auto: Unrated while movies remain, otherwise All.
  const [selectedFilter, setSelectedFilter] = useState<MovieFilter | null>(
    null,
  );

  const votes = useVoteStore((state) => state.votes);
  const userVotes = votes.filter(
    (vote) =>
      vote.collectionId === collection.id && vote.userId === CURRENT_USER.id,
  );
  const partnerVotes = getPartnerVotesForCollection(collection.id);

  const movies = items.map((item) => item.movie);
  const movieIds = movies.map((movie) => movie.id);
  const totalMovies = items.length;
  const youRated = countRatedMovies(movieIds, userVotes);
  const partnerRated = countRatedMovies(movieIds, partnerVotes);
  const remaining = Math.max(totalMovies - youRated, 0);
  const mutualMatches = getMutualMatchMovies(movies, userVotes, partnerVotes);
  const mutualCount = mutualMatches.length;
  const stillWaiting = countStillWaiting(movieIds, userVotes, partnerVotes);
  const partnerStatus = getPartnerRatingStatus(totalMovies, partnerRated);
  const mutualIds = new Set(mutualMatches.map((movie) => movie.id));

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

    const timeoutId = window.setTimeout(() => {
      setToastMessage(null);
    }, 2500);

    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  function handleAddMovie(movie: Movie) {
    setItems((current) => {
      if (current.some((item) => item.movie.id === movie.id)) {
        return current;
      }
      return [...current, { movie, source: TMDB_SEARCH_SOURCE }];
    });
    setIsAddMovieOpen(false);
    setToastMessage(`Added to ${collection.name}`);
  }

  function handleOpenMovie(movie: Movie) {
    router.push(`/collection/${collection.id}/movie/${movie.id}`);
  }

  function voteForMovie(
    movieId: string,
    from: "user" | "partner",
  ): VoteValue | undefined {
    const list = from === "user" ? userVotes : partnerVotes;
    return list.find((vote) => vote.movieId === movieId)?.vote;
  }

  function emptyFilterMessage() {
    if (movieFilter === "rated") {
      return "No rated movies yet. Open a title and mark I'd Watch or Not for Me.";
    }
    if (movieFilter === "matches") {
      return "No mutual matches yet. Keep rating — matches appear when you both say I'd Watch.";
    }
    if (movieFilter === "unrated") {
      return "🎉 You're all caught up — every movie here is rated.";
    }
    return "Nothing to show.";
  }

  return (
    <>
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-12">
          <Link
            href="/collections"
            className="inline-flex items-center gap-2 text-sm text-netflix-muted transition-colors duration-200 hover:text-white"
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
              {totalMovies > 0 && <PartnerStatus status={partnerStatus} />}
            </div>
          </div>
        </header>

        {totalMovies > 0 && (
          <section className="mt-14 max-w-3xl">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
              <StatCard label="Movies" value={totalMovies} />
              <StatCard label="You've Rated" value={youRated} />
              <StatCard label="Partner Rated" value={partnerRated} />
              <StatCard
                label="Mutual Matches"
                value={mutualCount}
                emphasize={mutualCount > 0}
              />
              <StatCard label="Still Waiting" value={stillWaiting} />
            </div>
          </section>
        )}

        <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {mutualCount > 0 ? (
              <>
                <Link
                  href={`/tonight/${collection.id}`}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-netflix-red px-7 py-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-netflix-red-hover sm:w-auto"
                >
                  🎬 Pick Tonight&apos;s Movie
                </Link>
                {remaining > 0 && (
                  <Link
                    href={`/rate/${collection.id}`}
                    className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm text-netflix-muted transition-colors duration-200 hover:bg-white/[0.04] hover:text-white"
                  >
                    Continue Rating
                  </Link>
                )}
              </>
            ) : remaining > 0 ? (
              <Link
                href={`/rate/${collection.id}`}
                className="inline-flex w-full items-center justify-center rounded-xl bg-netflix-red px-7 py-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-netflix-red-hover sm:w-auto"
              >
                Continue Rating
              </Link>
            ) : totalMovies > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-netflix-muted">
                  No mutual matches yet — keep rating together.
                </p>
                <span
                  aria-disabled="true"
                  className="inline-flex cursor-not-allowed items-center justify-center rounded-xl bg-white/[0.04] px-5 py-3 text-sm font-medium text-netflix-muted/45"
                >
                  🎬 Pick Tonight&apos;s Movie
                </span>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setIsAddMovieOpen(true)}
            className="rounded-lg px-3 py-2 text-sm text-netflix-muted transition-colors duration-200 hover:bg-white/[0.04] hover:text-white"
          >
            + Add
          </button>
        </div>

        {totalMovies === 0 ? (
          <section className="mt-24 flex flex-col items-center px-4 py-16 text-center sm:mt-28 sm:py-20">
            <div
              aria-hidden="true"
              className="flex h-20 w-20 items-center justify-center text-5xl opacity-80"
            >
              🍿
            </div>
            <h2 className="mt-8 max-w-sm text-xl font-semibold tracking-tight text-white sm:text-2xl">
              This collection is waiting for its first recommendation.
            </h2>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-netflix-muted">
              Add a movie you discovered somewhere — a friend, a feed, or a
              late-night search.
            </p>
            <button
              type="button"
              onClick={() => setIsAddMovieOpen(true)}
              className="mt-10 rounded-xl bg-netflix-red px-7 py-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-netflix-red-hover"
            >
              + Add Your First Movie
            </button>
          </section>
        ) : (
          <>
            <section className="mt-14 sm:mt-16">
              <button
                type="button"
                onClick={() => setSelectedFilter("matches")}
                className={`group w-full max-w-md rounded-2xl px-5 py-5 text-left transition duration-300 sm:px-6 ${
                  movieFilter === "matches"
                    ? "bg-rose-500/15"
                    : "bg-white/[0.03] hover:bg-white/[0.05]"
                }`}
              >
                <p className="text-sm font-medium text-rose-200/90">
                  ❤️ Mutual Matches
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-white">
                  {mutualCount === 1 ? "1 Movie" : `${mutualCount} Movies`}
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
                    className={`rounded-lg px-3 py-1.5 text-sm transition-colors duration-200 ${
                      movieFilter === filter
                        ? "bg-white/[0.08] font-medium text-white"
                        : "text-netflix-muted hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {visibleItems.length === 0 ? (
                <p className="py-12 text-sm text-netflix-muted">
                  {emptyFilterMessage()}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-12 md:grid-cols-4 lg:grid-cols-5 lg:gap-x-7 lg:gap-y-14">
                  {visibleItems.map(({ movie, source }) => (
                    <MovieGridCard
                      key={movie.id}
                      movie={movie}
                      source={source}
                      vote={voteForMovie(movie.id, "user")}
                      partnerVote={voteForMovie(movie.id, "partner")}
                      onOpen={handleOpenMovie}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <AddMovieModal
        open={isAddMovieOpen}
        existingMovieIds={items.map((item) => item.movie.id)}
        onClose={() => setIsAddMovieOpen(false)}
        onAdd={handleAddMovie}
      />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-netflix-surface/95 px-5 py-3 text-sm font-medium text-white shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-sm"
        >
          {toastMessage}
        </div>
      )}
    </>
  );
}
