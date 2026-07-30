import { logger } from "@/lib/observability/logger";
import { tmdbService } from "@/lib/services/tmdb-service";
import { DEFAULT_WATCH_REGION } from "@/lib/streaming/region";
import type {
  WatchAvailability,
  WatchMediaType,
  WatchProvider,
} from "@/lib/streaming/types";

const SERVER_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_BATCH = 40;
const CONCURRENCY = 6;

type ServerCacheEntry = WatchAvailability;

const serverCache = new Map<string, ServerCacheEntry>();

type TitleInput = {
  id: string;
  mediaType?: WatchMediaType;
};

function serverKey(id: string, mediaType: WatchMediaType, region: string) {
  return `${region}:${mediaType}:${id}`;
}

function isFresh(entry: ServerCacheEntry, now = Date.now()) {
  return now - entry.fetchedAt < SERVER_TTL_MS;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]);
    }
  }

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    () => run(),
  );
  await Promise.all(runners);
  return results;
}

function sanitizeTitles(raw: unknown): TitleInput[] {
  if (!Array.isArray(raw)) return [];
  const out: TitleInput[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const id = String((entry as TitleInput).id ?? "").trim();
    if (!id || !/^\d+$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    const mediaType =
      (entry as TitleInput).mediaType === "tv" ? "tv" : "movie";
    out.push({ id, mediaType });
    if (out.length >= MAX_BATCH) break;
  }
  return out;
}

async function fetchOne(
  title: TitleInput,
  region: string,
): Promise<WatchAvailability> {
  const mediaType: WatchMediaType = title.mediaType ?? "movie";
  const key = serverKey(title.id, mediaType, region);
  const cached = serverCache.get(key);
  if (cached && isFresh(cached)) {
    return cached;
  }

  try {
    const providers: WatchProvider[] = (
      await tmdbService.getWatchProviders(mediaType, title.id, region)
    ).map((provider) => ({
      providerId: provider.providerId,
      name: provider.name,
      logoPath: provider.logoPath,
    }));

    const entry: WatchAvailability = {
      mediaId: title.id,
      mediaType,
      region,
      providers,
      fetchedAt: Date.now(),
      status: providers.length > 0 ? "ok" : "unavailable",
    };
    serverCache.set(key, entry);
    return entry;
  } catch (error) {
    logger.warn("Watch provider lookup failed", {
      mediaId: title.id,
      mediaType,
      region,
      message: error instanceof Error ? error.message : "unknown",
    });
    if (cached) {
      return { ...cached, status: cached.status === "error" ? "error" : cached.status };
    }
    const entry: WatchAvailability = {
      mediaId: title.id,
      mediaType,
      region,
      providers: [],
      fetchedAt: Date.now(),
      status: "error",
    };
    serverCache.set(key, entry);
    return entry;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = body as {
    region?: string;
    titles?: unknown;
  };
  const region = (payload.region ?? DEFAULT_WATCH_REGION)
    .trim()
    .toUpperCase()
    .slice(0, 8);
  const titles = sanitizeTitles(payload.titles);

  if (titles.length === 0) {
    return Response.json({ region, results: {} });
  }

  try {
    const entries = await mapPool(titles, CONCURRENCY, (title) =>
      fetchOne(title, region || DEFAULT_WATCH_REGION),
    );
    const results: Record<string, WatchAvailability> = {};
    for (const entry of entries) {
      results[entry.mediaId] = entry;
    }
    return Response.json({ region, results });
  } catch (error) {
    logger.error("Watch providers batch failed", {
      message: error instanceof Error ? error.message : "unknown",
      count: titles.length,
    });
    return Response.json(
      { error: "Could not load streaming availability." },
      { status: 500 },
    );
  }
}
