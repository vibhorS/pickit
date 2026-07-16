import Link from "next/link";
import type { Movie } from "@/lib/types";

type MatchScreenProps = {
  matches: Movie[];
  collectionId: string;
};

function StarIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0 fill-current"
      viewBox="0 0 20 20"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function trailerUrl(title: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${title} official trailer`,
  )}`;
}

export function MatchScreen({ matches, collectionId }: MatchScreenProps) {
  if (matches.length === 0) {
    return (
      <div className="mx-auto w-full max-w-md text-center">
        <div className="rounded-2xl border border-white/10 bg-netflix-surface px-6 py-16 shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
          <div
            aria-hidden="true"
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-3xl"
          >
            🤷
          </div>
          <h2 className="mt-5 text-2xl font-black text-white">No matches</h2>
          <p className="mt-3 text-sm leading-relaxed text-netflix-muted">
            You didn&apos;t like any of the same movies this round. Try again
            with a different collection.
          </p>
        </div>

        <div className="mt-8">
          <Link
            href={`/collection/${collectionId}`}
            className="inline-block rounded-xl bg-netflix-elevated/80 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-netflix-elevated"
          >
            Back to Collection
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-netflix-red">
          Results
        </p>
        <h2 className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl">
          ❤️ MATCH!
        </h2>
        <p className="mt-3 text-netflix-muted">
          {matches.length === 1
            ? "You both liked this one."
            : `You both liked ${matches.length} movies.`}
        </p>
      </div>

      <div className="mt-10 space-y-8">
        {matches.map((movie) => (
          <article
            key={movie.id}
            className="overflow-hidden rounded-2xl border border-white/5 bg-netflix-surface shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
          >
            <div className="grid gap-0 sm:grid-cols-[220px_1fr]">
              <div className="aspect-[2/3] bg-black sm:aspect-auto sm:min-h-full">
                {movie.posterUrl ? (
                  <img
                    src={movie.posterUrl}
                    alt={`${movie.title} poster`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full min-h-64 items-center justify-center text-netflix-muted">
                    No poster
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 p-5 sm:p-6">
                <div>
                  <h3 className="text-2xl font-black tracking-tight text-white">
                    {movie.title}
                  </h3>
                  <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-amber-400">
                    <StarIcon />
                    IMDb {movie.rating.toFixed(1)}
                  </p>
                </div>

                <p className="text-sm leading-relaxed text-netflix-muted">
                  {movie.overview || "No overview available."}
                </p>

                <div className="rounded-xl border border-dashed border-white/15 bg-black/20 px-4 py-4">
                  <p className="text-sm text-netflix-muted">
                    Streaming providers coming soon
                  </p>
                </div>

                <div className="mt-auto flex flex-col gap-3 pt-2 sm:flex-row">
                  <a
                    href={trailerUrl(movie.title)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex flex-1 items-center justify-center rounded-xl bg-netflix-red px-4 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-netflix-red-hover"
                  >
                    Watch Trailer
                  </a>
                  <Link
                    href={`/collection/${collectionId}`}
                    className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/10"
                  >
                    Back to Collection
                  </Link>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
