import type { TmdbSearchMovie } from "@/lib/services/tmdb-service";
import type { Movie } from "@/lib/types";

export function mapTmdbResultToMovie(movie: TmdbSearchMovie): Movie {
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
