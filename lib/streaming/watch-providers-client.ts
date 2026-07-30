import {
  getCachedWatchAvailabilityMap,
  isWatchAvailabilityFresh,
  putCachedWatchAvailabilityBatch,
} from "@/lib/streaming/cache";
import type {
  WatchAvailability,
  WatchMediaType,
  WatchTitleRef,
} from "@/lib/streaming/types";

type EnsureOptions = {
  region: string;
  /** Force network refresh even when cache is fresh. */
  force?: boolean;
};

export type WatchProvidersEnsureResult = {
  byId: Map<string, WatchAvailability>;
  /** Titles that were refreshed from the network this call. */
  refreshedIds: string[];
};

function normalizeRefs(refs: WatchTitleRef[]) {
  const seen = new Set<string>();
  const out: Array<{ id: string; mediaType: WatchMediaType }> = [];
  for (const ref of refs) {
    const id = String(ref.id).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      mediaType: ref.mediaType === "tv" ? "tv" : "movie",
    });
  }
  return out;
}

/**
 * Stale-while-revalidate: return cache immediately, refresh expired titles.
 * Never throws — network failures keep cached / empty entries.
 */
export async function ensureWatchProviders(
  refs: WatchTitleRef[],
  options: EnsureOptions,
): Promise<WatchProvidersEnsureResult> {
  const region = options.region.toUpperCase();
  const titles = normalizeRefs(refs);
  const cached = getCachedWatchAvailabilityMap(titles, region);
  const byId = new Map(cached);
  const refreshedIds: string[] = [];

  const needsFetch = titles.filter((title) => {
    if (options.force) return true;
    const entry = cached.get(title.id);
    if (!entry) return true;
    return !isWatchAvailabilityFresh(entry);
  });

  if (needsFetch.length === 0) {
    return { byId, refreshedIds };
  }

  try {
    const response = await fetch("/api/watch-providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        region,
        titles: needsFetch,
      }),
    });

    if (!response.ok) {
      return { byId, refreshedIds };
    }

    const payload = (await response.json()) as {
      results?: Record<string, WatchAvailability>;
    };
    const next = Object.values(payload.results ?? {});
    if (next.length > 0) {
      putCachedWatchAvailabilityBatch(next);
      for (const entry of next) {
        byId.set(entry.mediaId, entry);
        refreshedIds.push(entry.mediaId);
      }
    }
  } catch {
    // Keep cached values; UI stays up.
  }

  return { byId, refreshedIds };
}
