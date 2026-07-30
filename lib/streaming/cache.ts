import type { WatchAvailability } from "@/lib/streaming/types";

const CACHE_KEY = "pickit-watch-providers-v1";
export const WATCH_PROVIDER_TTL_MS = 24 * 60 * 60 * 1000;

type CacheFile = {
  version: 1;
  entries: Record<string, WatchAvailability>;
};

function cacheKey(mediaId: string, mediaType: string, region: string) {
  return `${region}:${mediaType}:${mediaId}`;
}

function readFile(): CacheFile {
  if (typeof window === "undefined") {
    return { version: 1, entries: {} };
  }
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return { version: 1, entries: {} };
    const parsed = JSON.parse(raw) as CacheFile;
    if (parsed?.version !== 1 || typeof parsed.entries !== "object") {
      return { version: 1, entries: {} };
    }
    return parsed;
  } catch {
    return { version: 1, entries: {} };
  }
}

function writeFile(file: CacheFile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(file));
  } catch {
    // Quota / private mode — ignore; in-memory still works for the session.
  }
}

export function getCachedWatchAvailability(
  mediaId: string,
  mediaType: string,
  region: string,
): WatchAvailability | null {
  const file = readFile();
  return file.entries[cacheKey(mediaId, mediaType, region)] ?? null;
}

export function isWatchAvailabilityFresh(
  entry: WatchAvailability,
  now = Date.now(),
): boolean {
  return now - entry.fetchedAt < WATCH_PROVIDER_TTL_MS;
}

export function putCachedWatchAvailability(entry: WatchAvailability) {
  const file = readFile();
  file.entries[cacheKey(entry.mediaId, entry.mediaType, entry.region)] =
    entry;
  writeFile(file);
}

export function putCachedWatchAvailabilityBatch(
  entries: WatchAvailability[],
) {
  if (entries.length === 0) return;
  const file = readFile();
  for (const entry of entries) {
    file.entries[cacheKey(entry.mediaId, entry.mediaType, entry.region)] =
      entry;
  }
  writeFile(file);
}

export function getCachedWatchAvailabilityMap(
  refs: Array<{ id: string; mediaType: string }>,
  region: string,
): Map<string, WatchAvailability> {
  const file = readFile();
  const map = new Map<string, WatchAvailability>();
  for (const ref of refs) {
    const entry =
      file.entries[cacheKey(ref.id, ref.mediaType, region)];
    if (entry) map.set(ref.id, entry);
  }
  return map;
}
