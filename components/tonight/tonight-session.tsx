"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/ui/fade-in";
import { PosterImage } from "@/components/ui/poster-image";
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

  if (matchKey !== syncedKey && !selected) {
    setSyncedKey(matchKey);
    setQueue(matches);
  }

  if (matches.length === 0) {
    return (
      <FadeIn className="mx-auto w-full max-w-lg">
        <Link
          href={`/collection/${collectionId}`}
          prefetch
          className="btn-ghost -ml-3 inline-flex items-center gap-2"
        >
          <span aria-hidden="true">←</span>
          {collectionName}
        </Link>
        <EmptyState
          icon={<Heart className="size-7" strokeWidth={1.5} />}
          title="No mutual matches yet"
          description="Tonight unlocks when you both mark I'd Watch on the same movie."
        />
        <div className="text-center">
          <Link
            href={`/collection/${collectionId}`}
            prefetch
            className="btn-primary"
          >
            Back to Collection
          </Link>
        </div>
      </FadeIn>
    );
  }

  if (selected) {
    const runtime = formatRuntime(selected.runtime);

    return (
      <FadeIn className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-3xl">
        {selected.posterUrl && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center opacity-40 blur-2xl"
            style={{ backgroundImage: `url(${selected.posterUrl})` }}
          />
        )}
        <div className="relative px-5 py-8 sm:px-10 sm:py-12">
          <div className="mx-auto flex max-w-sm flex-col items-center text-center">
            <div className="aspect-[2/3] w-48 overflow-hidden rounded-2xl shadow-[var(--shadow-elevated)] sm:w-56">
              <PosterImage
                src={selected.posterUrl}
                alt={`${selected.title} poster`}
                priority
              />
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
              prefetch
              className="btn-primary mt-8 w-full"
            >
              Done
            </Link>
          </div>
        </div>
      </FadeIn>
    );
  }

  if (queue.length === 0) {
    return (
      <FadeIn className="mx-auto w-full max-w-lg">
        <Link
          href={`/collection/${collectionId}`}
          prefetch
          className="btn-ghost -ml-3 inline-flex items-center gap-2"
        >
          <span aria-hidden="true">←</span>
          {collectionName}
        </Link>
        <EmptyState
          icon={<Heart className="size-7" strokeWidth={1.5} />}
          title="That's the queue"
          description="You skipped every mutual match for tonight. Come back anytime — nothing was removed from the collection."
          action={{
            label: "Start Over",
            onClick: () => setQueue(matches),
          }}
        />
      </FadeIn>
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
    <FadeIn className="mx-auto w-full max-w-2xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link
          href={`/collection/${collectionId}`}
          prefetch
          className="btn-ghost -ml-3 inline-flex items-center gap-2"
        >
          <span aria-hidden="true">←</span>
          Tonight
        </Link>
        <p className="text-sm text-netflix-muted">{queue.length} left</p>
      </div>

      <article className="relative overflow-hidden rounded-3xl bg-netflix-surface shadow-[var(--shadow-elevated)]">
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
          <div className="mx-auto w-40 shrink-0 overflow-hidden rounded-xl shadow-[var(--shadow-elevated)] sm:mx-0 sm:w-44">
            <div className="aspect-[2/3]">
              <PosterImage
                src={current.posterUrl}
                alt={`${current.title} poster`}
                priority
              />
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
            className="btn-primary w-full sm:flex-1"
          >
            Watch Tonight
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="btn-secondary w-full sm:flex-1"
          >
            Skip
          </button>
        </div>
      </article>
    </FadeIn>
  );
}
