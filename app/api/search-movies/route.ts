import { tmdbService } from "@/lib/services/tmdb-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  try {
    const results = await tmdbService.searchMovies(query);
    return Response.json(results);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to search movies.";

    return Response.json({ error: message }, { status: 500 });
  }
}
