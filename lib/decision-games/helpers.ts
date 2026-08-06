import type { CollectionMovie } from "@/lib/services/movie-service";

export function shuffleItems<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function formatRuntimeMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return "—";
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export type TonightQueueStats = {
  mutualMatches: number;
  averageRating: number;
  totalRuntimeMinutes: number;
  genreCount: number;
};

/** Summary stats for the Tonight Queue overview screen. */
export function getTonightQueueStats(
  queue: CollectionMovie[],
): TonightQueueStats {
  const mutualMatches = queue.length;
  if (mutualMatches === 0) {
    return {
      mutualMatches: 0,
      averageRating: 0,
      totalRuntimeMinutes: 0,
      genreCount: 0,
    };
  }

  const ratingSum = queue.reduce((sum, item) => sum + item.movie.rating, 0);
  const totalRuntimeMinutes = queue.reduce(
    (sum, item) => sum + Math.max(item.movie.runtime, 0),
    0,
  );
  const genres = new Set(
    queue.flatMap((item) => item.movie.genres.map((genre) => genre.toLowerCase())),
  );

  return {
    mutualMatches,
    averageRating: Math.round((ratingSum / mutualMatches) * 10) / 10,
    totalRuntimeMinutes,
    genreCount: genres.size,
  };
}

/** Tournament round labels by remaining bracket size. */
export function getTournamentRoundLabel(remainingCount: number): string {
  if (remainingCount <= 2) return "Final";
  if (remainingCount <= 4) return "Semi Finals";
  if (remainingCount <= 8) return "Quarter Finals";
  return "Round of " + remainingCount;
}
