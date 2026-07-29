import { movies } from "@/lib/mock-data";
import type {
  CollectionItem,
  Movie,
  RecommendationMetadata,
  RecommendationSource,
} from "@/lib/types";
import {
  tmdbService,
  type TmdbSearchMovie,
} from "@/lib/services/tmdb-service";

export type CollectionMovie = {
  movie: Movie;
  source: RecommendationSource;
  metadata?: RecommendationMetadata;
  addedByUserId: string;
  addedAt: string;
};

function mapTmdbMovieToMovie(movie: TmdbSearchMovie): Movie {
  return {
    id: String(movie.id),
    title: movie.title,
    year: movie.releaseYear ?? 0,
    runtime: 0,
    rating: movie.rating,
    genres: movie.genres,
    overview: movie.overview,
    posterUrl: movie.poster ?? "",
    mediaType: "movie",
  };
}

export const movieService = {
  getMovies(): Movie[] {
    return movies;
  },

  getMovieById(id: string): Movie | undefined {
    return movies.find((movie) => movie.id === id);
  },

  getMoviesByIds(ids: string[]): Movie[] {
    return ids
      .map((id) => movies.find((movie) => movie.id === id))
      .filter((movie): movie is Movie => movie !== undefined);
  },

  getCollectionMovies(items: CollectionItem[]): CollectionMovie[] {
    return items.flatMap((item) => {
      const movie = movies.find((entry) => entry.id === item.movieId);
      if (!movie) return [];
      return [
        {
          movie,
          source: item.source,
          metadata: item.metadata,
          addedByUserId: item.addedByUserId ?? "",
          addedAt:
            item.addedAt ??
            item.metadata?.savedAt ??
            "2026-01-01T00:00:00.000Z",
        },
      ];
    });
  },

  getCollectionMovie(
    items: CollectionItem[],
    movieId: string,
  ): CollectionMovie | undefined {
    const item = items.find((entry) => entry.movieId === movieId);
    if (!item) return undefined;

    const movie = movies.find((entry) => entry.id === item.movieId);
    if (!movie) return undefined;

    return {
      movie,
      source: item.source,
      metadata: item.metadata,
      addedByUserId: item.addedByUserId ?? "",
      addedAt:
        item.addedAt ??
        item.metadata?.savedAt ??
        "2026-01-01T00:00:00.000Z",
    };
  },

  async search(query: string): Promise<Movie[]> {
    const results = await tmdbService.searchMovies(query);
    return results.map(mapTmdbMovieToMovie);
  },
};
