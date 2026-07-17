"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AddMovieModal } from "@/components/collections/add-movie-modal";
import { MovieDetailDrawer } from "@/components/movie/movie-detail-drawer";
import { MovieGridCard } from "@/components/movie/movie-grid-card";
import { EmptyState } from "@/components/ui/empty-state";
import { TMDB_SEARCH_SOURCE } from "@/lib/recommendation-source";
import type { CollectionMovie } from "@/lib/services/movie-service";
import { countRatedMovies } from "@/lib/vote-status";
import type { Collection, Movie, VoteValue } from "@/lib/types";
import { useVoteStore } from "@/store/vote-store";

type CollectionDetailClientProps = {
  collection: Collection;
  initialItems: CollectionMovie[];
};

type SummaryCardProps = {
  label: string;
  value: number | string;
};

function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <div className="rounded-2xl border border-white/5 bg-netflix-surface px-4 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)] sm:px-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-netflix-muted">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
        {value}
      </p>
    </div>
  );
}

type MovieFilter = "all" | "unrated";

export function CollectionDetailClient({
  collection,
  initialItems,
}: CollectionDetailClientProps) {
  const [items, setItems] = useState(initialItems);
  const [isAddMovieOpen, setIsAddMovieOpen] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [movieFilter, setMovieFilter] = useState<MovieFilter>("all");

  const votes = useVoteStore((state) => state.votes);
  const voteMovie = useVoteStore((state) => state.voteMovie);
  const collectionVotes = votes.filter(
    (vote) => vote.collectionId === collection.id,
  );

  const movieIds = items.map((item) => item.movie.id);
  const totalMovies = items.length;
  const moviesRated = countRatedMovies(movieIds, collectionVotes);
  const remaining = Math.max(totalMovies - moviesRated, 0);

  const unratedItems = items.filter(
    (item) =>
      !collectionVotes.some((vote) => vote.movieId === item.movie.id),
  );
  const visibleItems = movieFilter === "unrated" ? unratedItems : items;

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
    setToastMessage(`Added to ${collection.name} ❤️`);
  }

  function handleRemoveMovie(movieId: string) {
    setItems((current) =>
      current.filter((item) => item.movie.id !== movieId),
    );
    setSelectedMovie(null);
    setToastMessage(`Removed from ${collection.name}`);
  }

  function handleVote(movieId: string, vote: VoteValue) {
    voteMovie(collection.id, movieId, vote);
  }

  return (
    <>
      <div className="mx-auto w-full">
        <div className="mb-6">
          <Link
            href="/collections"
            className="inline-flex items-center gap-2 text-sm font-medium text-netflix-muted transition-colors hover:text-white"
          >
            <span aria-hidden="true">←</span>
            Collections
          </Link>
        </div>

        <header className="flex flex-col gap-6 border-b border-white/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-start gap-4 sm:gap-5">
            <span
              aria-hidden="true"
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-4xl sm:h-20 sm:w-20 sm:text-5xl"
            >
              {collection.emoji}
            </span>

            <div className="min-w-0 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                    collection.shared
                      ? "bg-netflix-red/15 text-netflix-red"
                      : "bg-white/5 text-netflix-muted"
                  }`}
                >
                  {collection.shared ? "Shared" : "Private"}
                </span>
              </div>

              <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-5xl">
                {collection.name}
              </h1>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setIsAddMovieOpen(true)}
              className="w-full rounded-xl bg-netflix-red px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-netflix-red-hover sm:w-auto"
            >
              ➕ Add Movie
            </button>
            <Link
              href={`/rate/${collection.id}`}
              className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/10 sm:w-auto"
            >
              ▶️ Continue Rating
            </Link>
          </div>
        </header>

        <section className="mt-8 grid grid-cols-1 gap-3 sm:mt-10 sm:grid-cols-3 sm:gap-4">
          <SummaryCard label="Total Movies" value={totalMovies} />
          <SummaryCard label="Movies Rated" value={moviesRated} />
          <SummaryCard label="Remaining" value={remaining} />
        </section>

        {totalMovies === 0 ? (
          <section className="mt-10 sm:mt-12">
            <EmptyState
              emoji="🎬"
              title="No movies yet"
              description={`Start building ${collection.name} by adding your first title, then rate anytime.`}
              action={{
                label: "➕ Add Movie",
                onClick: () => setIsAddMovieOpen(true),
              }}
            />
          </section>
        ) : (
          <>
            <section className="mt-10 sm:mt-12">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white sm:text-2xl">
                    Movies
                  </h2>
                  <p className="mt-1 text-sm text-netflix-muted">
                    Rate movies whenever you&apos;re ready.
                  </p>
                </div>

                <div
                  role="group"
                  aria-label="Filter movies"
                  className="flex w-fit rounded-xl border border-white/10 bg-white/5 p-1"
                >
                  <button
                    type="button"
                    onClick={() => setMovieFilter("all")}
                    className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                      movieFilter === "all"
                        ? "bg-netflix-red text-white"
                        : "text-netflix-muted hover:text-white"
                    }`}
                  >
                    All Movies
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovieFilter("unrated")}
                    className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                      movieFilter === "unrated"
                        ? "bg-netflix-red text-white"
                        : "text-netflix-muted hover:text-white"
                    }`}
                  >
                    Unrated
                  </button>
                </div>
              </div>

              {visibleItems.length === 0 ? (
                <EmptyState
                  emoji="✅"
                  title="You're caught up"
                  description="No more movies waiting for your vote. Add a new title or switch back to All Movies."
                  action={{
                    label: "Show All Movies",
                    onClick: () => setMovieFilter("all"),
                  }}
                />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
                  {visibleItems.map(({ movie, source }) => (
                    <MovieGridCard
                      key={movie.id}
                      movie={movie}
                      source={source}
                      vote={
                        collectionVotes.find(
                          (vote) => vote.movieId === movie.id,
                        )?.vote
                      }
                      onVote={handleVote}
                      onOpen={setSelectedMovie}
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

      <MovieDetailDrawer
        movie={selectedMovie}
        onClose={() => setSelectedMovie(null)}
        onRemove={handleRemoveMovie}
      />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-white/10 bg-netflix-surface px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
        >
          {toastMessage}
        </div>
      )}
    </>
  );
}
