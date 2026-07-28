import { tmdbService } from "@/lib/services/tmdb-service";
import { logger } from "@/lib/observability/logger";

/** Simple in-memory rate limit placeholder for closed beta. */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 60;
const hits = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous"
  );
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_MAX) return false;
  entry.count += 1;
  return true;
}

function sanitizeQuery(raw: string): string {
  return raw.replace(/[<>]/g, "").trim().slice(0, 120);
}

export async function GET(request: Request) {
  const key = clientKey(request);
  if (!checkRateLimit(key)) {
    logger.warn("Search rate limited", { key });
    return Response.json(
      { error: "Too many searches. Please wait a moment." },
      { status: 429 },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = sanitizeQuery(searchParams.get("q") ?? "");

  if (!query) {
    return Response.json([]);
  }

  try {
    const results = await tmdbService.searchMovies(query);
    return Response.json(results);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to search movies.";
    logger.error("Movie search failed", { message, queryLength: query.length });

    const friendly =
      message.includes("TMDB_API_KEY") || message.includes("API key")
        ? "Search isn’t configured yet. Add a TMDb API key on the server."
        : "Search failed. Check your connection and try again.";

    return Response.json({ error: friendly }, { status: 500 });
  }
}
