import type { MovieNightFilter } from "@/lib/movie-night/filters/types";

function isTmdbNumericId(id: string) {
  return /^\d+$/.test(id);
}

/**
 * Movie has at least one flatrate (subscription) streaming provider.
 * Non-TMDB local/mock ids skip this gate so offline demos still work.
 */
export const streamableFilter: MovieNightFilter = {
  id: "streamable",
  label: "Available to stream",
  evaluate: ({ movie, availability }) => {
    if (!isTmdbNumericId(movie.id)) return true;
    if (!availability) return "unknown";
    if (availability.status === "error" && availability.providers.length === 0) {
      return "unknown";
    }
    if (availability.status === "unavailable") return false;
    return availability.providers.length > 0;
  },
};

/**
 * Movie is on at least one Crew-owned streaming service.
 * When the crew has not configured preferences yet, this filter passes
 * any streamable title (streamableFilter still applies upstream).
 */
export const crewSubscriptionFilter: MovieNightFilter = {
  id: "crew-subscriptions",
  label: "On a crew streaming service",
  evaluate: ({ movie, availability, crewStreamingProviderIds }) => {
    if (!isTmdbNumericId(movie.id)) return true;
    if (crewStreamingProviderIds.length === 0) return true;
    if (!availability) return "unknown";
    if (availability.providers.length === 0) return false;
    const owned = new Set(crewStreamingProviderIds);
    return availability.providers.some((provider) =>
      owned.has(provider.providerId),
    );
  },
};

/** Default Movie Night pipeline — extend by appending filters. */
export const defaultMovieNightFilters: MovieNightFilter[] = [
  streamableFilter,
  crewSubscriptionFilter,
];
