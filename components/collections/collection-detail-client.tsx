"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AddMovieModal } from "@/components/collections/add-movie-modal";
import { MovieDetailDrawer } from "@/components/movie/movie-detail-drawer";
import { MovieGridCard } from "@/components/movie/movie-grid-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Collection, Movie } from "@/lib/types";

type CollectionDetailClientProps = {
  collection: Collection;
  initialMovies: Movie[];
};

export function CollectionDetailClient({
  collection,
  initialMovies,
}: CollectionDetailClientProps) {
  const [movies, setMovies] = useState(initialMovies);
  const [isAddMovieOpen, setIsAddMovieOpen] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const movieCount = movies.length;
  const movieLabel = movieCount === 1 ? "1 movie" : `${movieCount} movies`;

  useEffect(() => {
    if (!toastMessage) return;

    const timeoutId = window.setTimeout(() => {
      setToastMessage(null);
    }, 2500);

    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  function handleAddMovie(movie: Movie) {
    setMovies((current) => {
      if (current.some((item) => item.id === movie.id)) {
        return current;
      }
      return [...current, movie];
    });
    setIsAddMovieOpen(false);
    setToastMessage(`Added to ${collection.name} ❤️`);
  }

  function handleRemoveMovie(movieId: string) {
    setMovies((current) => current.filter((movie) => movie.id !== movieId));
    setSelectedMovie(null);
    setToastMessage(`Removed from ${collection.name}`);
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
                <span className="text-sm text-netflix-muted">{movieLabel}</span>
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
              href={`/collection/${collection.id}/decide`}
              className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/10 sm:w-auto"
            >
              🎲 Start Decision
            </Link>
          </div>
        </header>

        <section className="mt-8 sm:mt-10">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-white sm:text-xl">Movies</h2>
            <span className="text-sm text-netflix-muted">{movieCount}</span>
          </div>

          {movies.length === 0 ? (
            <EmptyState
              emoji="🎬"
              title="No movies yet"
              description={`Start building ${collection.name} by adding your first title.`}
              action={{
                label: "➕ Add Movie",
                onClick: () => setIsAddMovieOpen(true),
              }}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {movies.map((movie) => (
                <MovieGridCard
                  key={movie.id}
                  movie={movie}
                  onClick={setSelectedMovie}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <AddMovieModal
        open={isAddMovieOpen}
        existingMovieIds={movies.map((movie) => movie.id)}
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
