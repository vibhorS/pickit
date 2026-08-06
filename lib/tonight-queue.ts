import type { CollectionMovie } from "@/lib/services/movie-service";

export type TonightQueue = {
  /** Immutable for the Movie Night session. */
  items: CollectionMovie[];
};

export function createTonightQueue(items: CollectionMovie[]): TonightQueue {
  return { items: [...items] };
}

/** Quick Pick session — skips never touch permanent ratings. */
export type QuickPickSession = {
  candidates: CollectionMovie[];
  remaining: CollectionMovie[];
  skippedTonight: string[];
};

export function createQuickPickSession(
  queue: CollectionMovie[],
): QuickPickSession {
  return {
    candidates: [...queue],
    remaining: [...queue],
    skippedTonight: [],
  };
}

export function skipQuickPickMovie(
  session: QuickPickSession,
): QuickPickSession {
  const [current, ...rest] = session.remaining;
  if (!current) return session;

  return {
    candidates: session.candidates,
    remaining: rest,
    skippedTonight: [...session.skippedTonight, current.movie.id],
  };
}

export function getQuickPickProgress(session: QuickPickSession): {
  currentIndex: number;
  total: number;
  remainingCount: number;
  skippedCount: number;
} {
  const total = session.candidates.length;
  const remainingCount = session.remaining.length;
  const skippedCount = session.skippedTonight.length;
  const viewed = total - remainingCount;
  const currentIndex =
    remainingCount === 0 ? total : Math.min(viewed + 1, total);

  return { currentIndex, total, remainingCount, skippedCount };
}
