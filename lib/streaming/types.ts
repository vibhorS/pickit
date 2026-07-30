/** Dynamic streaming availability — not recommendation data. */

export type WatchMediaType = "movie" | "tv";

export type WatchProvider = {
  providerId: number;
  name: string;
  logoPath: string | null;
};

export type WatchAvailabilityStatus =
  | "ok"
  | "unavailable"
  | "error"
  | "unknown";

/**
 * Snapshot of flatrate (subscription) providers for one title + region.
 * Refreshed independently of recommendations.
 */
export type WatchAvailability = {
  mediaId: string;
  mediaType: WatchMediaType;
  region: string;
  /** Subscription / flatrate providers only. */
  providers: WatchProvider[];
  fetchedAt: number;
  status: WatchAvailabilityStatus;
};

export type WatchTitleRef = {
  id: string;
  mediaType?: WatchMediaType;
};

export type WatchRegionContext = {
  /** Preferred: crew.country when available. */
  crewCountry?: string | null;
  /** Fallback: user.country when available. */
  userCountry?: string | null;
  fallback?: string;
};
