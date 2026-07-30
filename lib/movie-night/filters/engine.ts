import type { CollectionMovie } from "@/lib/services/movie-service";
import type {
  MovieNightFilter,
  MovieNightFilterContext,
} from "@/lib/movie-night/filters/types";
import type { WatchAvailability } from "@/lib/streaming/types";

export type ApplyMovieNightFiltersInput = {
  items: CollectionMovie[];
  filters: MovieNightFilter[];
  availabilityById: Map<string, WatchAvailability>;
  crewStreamingProviderIds: number[];
  region: string;
};

/**
 * Pipeline: item must pass every filter (AND).
 * "unknown" results are excluded from Movie Night (strict eligibility).
 */
export function applyMovieNightFilters(
  input: ApplyMovieNightFiltersInput,
): CollectionMovie[] {
  const {
    items,
    filters,
    availabilityById,
    crewStreamingProviderIds,
    region,
  } = input;

  if (filters.length === 0) return [...items];

  return items.filter((item) => {
    const context: MovieNightFilterContext = {
      item,
      movie: item.movie,
      availability: availabilityById.get(item.movie.id),
      crewStreamingProviderIds,
      region,
    };

    for (const filter of filters) {
      const result = filter.evaluate(context);
      if (result !== true) return false;
    }
    return true;
  });
}
