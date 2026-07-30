import { describe, expect, it } from "vitest";
import { applyMovieNightFilters } from "@/lib/movie-night/filters/engine";
import { defaultMovieNightFilters } from "@/lib/movie-night/filters/streaming-filters";
import type { CollectionMovie } from "@/lib/services/movie-service";
import type { WatchAvailability } from "@/lib/streaming/types";

function item(id: string, title: string): CollectionMovie {
  return {
    movie: {
      id,
      title,
      year: 2020,
      runtime: 120,
      rating: 8,
      genres: ["Drama"],
      overview: "",
      posterUrl: "",
      mediaType: "movie",
    },
    source: { type: "friend", label: "Friend" },
    addedByUserId: "u1",
    addedAt: "2026-01-01T00:00:00.000Z",
  };
}

function availability(
  id: string,
  providerIds: number[],
): WatchAvailability {
  return {
    mediaId: id,
    mediaType: "movie",
    region: "IN",
    providers: providerIds.map((providerId) => ({
      providerId,
      name: `P${providerId}`,
      logoPath: null,
    })),
    fetchedAt: Date.now(),
    status: providerIds.length > 0 ? "ok" : "unavailable",
  };
}

describe("Movie Night streaming filters", () => {
  it("keeps titles on overlapping crew services", () => {
    const items = [item("1", "A"), item("2", "B")];
    const map = new Map([
      ["1", availability("1", [8, 350])],
      ["2", availability("2", [350, 237])],
    ]);

    const result = applyMovieNightFilters({
      items,
      filters: defaultMovieNightFilters,
      availabilityById: map,
      crewStreamingProviderIds: [8, 119],
      region: "IN",
    });

    expect(result.map((entry) => entry.movie.id)).toEqual(["1"]);
  });

  it("excludes unavailable titles", () => {
    const items = [item("1", "A")];
    const map = new Map([["1", availability("1", [])]]);

    const result = applyMovieNightFilters({
      items,
      filters: defaultMovieNightFilters,
      availabilityById: map,
      crewStreamingProviderIds: [8],
      region: "IN",
    });

    expect(result).toHaveLength(0);
  });

  it("allows all streamable titles when crew prefs are empty", () => {
    const items = [item("1", "A"), item("2", "B")];
    const map = new Map([
      ["1", availability("1", [8])],
      ["2", availability("2", [])],
    ]);

    const result = applyMovieNightFilters({
      items,
      filters: defaultMovieNightFilters,
      availabilityById: map,
      crewStreamingProviderIds: [],
      region: "IN",
    });

    expect(result.map((entry) => entry.movie.id)).toEqual(["1"]);
  });
});
