import type { CollectionMovie } from "@/lib/services/movie-service";
import type { Movie } from "@/lib/types";
import type { WatchAvailability } from "@/lib/streaming/types";

/**
 * Extensible Movie Night filter context.
 * Add fields here as new filters need data (runtime, language, genres…).
 */
export type MovieNightFilterContext = {
  item: CollectionMovie;
  movie: Movie;
  availability: WatchAvailability | null | undefined;
  /** Expanded TMDB provider ids the crew owns. Empty = not configured. */
  crewStreamingProviderIds: number[];
  region: string;
};

export type MovieNightFilterResult = boolean | "unknown";

export type MovieNightFilter = {
  id: string;
  label: string;
  /**
   * true = keep, false = drop, "unknown" = treat as drop for Movie Night
   * until data arrives (never block Collections).
   */
  evaluate: (context: MovieNightFilterContext) => MovieNightFilterResult;
};
