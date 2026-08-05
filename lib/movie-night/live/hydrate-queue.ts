import type { MovieNightLiveSession } from "@/lib/movie-night/live/types";
import { getCloudRepositories } from "@/lib/repositories/cloud";
import type { CollectionMovie } from "@/lib/services/movie-service";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Movie } from "@/lib/types";

/** Ordered unique ids the live UI must be able to render for this session. */
export function sessionMovieIds(session: MovieNightLiveSession): string[] {
  const ids = [
    ...session.activeMovieIds,
    ...session.maybeMovieIds,
    ...(session.winnerMovieId ? [session.winnerMovieId] : []),
    ...(session.currentMovieId ? [session.currentMovieId] : []),
  ];
  return [...new Set(ids.filter(Boolean))];
}

function asCollectionMovie(movie: Movie, seed?: CollectionMovie): CollectionMovie {
  return {
    movie,
    source: seed?.source ?? { type: "manual", label: "Movie Night" },
    metadata: seed?.metadata,
    addedByUserId: seed?.addedByUserId ?? "",
    addedAt: seed?.addedAt ?? sessionEpoch(),
  };
}

function sessionEpoch(): string {
  return new Date().toISOString();
}

/**
 * Build the render queue from the server session lineup.
 * Catalog/seed items are only used to resolve movie objects + recommendation
 * metadata — never as the authority for which ids are in play.
 */
export async function hydrateQueueFromSession(
  session: MovieNightLiveSession,
  catalogItems: CollectionMovie[] = [],
): Promise<CollectionMovie[]> {
  const requiredIds = sessionMovieIds(session);
  if (requiredIds.length === 0) return [];

  const byId = new Map<string, CollectionMovie>();
  for (const item of catalogItems) {
    byId.set(item.movie.id, item);
  }

  const missing = requiredIds.filter((id) => !byId.has(id));
  if (missing.length > 0 && isSupabaseConfigured()) {
    const fetched = await getCloudRepositories().movies.getByIds(missing);
    for (const movie of fetched) {
      byId.set(movie.id, asCollectionMovie(movie));
    }
  }

  // Preserve session order (active lineup, then any maybe/winner-only leftovers).
  const ordered: CollectionMovie[] = [];
  const seen = new Set<string>();
  for (const id of [
    ...session.activeMovieIds,
    ...session.maybeMovieIds,
    ...(session.winnerMovieId ? [session.winnerMovieId] : []),
  ]) {
    if (seen.has(id)) continue;
    const item = byId.get(id);
    if (!item) continue;
    seen.add(id);
    ordered.push(item);
  }

  return ordered;
}

export function queueCoversSession(
  queue: CollectionMovie[],
  session: MovieNightLiveSession,
): boolean {
  if (!session.currentMovieId) return queue.length > 0;
  return queue.some((item) => item.movie.id === session.currentMovieId);
}
