"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PosterImage } from "@/components/ui/poster-image";
import { mapTmdbResultToMovie } from "@/lib/map-tmdb-result";
import type { TmdbSearchMovie } from "@/lib/services/tmdb-service";
import type { Movie } from "@/lib/types";

type ManualMovieSearchProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (movie: Movie) => void;
};

export function ManualMovieSearch({
  open,
  onClose,
  onAdd,
}: ManualMovieSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbSearchMovie[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open || !query.trim()) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setBusy(true);
      try {
        const response = await fetch(
          `/api/search-movies?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search failed");
        setResults((await response.json()) as TmdbSearchMovie[]);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [open, query]);

  if (!open) return null;

  function handleClose() {
    setQuery("");
    setResults([]);
    setBusy(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 sm:items-center sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-search-title"
        className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-t-3xl bg-netflix-surface shadow-[var(--shadow-elevated)] sm:rounded-3xl"
      >
        <div className="flex items-center justify-between px-5 py-4">
          <h2 id="manual-search-title" className="text-lg font-semibold">
            Add a movie manually
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="btn-ghost min-h-10 min-w-10 p-2"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="relative px-5 pb-4">
          <Search className="absolute left-8 top-3.5 size-4 text-netflix-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              const next = event.target.value;
              setQuery(next);
              if (!next.trim()) {
                setResults([]);
                setBusy(false);
              }
            }}
            placeholder="Search TMDb…"
            className="w-full rounded-xl bg-black/35 py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-netflix-red/60"
          />
        </div>
        <div className="min-h-32 flex-1 overflow-y-auto px-5 pb-6">
          {busy ? (
            <p className="py-8 text-center text-sm text-netflix-muted">
              Searching…
            </p>
          ) : (
            <ul className="space-y-2">
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onAdd(mapTmdbResultToMovie(result));
                      handleClose();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl bg-black/20 p-3 text-left transition hover:bg-black/35"
                  >
                    <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md">
                      <PosterImage
                        src={result.poster ?? ""}
                        alt={`${result.title} poster`}
                      />
                    </div>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-white">
                        {result.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-netflix-muted">
                        {result.releaseYear ?? "—"} · ★{" "}
                        {result.rating.toFixed(1)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
