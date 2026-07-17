"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AddMovieModal } from "@/components/collections/add-movie-modal";
import { MovieGridCard } from "@/components/movie/movie-grid-card";
import { TMDB_SEARCH_SOURCE } from "@/lib/recommendation-source";
import type { CollectionMovie } from "@/lib/services/movie-service";
import { countRatedMovies } from "@/lib/vote-status";
import type { Collection, Movie } from "@/lib/types";
import { CURRENT_USER } from "@/lib/users";
import { useVoteStore } from "@/store/vote-store";

type CollectionDetailClientProps = {
  collection: Collection;
  initialItems: CollectionMovie[];
};

type StatCardProps = {
  label: string;
  value: number;
};

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-3 py-3 sm:px-4 sm:py-3.5">
      <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-netflix-muted/80">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">
        {value}
      </p>
    </div>
  );
}

type MovieFilter = "all" | "rated";

export function CollectionDetailClient({
  collection,
  initialItems,
}: CollectionDetailClientProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [isAddMovieOpen, setIsAddMovieOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [movieFilter, setMovieFilter] = useState<MovieFilter>("all");

  const votes = useVoteStore((state) => state.votes);
  const userVotes = votes.filter(
    (vote) =>
      vote.collectionId === collection.id && vote.userId === CURRENT_USER.id,
  );

  const movieIds = items.map((item) => item.movie.id);
  const totalMovies = items.length;
  const moviesRated = countRatedMovies(movieIds, userVotes);
  const remaining = Math.max(totalMovies - moviesRated, 0);

  const ratedItems = items.filter((item) =>
    userVotes.some((vote) => vote.movieId === item.movie.id),
  );
  const visibleItems = movieFilter === "rated" ? ratedItems : items;

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

  function voteForMovie(movieId: string) {
    return userVotes.find((vote) => vote.movieId === movieId)?.vote;
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

            <div className="min-w-0 space-y-2 pt-1">
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                {collection.name}
              </h1>
              <p className="text-sm text-netflix-muted">{movieCountLabel}</p>
              <p className="max-w-lg pt-1 text-sm leading-relaxed text-netflix-muted/80 sm:text-[0.9375rem]">
                {description}
              </p>
            </div>
          </div>
        </header>

        <section className="mt-14 grid max-w-md grid-cols-3 gap-2.5 sm:gap-3">
          <StatCard label="Movies" value={totalMovies} />
          <StatCard label="Rated" value={moviesRated} />
          <StatCard label="Remaining" value={remaining} />
        </section>

        <div className="mt-12 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="w-full rounded-xl bg-netflix-red px-7 py-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-netflix-red-hover sm:w-auto"
          >
            Continue Rating
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsAddMovieOpen(true)}
              className="rounded-lg px-3 py-2 text-sm text-netflix-muted transition-colors duration-200 hover:bg-white/[0.04] hover:text-white"
            >
              + Add
            </button>
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm text-netflix-muted transition-colors duration-200 hover:bg-white/[0.04] hover:text-white"
            >
              Sort
            </button>
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm text-netflix-muted transition-colors duration-200 hover:bg-white/[0.04] hover:text-white"
            >
              Filter
            </button>
          </div>
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
          <section className="mt-16 sm:mt-20">
            <div
              role="tablist"
              aria-label="Filter movies"
              className="mb-8 flex items-center gap-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={movieFilter === "all"}
                onClick={() => setMovieFilter("all")}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors duration-200 ${
                  movieFilter === "all"
                    ? "bg-white/[0.08] font-medium text-white"
                    : "text-netflix-muted hover:text-white"
                }`}
              >
                All ({totalMovies})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={movieFilter === "rated"}
                onClick={() => setMovieFilter("rated")}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors duration-200 ${
                  movieFilter === "rated"
                    ? "bg-white/[0.08] font-medium text-white"
                    : "text-netflix-muted hover:text-white"
                }`}
              >
                Rated ({moviesRated})
              </button>
            </div>

            {visibleItems.length === 0 ? (
              <p className="py-12 text-sm text-netflix-muted">
                No rated movies yet. Open a title and mark I&apos;d Watch or Not
                for Me.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-12 md:grid-cols-4 lg:grid-cols-5 lg:gap-x-7 lg:gap-y-14">
                {visibleItems.map(({ movie, source }) => (
                  <MovieGridCard
                    key={movie.id}
                    movie={movie}
                    source={source}
                    vote={voteForMovie(movie.id)}
                    onOpen={handleOpenMovie}
                  />
                ))}
              </div>
            )}
          </section>
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
