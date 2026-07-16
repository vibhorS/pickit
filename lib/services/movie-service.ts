import { movies } from "@/lib/mock-data";
import type { Movie } from "@/lib/types";
import {
  tmdbService,
  type TmdbSearchMovie,
} from "@/lib/services/tmdb-service";

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

  async search(query: string): Promise<Movie[]> {
    const results = await tmdbService.searchMovies(query);
    return results.map(mapTmdbMovieToMovie);
  },
};
