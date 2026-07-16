"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import type { TmdbSearchMovie } from "@/lib/services/tmdb-service";
import type { Movie } from "@/lib/types";

type AddMovieModalProps = {
  open: boolean;
  existingMovieIds: string[];
  onClose: () => void;
  onAdd: (movie: Movie) => void;
};

function mapTmdbResultToMovie(movie: TmdbSearchMovie): Movie {
  return {
    id: String(movie.id),
    title: movie.title,
    year: movie.releaseYear ?? 0,
    runtime: 0,
    rating: movie.rating,
    genres: movie.genres,
    overview: movie.overview,
    posterUrl: movie.poster ?? "",
  };
}

export function AddMovieModal({
  open,
  existingMovieIds,
  onClose,
  onAdd,
}: AddMovieModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbSearchMovie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setError(null);
      setIsSearching(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const trimmed = query.trim();

    if (!trimmed) {
      setResults([]);
      setError(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/search-movies?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(data?.error ?? "Search failed.");
        }

        const data = (await response.json()) as TmdbSearchMovie[];
        setResults(data);
      } catch (err) {
        if (controller.signal.aborted) return;
        setResults([]);
        setError(err instanceof Error ? err.message : "Search failed.");
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [query, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-movie-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-netflix-surface shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <h2
            id="add-movie-title"
            className="text-lg font-bold text-white sm:text-xl"
          >
            Add Movie
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-netflix-muted transition-colors hover:bg-white/5 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="border-b border-white/10 px-5 py-4 sm:px-6">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search movies..."
            autoFocus
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition placeholder:text-netflix-muted focus:border-netflix-red"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {isSearching && (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-netflix-muted">Searching...</p>
            </div>
          )}

          {!isSearching && error && (
            <EmptyState
              emoji="⚠️"
              title="Search failed"
              description={error}
            />
          )}

          {!isSearching && !error && query.trim() && results.length === 0 && (
            <EmptyState
              emoji="🔍"
              title="No matches found"
              description={`Nothing came up for “${query.trim()}”. Try another title or check the spelling.`}
            />
          )}

          {!isSearching && !error && !query.trim() && (
            <EmptyState
              emoji="🍿"
              title="Find a movie"
              description="Search by title to add something new to this collection."
            />
          )}

          {!isSearching && !error && results.length > 0 && (
            <ul className="space-y-4">
              {results.map((movie) => {
                const movieId = String(movie.id);
                const alreadyAdded = existingMovieIds.includes(movieId);

                return (
                  <li
                    key={movie.id}
                    className="flex gap-4 rounded-xl border border-white/5 bg-black/20 p-3 sm:p-4"
                  >
                    <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-black sm:h-32 sm:w-24">
                      {movie.poster ? (
                        <img
                          src={movie.poster}
                          alt={`${movie.title} poster`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-netflix-muted">
                          No poster
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate font-bold text-white">
                            {movie.title}
                          </h3>
                          <p className="mt-1 text-sm text-netflix-muted">
                            {movie.releaseYear ?? "—"} · IMDb{" "}
                            {movie.rating.toFixed(1)}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => onAdd(mapTmdbResultToMovie(movie))}
                          className="shrink-0 rounded-lg bg-netflix-red px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-netflix-red-hover disabled:cursor-not-allowed disabled:bg-netflix-elevated disabled:text-netflix-muted"
                        >
                          {alreadyAdded ? "Added" : "Add"}
                        </button>
                      </div>

                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-netflix-muted">
                        {movie.overview || "No overview available."}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
