const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

const GENRE_NAMES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

export type TmdbSearchMovie = {
  id: number;
  title: string;
  poster: string | null;
  releaseYear: number | null;
  overview: string;
  rating: number;
  voteCount: number;
  genres: string[];
};

type TmdbSearchMovieResult = {
  id: number;
  title: string;
  poster_path: string | null;
  release_date?: string;
  overview: string;
  vote_average: number;
  vote_count?: number;
  genre_ids: number[];
};

type TmdbSearchResponse = {
  results: TmdbSearchMovieResult[];
};

function getApiKey(): string {
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    throw new Error("Missing TMDB_API_KEY environment variable.");
  }

  return apiKey;
}

function mapGenres(genreIds: number[]): string[] {
  return genreIds
    .map((id) => GENRE_NAMES[id])
    .filter((name): name is string => Boolean(name));
}

function mapSearchResult(movie: TmdbSearchMovieResult): TmdbSearchMovie {
  const releaseYear = movie.release_date
    ? Number.parseInt(movie.release_date.slice(0, 4), 10)
    : null;

  return {
    id: movie.id,
    title: movie.title,
    poster: movie.poster_path
      ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}`
      : null,
    releaseYear: Number.isFinite(releaseYear) ? releaseYear : null,
    overview: movie.overview,
    rating: movie.vote_average,
    voteCount: typeof movie.vote_count === "number" ? movie.vote_count : 0,
    genres: mapGenres(movie.genre_ids),
  };
}

export type TmdbWatchProvider = {
  providerId: number;
  name: string;
  logoPath: string | null;
};

type TmdbWatchProviderResult = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority?: number;
};

type TmdbWatchProvidersResponse = {
  results?: Record<
    string,
    {
      flatrate?: TmdbWatchProviderResult[];
      rent?: TmdbWatchProviderResult[];
      buy?: TmdbWatchProviderResult[];
      ads?: TmdbWatchProviderResult[];
      free?: TmdbWatchProviderResult[];
    }
  >;
};

function mapWatchProvider(
  provider: TmdbWatchProviderResult,
): TmdbWatchProvider {
  return {
    providerId: provider.provider_id,
    name: provider.provider_name,
    logoPath: provider.logo_path
      ? `${TMDB_IMAGE_BASE_URL}${provider.logo_path}`
      : null,
  };
}

export const tmdbService = {
  async searchMovies(query: string): Promise<TmdbSearchMovie[]> {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return [];
    }

    const url = new URL(`${TMDB_BASE_URL}/search/movie`);
    url.searchParams.set("api_key", getApiKey());
    url.searchParams.set("query", trimmedQuery);
    url.searchParams.set("include_adult", "false");

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`TMDb search failed with status ${response.status}.`);
    }

    const data = (await response.json()) as TmdbSearchResponse;

    return data.results.map(mapSearchResult);
  },

  /**
   * Flatrate (subscription) watch providers for a title in a region.
   * Rent / buy / ads / free are intentionally ignored.
   */
  async getWatchProviders(
    mediaType: "movie" | "tv",
    tmdbId: string | number,
    region: string,
  ): Promise<TmdbWatchProvider[]> {
    const pathType = mediaType === "tv" ? "tv" : "movie";
    const url = new URL(
      `${TMDB_BASE_URL}/${pathType}/${encodeURIComponent(String(tmdbId))}/watch/providers`,
    );
    url.searchParams.set("api_key", getApiKey());

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(
        `TMDb watch providers failed with status ${response.status}.`,
      );
    }

    const data = (await response.json()) as TmdbWatchProvidersResponse;
    const country = data.results?.[region.toUpperCase()];
    const flatrate = country?.flatrate ?? [];
    return flatrate.map(mapWatchProvider);
  },
};
