"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { RecommendationContextForm } from "@/components/recommendation/recommendation-context-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PosterImage } from "@/components/ui/poster-image";
import { SearchResultSkeleton } from "@/components/ui/skeleton";
import { MOTION } from "@/lib/motion";
import { mapTmdbResultToMovie } from "@/lib/map-tmdb-result";
import type { TmdbSearchMovie } from "@/lib/services/tmdb-service";
import type { Movie, RecommendationMetadata } from "@/lib/types";

type AddMovieModalProps = {
  open: boolean;
  existingMovieIds: string[];
  onClose: () => void;
  onAdd: (movie: Movie, metadata: RecommendationMetadata) => void;
};

export function AddMovieModal({
  open,
  existingMovieIds,
  onClose,
  onAdd,
}: AddMovieModalProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbSearchMovie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

  const handleClose = useCallback(() => {
    setQuery("");
    setResults([]);
    setError(null);
    setIsSearching(false);
    setSelectedMovie(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const timeoutId = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") handleClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClose, open]);

  useEffect(() => {
    if (!open) return;

    const trimmed = query.trim();

    if (!trimmed) {
      queueMicrotask(() => {
        setResults([]);
        setError(null);
        setIsSearching(false);
      });
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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.duration, ease: MOTION.ease }}
          onClick={handleClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: MOTION.durationSlow, ease: MOTION.ease }}
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-netflix-surface shadow-[var(--shadow-elevated)] sm:max-h-[90vh] sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
              <h2
                id={titleId}
                className="text-lg font-semibold text-white sm:text-xl"
              >
                {selectedMovie ? selectedMovie.title : "Add Movie"}
              </h2>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="btn-ghost min-h-10 min-w-10 p-2"
              >
                <X className="size-5" strokeWidth={2} />
              </button>
            </div>

            {selectedMovie ? (
              <div className="flex-1 overflow-y-auto px-5 pb-6 sm:px-6">
                <RecommendationContextForm
                  captureMethod="manual-search"
                  submitLabel="Add to Collection"
                  onBack={() => setSelectedMovie(null)}
                  onSubmit={(metadata) => {
                    const movie = selectedMovie;
                    setQuery("");
                    setResults([]);
                    setSelectedMovie(null);
                    onAdd(movie, metadata);
                  }}
                />
              </div>
            ) : (
              <>
            <div className="px-5 pb-4 sm:px-6">
              <label className="sr-only" htmlFor="movie-search">
                Search movies
              </label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-netflix-muted"
                  strokeWidth={2}
                />
                <input
                  ref={inputRef}
                  id="movie-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search movies..."
                  className="w-full rounded-xl bg-black/40 py-3.5 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-netflix-muted focus:ring-2 focus:ring-netflix-red/60"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">
              {isSearching && <SearchResultSkeleton />}

              {!isSearching && error && (
                <EmptyState
                  icon={<Search className="size-7" strokeWidth={1.5} />}
                  title="Search failed"
                  description={error}
                />
              )}

              {!isSearching &&
                !error &&
                query.trim() &&
                results.length === 0 && (
                  <EmptyState
                    icon={<Search className="size-7" strokeWidth={1.5} />}
                    title="No matches found"
                    description={`Nothing came up for “${query.trim()}”. Try another title or check the spelling.`}
                  />
                )}

              {!isSearching && !error && !query.trim() && (
                <EmptyState
                  icon={<Search className="size-7" strokeWidth={1.5} />}
                  title="Find a movie"
                  description="Search by title to add something new to this collection."
                />
              )}

              {!isSearching && !error && results.length > 0 && (
                <ul className="space-y-3">
                  {results.map((movie) => {
                    const movieId = String(movie.id);
                    const alreadyAdded = existingMovieIds.includes(movieId);

                    return (
                      <li
                        key={movie.id}
                        className="flex gap-4 rounded-xl bg-black/20 p-3 sm:p-4"
                      >
                        <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg sm:h-32 sm:w-24">
                          <PosterImage
                            src={movie.poster ?? ""}
                            alt={`${movie.title} poster`}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="truncate font-semibold text-white">
                                {movie.title}
                              </h3>
                              <p className="mt-1 text-sm text-netflix-muted">
                                {movie.releaseYear ?? "—"} · TMDb{" "}
                                {movie.rating.toFixed(1)}
                              </p>
                            </div>

                            <button
                              type="button"
                              disabled={alreadyAdded}
                              onClick={() => {
                                const mapped = mapTmdbResultToMovie(movie);
                                if (!mapped.id) return;
                                setSelectedMovie(mapped);
                              }}
                              className="btn-primary min-h-10 shrink-0 px-4 py-2 text-xs disabled:bg-netflix-elevated disabled:text-netflix-muted"
                            >
                              {alreadyAdded ? "Added" : "Add to Collection"}
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
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
