"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCachedWatchAvailabilityMap,
  isWatchAvailabilityFresh,
} from "@/lib/streaming/cache";
import { resolveWatchRegion } from "@/lib/streaming/region";
import type {
  WatchAvailability,
  WatchRegionContext,
  WatchTitleRef,
} from "@/lib/streaming/types";
import { ensureWatchProviders } from "@/lib/streaming/watch-providers-client";

type UseWatchProvidersOptions = {
  regionContext?: WatchRegionContext;
  enabled?: boolean;
};

function normalizeRefs(refs: WatchTitleRef[]): WatchTitleRef[] {
  const seen = new Set<string>();
  const out: WatchTitleRef[] = [];
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
 * Batch watch-provider lookup with stale-while-revalidate.
 * Components never call TMDB directly.
 */
export function useWatchProviders(
  refs: WatchTitleRef[],
  options: UseWatchProvidersOptions = {},
) {
  const enabled = options.enabled !== false;
  const region = resolveWatchRegion(options.regionContext);
  const titleKey = useMemo(
    () =>
      normalizeRefs(refs)
        .map((ref) => `${ref.mediaType ?? "movie"}:${ref.id}`)
        .sort()
        .join("|"),
    [refs],
  );

  const stableRefs = useMemo(
    () => normalizeRefs(refs),
    // titleKey is the stable serialization of refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [titleKey],
  );

  const cachedSnapshot = useMemo(() => {
    if (!enabled || typeof window === "undefined") {
      return new Map<string, WatchAvailability>();
    }
    return getCachedWatchAvailabilityMap(
      stableRefs.map((ref) => ({
        id: ref.id,
        mediaType: ref.mediaType ?? "movie",
      })),
      region,
    );
  }, [enabled, region, stableRefs]);

  const [networkById, setNetworkById] = useState<Map<
    string,
    WatchAvailability
  > | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!enabled || stableRefs.length === 0) return;

    const needsRefresh = stableRefs.some((ref) => {
      const entry = cachedSnapshot.get(ref.id);
      return !entry || !isWatchAvailabilityFresh(entry);
    });
    if (!needsRefresh) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIsRefreshing(true);
    });

    void ensureWatchProviders(stableRefs, { region }).then((result) => {
      if (cancelled) return;
      setNetworkById(new Map(result.byId));
      setIsRefreshing(false);
    });

    return () => {
      cancelled = true;
    };
  }, [cachedSnapshot, enabled, region, stableRefs, titleKey]);

  const byId = networkById ?? cachedSnapshot;

  return {
    region,
    byId,
    isRefreshing,
    get: (mediaId: string) => byId.get(mediaId),
  };
}
