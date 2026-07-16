import Link from "next/link";
import type { Collection } from "@/lib/types";

type CollectionCardProps = {
  collection: Collection;
};

export function CollectionCard({ collection }: CollectionCardProps) {
  const movieCount = collection.movieIds.length;
  const movieLabel = movieCount === 1 ? "1 movie" : `${movieCount} movies`;

  return (
    <Link
      href={`/collection/${collection.id}`}
      aria-label={`Open ${collection.name}`}
      className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-netflix-red"
    >
      <article className="group flex w-full flex-col gap-4 rounded-2xl border border-white/5 bg-netflix-surface p-5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] transition duration-300 ease-out hover:-translate-y-1 hover:border-white/10 hover:shadow-[0_16px_40px_rgba(0,0,0,0.55)] sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5 text-2xl"
            >
              {collection.emoji}
            </span>
            <div className="min-w-0 text-left">
              <h2 className="truncate text-lg font-bold tracking-tight text-white sm:text-xl">
                {collection.name}
              </h2>
              <p className="mt-0.5 text-sm text-netflix-muted">{movieLabel}</p>
            </div>
          </div>

          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
              collection.shared
                ? "bg-netflix-red/15 text-netflix-red"
                : "bg-white/5 text-netflix-muted"
            }`}
          >
            {collection.shared ? "Shared" : "Private"}
          </span>
        </div>
      </article>
    </Link>
  );
}
