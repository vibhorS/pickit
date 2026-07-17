"use client";

import Link from "next/link";
import { useState } from "react";
import type { Movie } from "@/lib/types";

type TonightSessionProps = {
  collectionId: string;
  collectionName: string;
  matches: Movie[];
};

function formatRuntime(minutes: number): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function StreamingPlaceholder() {
  return (
    <div className="rounded-xl bg-white/[0.04] px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-netflix-muted/70">
        Where to watch
      </p>
      <p className="mt-1.5 text-sm text-netflix-muted">
        Streaming availability coming soon.
      </p>
    </div>
  );
}

export function TonightSession({
  collectionId,
  collectionName,
  matches,
}: TonightSessionProps) {
  const [queue, setQueue] = useState(matches);
  const [selected, setSelected] = useState<Movie | null>(null);
  const matchKey = matches.map((movie) => movie.id).join(",");
  const [syncedKey, setSyncedKey] = useState(matchKey);

  // Reset tonight's session queue only when the mutual-match set changes.
  if (matchKey !== syncedKey && !selected) {
    setSyncedKey(matchKey);
    setQueue(matches);
  }

  if (matches.length === 0) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-8">
        <Link
          href={`/collection/${collectionId}`}
          className="inline-flex items-center gap-2 text-sm text-netflix-muted transition-colors duration-200 hover:text-white"
        >
          <span aria-hidden="true">←</span>
          {collectionName}
        </Link>
        <section className="px-2 py-16 text-center">
          <p aria-hidden="true" className="text-4xl">
            ❤️
          </p>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-white">
            No mutual matches yet
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-netflix-muted">
            Tonight unlocks when you both mark I&apos;d Watch on the same movie.
          </p>
          <Link
            href={`/collection/${collectionId}`}
            className="mt-10 inline-flex rounded-xl bg-netflix-red px-7 py-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-netflix-red-hover"
          >
            Back to Collection
          </Link>
        </section>
      </div>
    );
  }

  if (selected) {
    const runtime = formatRuntime(selected.runtime);

    return (
      <div className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-3xl">
        {selected.posterUrl && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center opacity-40 blur-2xl"
            style={{ backgroundImage: `url(${selected.posterUrl})` }}
          />
        )}
        <div className="relative px-5 py-8 sm:px-10 sm:py-12">
          <div className="mx-auto flex max-w-sm flex-col items-center text-center">
            <div className="aspect-[2/3] w-48 overflow-hidden rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.55)] sm:w-56">
              {selected.posterUrl ? (
                <img
                  alt={`${selected.title} poster`}
                  className="h-full w-full object-cover"
                  src={selected.posterUrl}
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-netflix-elevated text-netflix-muted">
                  No poster
                </div>
              )}
            </div>

            <p aria-hidden="true" className="mt-8 text-4xl">
              🎉
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Great choice!
            </h2>
            <p className="mt-3 text-xl font-semibold text-white">
              {selected.title}
            </p>
            {runtime && (
              <p className="mt-1 text-sm text-netflix-muted">{runtime}</p>
            )}

            <div className="mt-8 w-full">
              <StreamingPlaceholder />
            </div>

            <Link
              href={`/collection/${collectionId}`}
              className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-netflix-red px-7 py-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-netflix-red-hover"
            >
              Done
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-8">
        <Link
          href={`/collection/${collectionId}`}
          className="inline-flex items-center gap-2 text-sm text-netflix-muted transition-colors duration-200 hover:text-white"
        >
          <span aria-hidden="true">←</span>
          {collectionName}
        </Link>
        <section className="px-2 py-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white">
            That&apos;s the queue
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-netflix-muted">
            You skipped every mutual match for tonight. Come back anytime —
            nothing was removed from the collection.
          </p>
          <button
            type="button"
            onClick={() => setQueue(matches)}
            className="mt-10 inline-flex rounded-xl bg-netflix-red px-7 py-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-netflix-red-hover"
          >
            Start Over
          </button>
        </section>
      </div>
    );
  }

  const current = queue[0];
  const runtime = formatRuntime(current.runtime);
  const meta = [
    current.year > 0 ? String(current.year) : null,
    runtime,
    current.rating > 0 ? current.rating.toFixed(1) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  function handleSkip() {
    setQueue((currentQueue) => currentQueue.slice(1));
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link
          href={`/collection/${collectionId}`}
          className="inline-flex items-center gap-2 text-sm text-netflix-muted transition-colors duration-200 hover:text-white"
        >
          <span aria-hidden="true">←</span>
          Tonight
        </Link>
        <p className="text-sm text-netflix-muted">{queue.length} left</p>
      </div>

      <article className="relative overflow-hidden rounded-3xl bg-netflix-surface shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
        {current.posterUrl && (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${current.posterUrl})` }}
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-netflix-surface via-netflix-surface/92 to-black/55"
        />

        <div className="relative flex flex-col gap-8 px-5 pb-6 pt-8 sm:flex-row sm:items-end sm:px-8 sm:pb-8 sm:pt-12">
          <div className="mx-auto w-40 shrink-0 overflow-hidden rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.55)] sm:mx-0 sm:w-44">
            <div className="aspect-[2/3] bg-netflix-elevated">
              {current.posterUrl ? (
                <img
                  alt={`${current.title} poster`}
                  className="h-full w-full object-cover"
                  src={current.posterUrl}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-netflix-muted">
                  No poster
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-4 pb-1">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {current.title}
              </h2>
              {meta && (
                <p className="mt-2 text-sm text-netflix-muted">{meta}</p>
              )}
            </div>

            {current.genres.length > 0 && (
              <p className="text-sm text-netflix-muted/85">
                {current.genres.join(" · ")}
              </p>
            )}

            <p className="line-clamp-4 text-sm leading-relaxed text-netflix-muted">
              {current.overview || "No overview available."}
            </p>

            <StreamingPlaceholder />
          </div>
        </div>

        <div className="relative flex flex-col gap-3 px-5 pb-6 sm:flex-row sm:px-8 sm:pb-8">
          <button
            type="button"
            onClick={() => setSelected(current)}
            className="w-full rounded-xl bg-netflix-red px-4 py-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-netflix-red-hover sm:flex-1"
          >
            Watch Tonight
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="w-full rounded-xl bg-white/5 px-4 py-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/10 sm:flex-1"
          >
            Skip
          </button>
        </div>
      </article>
    </div>
  );
}
