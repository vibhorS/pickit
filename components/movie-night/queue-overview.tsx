"use client";

import { FadeIn } from "@/components/ui/fade-in";
import {
  formatRuntimeMinutes,
  getTonightQueueStats,
} from "@/lib/decision-games/helpers";
import type { CollectionMovie } from "@/lib/services/movie-service";

type QueueOverviewProps = {
  collectionName: string;
  collectionEmoji: string;
  queue: CollectionMovie[];
  onContinue: () => void;
  onBack: () => void;
};

export function QueueOverview({
  collectionName,
  collectionEmoji,
  queue,
  onContinue,
  onBack,
}: QueueOverviewProps) {
  const stats = getTonightQueueStats(queue);
  const countLabel =
    stats.mutualMatches === 1
      ? "1 movie you'd both watch"
      : `${stats.mutualMatches} movies you'd both watch`;

  return (
    <FadeIn className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-2 text-center">
      <p aria-hidden="true" className="text-5xl">
        🎉
      </p>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
        Great news!
      </h1>
      <p className="mt-3 text-base leading-relaxed text-netflix-muted sm:text-lg">
        You have {countLabel}.
      </p>
      <p className="mt-2 text-sm text-netflix-muted/80">
        {collectionEmoji} {collectionName} · Tonight&apos;s Queue
      </p>

      <dl className="mt-10 grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
        <div className="rounded-xl bg-white/[0.04] px-3 py-3">
          <dt className="text-[0.625rem] font-medium uppercase tracking-wide text-netflix-muted/80">
            Mutual Matches
          </dt>
          <dd className="mt-1 text-xl font-semibold text-white">
            {stats.mutualMatches}
          </dd>
        </div>
        <div className="rounded-xl bg-white/[0.04] px-3 py-3">
          <dt className="text-[0.625rem] font-medium uppercase tracking-wide text-netflix-muted/80">
            Avg TMDb
          </dt>
          <dd className="mt-1 text-xl font-semibold text-white">
            {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "—"}
          </dd>
        </div>
        <div className="rounded-xl bg-white/[0.04] px-3 py-3">
          <dt className="text-[0.625rem] font-medium uppercase tracking-wide text-netflix-muted/80">
            Total Runtime
          </dt>
          <dd className="mt-1 text-xl font-semibold text-white">
            {formatRuntimeMinutes(stats.totalRuntimeMinutes)}
          </dd>
        </div>
        <div className="rounded-xl bg-white/[0.04] px-3 py-3">
          <dt className="text-[0.625rem] font-medium uppercase tracking-wide text-netflix-muted/80">
            Genres
          </dt>
          <dd className="mt-1 text-xl font-semibold text-white">
            {stats.genreCount || "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-12 flex flex-col gap-3">
        <button
          type="button"
          onClick={onContinue}
          className="btn-primary min-h-14 w-full text-base"
        >
          Continue
        </button>
        <button type="button" onClick={onBack} className="btn-ghost w-full">
          Back
        </button>
      </div>
    </FadeIn>
  );
}
