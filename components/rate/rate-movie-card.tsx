import type { Movie, RecommendationSource } from "@/lib/types";
import { RecommendationSourceChip } from "@/components/recommendation/recommendation-source-chip";

type RateMovieCardProps = {
  movie: Movie;
  source: RecommendationSource;
  onLike: () => void;
  onPass: () => void;
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

function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function RateMovieCard({
  movie,
  source,
  onLike,
  onPass,
}: RateMovieCardProps) {
  const metaParts = [
    movie.year > 0 ? String(movie.year) : null,
    `TMDb ${movie.rating.toFixed(1)}`,
    movie.runtime > 0 ? formatRuntime(movie.runtime) : null,
  ].filter(Boolean);

  return (
    <article className="mx-auto flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/5 bg-netflix-surface shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-black sm:aspect-[3/4]">
        {movie.posterUrl ? (
          <img
            alt={`${movie.title} poster`}
            className="h-full w-full object-cover"
            src={movie.posterUrl}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-netflix-muted">
            No poster
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-netflix-surface via-transparent to-black/25" />
      </div>

      <div className="flex flex-col gap-4 px-5 py-5 sm:px-6 sm:py-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            {movie.title}
          </h2>

          <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-amber-400">
            <span className="inline-flex items-center gap-1">
              <StarIcon />
              {metaParts.join(" · ")}
            </span>
          </p>

          <RecommendationSourceChip type={source.type} label={source.label} />
        </div>

        {movie.genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {movie.genres.map((genre) => (
              <span
                key={genre}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[0.6875rem] font-medium text-netflix-muted"
              >
                {genre}
              </span>
            ))}
          </div>
        )}

        <p className="line-clamp-3 text-sm leading-relaxed text-netflix-muted">
          {movie.overview || "No overview available."}
        </p>

        <div className="mt-1 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onLike}
            className="w-full rounded-xl bg-netflix-red px-4 py-4 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-netflix-red-hover sm:flex-1"
          >
            ❤️ I&apos;d Watch
          </button>
          <button
            type="button"
            onClick={onPass}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/10 sm:flex-1"
          >
            ❌ Not for Me
          </button>
        </div>
      </div>
    </article>
  );
}
