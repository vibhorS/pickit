"use client";

import Link from "next/link";
import { useState } from "react";
import type { Movie } from "@/lib/types";

type TonightSessionProps = {
  collectionId: string;
  collectionName: string;
  matches: Movie[];
};

export function TonightSession({
  collectionId,
  collectionName,
  matches,
}: TonightSessionProps) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Movie | null>(null);

  if (matches.length === 0) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-6">
        <Link
          href={`/collection/${collectionId}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-netflix-muted transition-colors hover:text-white"
        >
          <span aria-hidden="true">←</span>
          {collectionName}
        </Link>
        <section className="rounded-2xl border border-white/5 bg-netflix-surface px-6 py-12 text-center">
          <p aria-hidden="true" className="text-4xl">
            ❤️
          </p>
          <h2 className="mt-4 text-2xl font-black text-white">
            No mutual matches yet
          </h2>
          <p className="mt-2 text-sm text-netflix-muted">
            Keep rating — Tonight&apos;s Picks unlock when you both mark I&apos;d
            Watch on the same movie.
          </p>
          <Link
            href={`/collection/${collectionId}`}
            className="mt-8 inline-flex rounded-xl bg-netflix-red px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-netflix-red-hover"
          >
            Back to Collection
          </Link>
        </section>
      </div>
    );
  }

  if (selected) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-6">
        <Link
          href={`/collection/${collectionId}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-netflix-muted transition-colors hover:text-white"
        >
          <span aria-hidden="true">←</span>
          {collectionName}
        </Link>

        <section className="overflow-hidden rounded-3xl border border-white/5 bg-netflix-surface shadow-[0_16px_48px_rgba(0,0,0,0.55)]">
          <div className="relative aspect-[2/3] bg-black sm:aspect-[16/10]">
            {selected.posterUrl ? (
              <img
                alt={`${selected.title} poster`}
                className="h-full w-full object-cover"
                src={selected.posterUrl}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-netflix-muted">
                No poster
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-netflix-surface via-transparent to-black/30" />
          </div>

          <div className="space-y-5 px-6 py-8 text-center sm:px-8">
            <p aria-hidden="true" className="text-4xl">
              🎉
            </p>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-white">
                Tonight&apos;s movie
              </h2>
              <p className="mt-2 text-xl font-bold text-white">{selected.title}</p>
              <p className="mt-1 text-sm text-netflix-muted">
                {selected.year > 0 ? selected.year : "—"} · TMDb{" "}
                {selected.rating.toFixed(1)}
              </p>
            </div>

            <div className="rounded-xl border border-dashed border-white/15 bg-black/20 px-4 py-5">
              <p className="text-sm font-semibold text-white">
                Streaming Availability
              </p>
              <p className="mt-1 text-sm text-netflix-muted">
                Coming soon — we&apos;ll show where to watch.
              </p>
            </div>

            <Link
              href={`/collection/${collectionId}`}
              className="inline-flex rounded-xl bg-netflix-red px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-netflix-red-hover"
            >
              Back to Collection
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const current = matches[index];
  const remaining = matches.length - index;

  function handleSkip() {
    if (index >= matches.length - 1) {
      setIndex(0);
      return;
    }
    setIndex((value) => value + 1);
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href={`/collection/${collectionId}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-netflix-muted transition-colors hover:text-white"
        >
          <span aria-hidden="true">←</span>
          Tonight&apos;s Picks
        </Link>
        <p className="text-sm font-semibold text-netflix-muted">
          {remaining} left
        </p>
      </div>

      <article className="overflow-hidden rounded-2xl border border-white/5 bg-netflix-surface shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
        <div className="relative aspect-[2/3] bg-black sm:aspect-[3/4]">
          {current.posterUrl ? (
            <img
              alt={`${current.title} poster`}
              className="h-full w-full object-cover"
              src={current.posterUrl}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-netflix-muted">
              No poster
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-netflix-surface via-transparent to-black/20" />
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              {current.title}
            </h2>
            <p className="mt-1 text-sm text-netflix-muted">
              {current.year > 0 ? current.year : "—"} · TMDb{" "}
              {current.rating.toFixed(1)}
            </p>
          </div>

          <p className="line-clamp-3 text-sm leading-relaxed text-netflix-muted">
            {current.overview || "No overview available."}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setSelected(current)}
              className="w-full rounded-xl bg-netflix-red px-4 py-4 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-netflix-red-hover sm:flex-1"
            >
              🍿 Watch Tonight
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/10 sm:flex-1"
            >
              Skip
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
