import type { CollectionMovie } from "@/lib/services/movie-service";
import {
  applyMovieNightFilters,
  defaultMovieNightFilters,
} from "@/lib/movie-night/filters";
import type { WatchAvailability } from "@/lib/streaming/types";
import { getTonightQueue } from "@/store/collection-stats-selector";

export type BuildMovieNightQueueInput = {
  collectionId: string;
  availabilityById: Map<string, WatchAvailability>;
  crewStreamingProviderIds: number[];
  region: string;
  /** Optional override of the mutual-match base queue. */
  baseQueue?: CollectionMovie[];
};

/**
 * Movie Night candidate list:
 * mutual matches ∩ streamable ∩ crew subscriptions.
 */
export function buildMovieNightQueue(
  input: BuildMovieNightQueueInput,
): CollectionMovie[] {
  const base =
    input.baseQueue ?? getTonightQueue(input.collectionId);

  return applyMovieNightFilters({
    items: base,
    filters: defaultMovieNightFilters,
    availabilityById: input.availabilityById,
    crewStreamingProviderIds: input.crewStreamingProviderIds,
    region: input.region,
  });
}
