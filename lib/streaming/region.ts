import type { WatchRegionContext } from "@/lib/streaming/types";

/** Initial hard-coded market until crew/user country exists. */
export const DEFAULT_WATCH_REGION = "IN";

/**
 * Resolve TMDB watch-provider region.
 * Component APIs should pass WatchRegionContext, never a raw country string,
 * so crew.country / user.country can land later without UI changes.
 */
export function resolveWatchRegion(
  context: WatchRegionContext = {},
): string {
  const raw =
    context.crewCountry?.trim() ||
    context.userCountry?.trim() ||
    context.fallback?.trim() ||
    DEFAULT_WATCH_REGION;
  return raw.toUpperCase();
}
