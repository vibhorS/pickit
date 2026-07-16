import type { Movie } from "@/lib/types";

type DecisionCardProps = {
  movie: Movie;
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

export function DecisionCard({ movie, onLike, onPass }: DecisionCardProps) {
  return (
    <article className="mx-auto flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/5 bg-netflix-surface shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
      <div className="relative aspect-[2/3] overflow-hidden bg-black sm:aspect-video">
        {movie.posterUrl ? (
          <img
            alt={`${movie.title} poster`}
            className="h-full w-full object-cover"
            src={movie.posterUrl}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-netflix-muted">
            No poster
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-netflix-surface via-transparent to-black/20" />
      </div>

      <div className="flex flex-col gap-3 px-5 py-5">
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tight text-white">
            {movie.title}
          </h2>
          <p className="inline-flex items-center gap-1 text-sm font-semibold text-amber-400">
            <StarIcon />
            IMDb {movie.rating.toFixed(1)}
            {movie.year > 0 ? ` · ${movie.year}` : ""}
          </p>
        </div>

        <p className="line-clamp-3 text-sm leading-relaxed text-netflix-muted">
          {movie.overview || "No overview available."}
        </p>

        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={onPass}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/10"
          >
            ❌ Not Interested
          </button>
          <button
            type="button"
            onClick={onLike}
            className="flex-1 rounded-xl bg-netflix-red px-4 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-netflix-red-hover"
          >
            ❤️ I'd Watch
          </button>
        </div>
      </div>
    </article>
  );
}
